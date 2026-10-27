import { BROWSER_UA, fetchWithTimeout } from "@/lib/agent/fetchDoc";
import {
  describeDiscovery,
  parseDiscovery,
  PROBE_CLIENT_ID,
  PROBE_REDIRECT,
  type Discovery,
  type ProbeOpts,
  type ProbeResult,
} from "@/lib/agent/probe";
import type { ResolvedApp } from "@/lib/agent/resolve";
import { checkFetchUrlResolved, UnsafeUrlError } from "@/lib/agent/urlGuard";
import type { Guide, Probe } from "@/lib/schema";

// Setup attempts (T-014): the agent tries the setup steps it can take without an account, and records what the
// provider did. Nothing is ever created: the code exchange uses a fake client and code, and the registration
// attempt sends a body that cannot be parsed, so no client can be registered.

export const ATTEMPT_CODE = "oauth-atlas-attempt";
export const ATTEMPT_REGISTRATION_BODY = "oauth-atlas attempt: intentionally not JSON, nothing to register";

// Token endpoints for providers without a discovery document. Hints only, like KNOWN_AUTHORIZE.
export const KNOWN_TOKEN: Record<string, string> = {
  github: "https://github.com/login/oauth/access_token",
  slack: "https://slack.com/api/oauth.v2.access",
  notion: "https://api.notion.com/v1/oauth/token",
  miro: "https://api.miro.com/v1/oauth/token",
  calendly: "https://auth.calendly.com/oauth/token",
  linkedin: "https://www.linkedin.com/oauth/v2/accessToken",
  asana: "https://app.asana.com/-/oauth_token",
};

export type TokenKind = "pkce-required" | "invalid-client" | "invalid-grant" | "error-in-200" | "not-found" | "other";
export type RegistrationKind = "open" | "protected" | "unavailable" | "inconclusive";

export type McpServer = Discovery & { resource: string; metadataUrl: string; at: string };

export type AttemptResult = {
  attempts: Probe[];
  token?: { url: string; kind: TokenKind; at: string };
  mcp?: McpServer;
  registrations: { url: string; kind: RegistrationKind; for: "mcp" | "oauth"; at: string }[];
  summary: string;
};

type Json = Record<string, unknown>;

function parseJson(body: string): Json | null {
  try {
    const j = JSON.parse(body);
    return typeof j === "object" && j !== null && !Array.isArray(j) ? (j as Json) : null;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const clip = (s: string, n = 160) => s.replace(/[^ -~]+/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// Classifies the token endpoint's answer to a fake client exchanging a fake code.
export function interpretToken(status: number, body: string): { kind: TokenKind; observed: string } {
  const j = parseJson(body);
  const error = str(j?.error) ?? str(j?.code);
  const detail = str(j?.error_description) ?? str(j?.message);
  const said = clip([error, detail && `"${detail}"`].filter(Boolean).join(" ") || body);
  const prefix = `Code exchange with a fake client and code: HTTP ${status}`;
  if (/code_verifier|pkce/i.test(body)) {
    return {
      kind: "pkce-required",
      observed: `${prefix}, ${said}. The endpoint asked for code_verifier before checking the client, so PKCE is required.`,
    };
  }
  if (status >= 200 && status < 300 && j && (j.ok === false || error)) {
    return {
      kind: "error-in-200",
      observed: `${prefix} with ${clip(body, 120)}. Errors come back with HTTP ${status}, so check the response body, not the status code.`,
    };
  }
  if (/invalid_client|client (was )?not found|unknown client/i.test(`${error} ${detail}`)) {
    return { kind: "invalid-client", observed: `${prefix}, ${said}. The endpoint is live and rejects unknown clients first.` };
  }
  if (/invalid_grant|invalid_code|code not found|authorization[ _]code|code.{0,20}invalid/i.test(`${error} ${detail}`)) {
    return {
      kind: "invalid-grant",
      observed: `${prefix}, ${said}. The endpoint is live and checks the code before the client credentials.`,
    };
  }
  if (status === 404) {
    return { kind: "not-found", observed: `${prefix}, ${said}. A 404 for a fake client does not show that the endpoint is missing.` };
  }
  return { kind: "other", observed: `${prefix}, ${said || "no recognizable error shape"}.` };
}

// Classifies the answer to a registration request whose body is deliberately not JSON.
export function interpretRegistration(status: number, body: string): { kind: RegistrationKind; observed: string } {
  const j = parseJson(body);
  const said = clip(
    j ? [str(j.error), str(j.error_description)].filter(Boolean).join(": ") || body : /<html/i.test(body) ? "an HTML error page" : body,
  );
  const prefix = `Registration request with an unparseable body: HTTP ${status}${said ? ` (${said})` : ""}.`;
  // A generic HTML error page is not an answer from a registration endpoint.
  if ((status === 400 || status === 422) && (j || !/<html/i.test(body))) {
    return {
      kind: "open",
      observed: `${prefix} The server rejected only the body and asked for no credentials, so Dynamic Client Registration (RFC 7591) looks open: an agent can likely register its own client. Nothing was registered.`,
    };
  }
  if (status === 401 || status === 403) {
    return { kind: "protected", observed: `${prefix} Registration needs an initial access token or provider approval.` };
  }
  if (status === 404 || status === 405) {
    return { kind: "unavailable", observed: `${prefix} The advertised registration endpoint did not accept requests.` };
  }
  return { kind: "inconclusive", observed: `${prefix} Inconclusive: this does not show whether registration is open.` };
}

// mcp.<domain> for each official registrable domain (not GitHub scopes), at most three.
export function mcpHosts(officialDomains: readonly string[]): string[] {
  const hosts = officialDomains.filter((d) => !d.includes("/")).map((d) => `https://mcp.${d.replace(/^(www|mcp)\./, "")}`);
  return [...new Set(hosts)].slice(0, 3);
}

// RFC 8414 §3: metadata for an issuer with a path lives at /.well-known/<suffix><path>.
export function authServerMetadataUrls(issuer: string): string[] {
  let u: URL;
  try {
    u = new URL(issuer);
  } catch {
    return [];
  }
  const path = u.pathname.replace(/\/$/, "");
  return [`${u.origin}/.well-known/oauth-authorization-server${path}`, `${u.origin}/.well-known/openid-configuration${path}`];
}

type AttemptOpts = ProbeOpts & { officialDomains: readonly string[] };

// Same guard as the probes: every URL comes from the seed or a provider document. Redirects are never followed.
async function guarded(url: string, init: RequestInit, opts: AttemptOpts, ms: number) {
  const check = await checkFetchUrlResolved(url, opts.dnsLookup);
  if (!check.ok) throw new UnsafeUrlError(url, check.reason);
  const res = await fetchWithTimeout(opts.fetch, url, { ...init, redirect: "manual" }, ms);
  const body = res.status >= 300 && res.status < 400 ? "" : (await res.text()).slice(0, 50_000);
  return { status: res.status, location: res.headers.get("location"), body };
}

async function findMcpServer(host: string, opts: AttemptOpts, ms: () => number, attempts: Probe[], at: () => string) {
  const get = (url: string) => guarded(url, { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } }, opts, ms());
  const resourceUrl = `${host}/.well-known/oauth-protected-resource`;
  let issuer = host;
  // RFC 9728 protected-resource metadata names the authorization server; without it, try the MCP host itself.
  try {
    const r = await get(resourceUrl);
    const servers = r.status === 200 ? parseJson(r.body)?.authorization_servers : undefined;
    const first = Array.isArray(servers) ? str(servers[0]) : undefined;
    if (first) {
      issuer = first;
      attempts.push({ url: resourceUrl, method: "GET", status: r.status, kind: "attempt", observed: `Remote MCP server found; its authorization server is ${first}.`, at: at() });
    }
  } catch {
    // No such host is the common case: nothing to record.
    return undefined;
  }
  for (const url of authServerMetadataUrls(issuer)) {
    try {
      const r = await get(url);
      const d = r.status === 200 ? parseDiscovery(parseJson(r.body)) : null;
      if (!d) continue;
      const stamp = at();
      attempts.push({
        url,
        method: "GET",
        status: r.status,
        kind: "attempt",
        observed: `MCP authorization server metadata. ${describeDiscovery(d)}; registration: ${d.registrationEndpoint ?? "not advertised"}`,
        at: stamp,
      });
      return { ...d, resource: host, metadataUrl: url, at: stamp };
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function runAttempts(resolved: ResolvedApp, probe: ProbeResult | null, opts: AttemptOpts): Promise<AttemptResult> {
  const deadline = Date.now() + (opts.stepMs ?? 20_000);
  const ms = () => Math.max(0, Math.min(opts.perRequestMs ?? 5000, deadline - Date.now()));
  const at = () => opts.now().toISOString();
  const attempts: Probe[] = [];
  const result: AttemptResult = { attempts, registrations: [], summary: "" };
  const failed = (url: string, method: string, e: unknown) => {
    if (!(e instanceof UnsafeUrlError)) attempts.push({ url, method, status: 0, kind: "attempt", observed: `Request failed: ${errMsg(e)}`, at: at() });
  };

  // 1. Exchange a fake code at the token endpoint, and 2. look for a remote MCP server, in parallel.
  const tokenUrl = probe?.discovery?.tokenEndpoint ?? KNOWN_TOKEN[resolved.slug];
  const tokenAttempt = (async () => {
    if (!tokenUrl) return;
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code: ATTEMPT_CODE,
      client_id: PROBE_CLIENT_ID,
      client_secret: ATTEMPT_CODE,
      redirect_uri: PROBE_REDIRECT,
    });
    try {
      const r = await guarded(
        tokenUrl,
        {
          method: "POST",
          headers: { "User-Agent": BROWSER_UA, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
          body: form.toString(),
        },
        opts,
        ms(),
      );
      const { kind, observed } = interpretToken(r.status, r.body);
      const stamp = at();
      result.token = { url: tokenUrl, kind, at: stamp };
      attempts.push({ url: tokenUrl, method: "POST", status: r.status, redirect: r.location ?? undefined, kind: "attempt", observed, at: stamp });
    } catch (e) {
      failed(tokenUrl, "POST", e);
    }
  })();
  const mcpAttempt = (async () => {
    for (const host of mcpHosts(opts.officialDomains)) {
      if (ms() <= 0) return;
      const found = await findMcpServer(host, opts, ms, attempts, at);
      if (found) {
        result.mcp = found;
        return;
      }
    }
  })();
  await Promise.all([tokenAttempt, mcpAttempt]);

  // 3. Try to register a client wherever registration is advertised, with a body that cannot register anything.
  const targets = [
    ...(result.mcp?.registrationEndpoint ? [{ url: result.mcp.registrationEndpoint, for: "mcp" as const }] : []),
    ...(probe?.discovery?.registrationEndpoint ? [{ url: probe.discovery.registrationEndpoint, for: "oauth" as const }] : []),
  ].filter((t, i, all) => all.findIndex((x) => x.url === t.url) === i);
  await Promise.all(
    targets.map(async (t) => {
      if (ms() <= 0) return;
      try {
        const r = await guarded(
          t.url,
          { method: "POST", headers: { "User-Agent": BROWSER_UA, Accept: "application/json", "Content-Type": "application/json" }, body: ATTEMPT_REGISTRATION_BODY },
          opts,
          ms(),
        );
        const { kind, observed } = interpretRegistration(r.status, r.body);
        const stamp = at();
        result.registrations.push({ url: t.url, kind, for: t.for, at: stamp });
        attempts.push({ url: t.url, method: "POST", status: r.status, kind: "attempt", observed, at: stamp });
      } catch (e) {
        failed(t.url, "POST", e);
      }
    }),
  );

  result.summary = [
    result.token ? `code exchange: ${result.token.kind}` : "no token endpoint to try",
    result.mcp ? `MCP server at ${result.mcp.resource}` : "no remote MCP server found",
    ...result.registrations.map((r) => `${r.for === "mcp" ? "MCP" : "OAuth"} client registration: ${r.kind}`),
  ].join("; ");
  return result;
}

// Facts the attempts established, written into the guide by code (the LLM never marks anything tested).
export function applyAttemptFacts(guide: Guide, result: AttemptResult): Guide {
  const g = structuredClone(guide);
  const evidence = (id: string, claim: string, url: string, when: string, confidence: "high" | "medium") => {
    if (g.evidence.some((e) => e.id === id)) return;
    g.evidence.push({ id, claim, sourceUrl: url, sourceType: "test", retrievedAt: when, status: "tested", confidence });
  };

  const t = result.token;
  if (t?.kind === "pkce-required") {
    const advertised = g.oauthConfig.pkce?.status === "tested" ? ` ${g.oauthConfig.pkce.value}.` : "";
    const value = `PKCE required: the token endpoint refuses a code exchange without code_verifier.${advertised}`;
    g.oauthConfig.pkce = {
      value,
      status: "tested",
      testKind: "attempt",
      sources: [{ url: t.url, title: "Code exchange attempt", fetchedAt: t.at }],
      lastChecked: t.at,
    };
    evidence("attempt-token-pkce", value, t.url, t.at, "high");
  } else if (t?.kind === "error-in-200") {
    evidence("attempt-token-errors", "The token endpoint returns errors with HTTP 200; check the response body for failure.", t.url, t.at, "high");
  }

  const m = result.mcp;
  if (m) {
    evidence("attempt-mcp", `${g.app.name} runs a remote MCP server at ${m.resource} with its own OAuth authorization server (${m.issuer ?? m.metadataUrl}).`, m.metadataUrl, m.at, "high");
  }
  for (const r of result.registrations) {
    const where = r.for === "mcp" ? `the remote MCP server (${m?.resource})` : "the OAuth authorization server";
    if (r.kind === "open") {
      evidence(`attempt-dcr-${r.for}`, `Dynamic Client Registration at ${where} accepts unauthenticated requests, so an agent can likely register its own client.`, r.url, r.at, "medium");
      const task = `Register an OAuth client for ${where} through Dynamic Client Registration (${r.url}); no developer console needed.`;
      if (!g.agentTasks.includes(task)) g.agentTasks.unshift(task);
    } else if (r.kind === "protected") {
      evidence(`attempt-dcr-${r.for}`, `Dynamic Client Registration at ${where} requires an initial access token or approval.`, r.url, r.at, "high");
    } else {
      g.unknowns.push(`Client registration at ${r.url} was attempted but the result was ${r.kind}.`);
    }
  }
  return g;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : String(e);
}
