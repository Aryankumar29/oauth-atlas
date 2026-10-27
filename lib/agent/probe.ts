import { BROWSER_UA, fetchWithTimeout, htmlToText } from "@/lib/agent/fetchDoc";
import { checkFetchUrlResolved, isSafeFetchUrl, UnsafeUrlError, type DnsLookup } from "@/lib/agent/urlGuard";
import type { ResolvedApp } from "@/lib/agent/resolve";
import type { Probe } from "@/lib/schema";

// SPEC §9.4: credential-free probes. A miss is "unknown", never "unsupported".

export const PROBE_CLIENT_ID = "oauth-atlas-probe-fake";
export const PROBE_REDIRECT = "https://example.com/cb";
export const WELL_KNOWN_PATHS = [
  "/.well-known/openid-configuration",
  "/.well-known/oauth-authorization-server",
  // Intuit-style variant.
  "/.well-known/openid_configuration",
];

// Authorize endpoints for providers without a discovery document. Hints only: the probe records what it observes.
export const KNOWN_AUTHORIZE: Record<string, string> = {
  github: "https://github.com/login/oauth/authorize",
  google: "https://accounts.google.com/o/oauth2/v2/auth",
  gmail: "https://accounts.google.com/o/oauth2/v2/auth",
  linkedin: "https://www.linkedin.com/oauth/v2/authorization",
  notion: "https://api.notion.com/v1/oauth/authorize",
  slack: "https://slack.com/oauth/v2/authorize",
  microsoft: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  miro: "https://miro.com/oauth/authorize",
  calendly: "https://auth.calendly.com/oauth/authorize",
};

export type Discovery = {
  issuer?: string;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  registrationEndpoint?: string;
  codeChallengeMethods: string[];
  grantTypes: string[];
  scopes: string[];
};

export type ProbeResult = {
  probes: Probe[];
  discovery?: Discovery & { url: string; at: string };
  authorize?: { url: string; kind: AuthorizeKind };
  summary: string;
};

export function parseDiscovery(json: unknown): Discovery | null {
  if (typeof json !== "object" || json === null) return null;
  const j = json as Record<string, unknown>;
  if (typeof j.authorization_endpoint !== "string" && typeof j.issuer !== "string") return null;
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    issuer: typeof j.issuer === "string" ? j.issuer : undefined,
    authorizationEndpoint: typeof j.authorization_endpoint === "string" ? j.authorization_endpoint : undefined,
    tokenEndpoint: typeof j.token_endpoint === "string" ? j.token_endpoint : undefined,
    registrationEndpoint: typeof j.registration_endpoint === "string" ? j.registration_endpoint : undefined,
    codeChallengeMethods: arr(j.code_challenge_methods_supported),
    grantTypes: arr(j.grant_types_supported),
    scopes: arr(j.scopes_supported),
  };
}

export function describeDiscovery(d: Discovery): string {
  return [
    d.authorizationEndpoint && `authorize: ${d.authorizationEndpoint}`,
    d.tokenEndpoint && `token: ${d.tokenEndpoint}`,
    `PKCE methods: ${d.codeChallengeMethods.length ? d.codeChallengeMethods.join(", ") : "not listed"}`,
    `grant types: ${d.grantTypes.length ? d.grantTypes.join(", ") : "not listed"}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export type AuthorizeKind =
  | "invalid-client-redirect"
  | "invalid-client-page"
  | "login-redirect"
  | "error-redirect"
  | "consent-or-login-page"
  | "not-found"
  | "other";

const LOGIN_RE = /(\/login|\/signin|\/sign-in|\/session|\/oauth2?\/login|accounts\.[^/]+\/(v3\/)?signin|ServiceLogin)/i;

// Classifies the provider's response to a dummy client_id.
export function interpretAuthorize(
  status: number,
  location: string | null,
  body: string,
): { kind: AuthorizeKind; observed: string } {
  if (location) {
    let loc: URL | null = null;
    try {
      loc = new URL(location, "https://example.invalid");
    } catch {}
    const params = loc ? loc.searchParams : new URLSearchParams();
    const authError = params.get("authError");
    const err = (authError && decodeAuthError(authError)) || params.get("error_description") || params.get("error");
    if (err || /invalid_client/i.test(decodeURIComponent(location))) {
      const text = (err ?? "invalid_client").replace(/[^ -~]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      return /invalid_client|invalid client|client.?id/i.test(text)
        ? { kind: "invalid-client-redirect", observed: `Redirected with an invalid-client error: ${text}` }
        : { kind: "error-redirect", observed: `Redirected with error: ${text}` };
    }
    if (loc && LOGIN_RE.test(`${loc.hostname}${loc.pathname}`)) {
      return { kind: "login-redirect", observed: `Redirected to login (${loc.hostname}${loc.pathname}) before validating the client` };
    }
    return { kind: "other", observed: `HTTP ${status} redirect to ${loc ? loc.hostname + loc.pathname : location.slice(0, 120)}` };
  }
  if (status === 404) return { kind: "not-found", observed: "Authorize endpoint returned 404" };
  const text = htmlToText(body).text.replace(/\s+/g, " ");
  const m = text.match(/[^.]{0,60}(invalid[_ ]client|invalid "?[\w-]*"?|client[_ ]id[^.]{0,40}(invalid|not found|unknown))[^.]{0,60}/i);
  if (m) return { kind: "invalid-client-page", observed: `HTTP ${status}; page shows: "${m[0].trim().slice(0, 160)}"` };
  if (/(sign in|log in|password)/i.test(text)) {
    return { kind: "consent-or-login-page", observed: `HTTP ${status}; renders a sign-in or consent page` };
  }
  return { kind: "other", observed: `HTTP ${status}; no recognizable error shape` };
}

// Google packs the error into a base64url protobuf; the readable parts are plain ASCII.
export function decodeAuthError(v: string): string {
  try {
    const bin = atob(v.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(v.length / 4) * 4, "="));
    const text = bin.replace(/[^ -~]+/g, " ").replace(/\s+/g, " ").trim();
    return text || v;
  } catch {
    return v;
  }
}

export function authorizeProbeUrl(endpoint: string, scope?: string): string {
  const u = new URL(endpoint);
  u.searchParams.set("client_id", PROBE_CLIENT_ID);
  u.searchParams.set("redirect_uri", PROBE_REDIRECT);
  u.searchParams.set("response_type", "code");
  if (scope) u.searchParams.set("scope", scope);
  u.searchParams.set("state", "oauth-atlas-probe");
  return u.toString();
}

// RFC 8414 §3 path insertion: an issuer with a path publishes at /.well-known/<suffix><path>,
// and some OIDC servers append instead (<path>/.well-known/openid-configuration).
export function pathDiscoveryUrls(authorizeUrl: string): string[] {
  let u: URL;
  try {
    u = new URL(authorizeUrl);
  } catch {
    return [];
  }
  const segments = u.pathname.split("/").filter(Boolean);
  const issuerPaths = new Set<string>();
  // GitHub: /login/oauth/authorize → issuer path /login/oauth.
  for (let n = segments.length - 1; n >= 1; n--) issuerPaths.add(`/${segments.slice(0, n).join("/")}`);
  return [...issuerPaths].slice(0, 2).flatMap((path) => [
    `${u.origin}/.well-known/oauth-authorization-server${path}`,
    `${u.origin}/.well-known/openid-configuration${path}`,
    `${u.origin}${path}/.well-known/openid-configuration`,
  ]);
}

function candidateOrigins(resolved: ResolvedApp, authorizeHint?: string): string[] {
  const hosts = new Set<string>();
  const add = (u?: string) => {
    if (!u) return;
    try {
      hosts.add(new URL(u).origin);
    } catch {}
  };
  add(resolved.website);
  if (authorizeHint) add(authorizeHint);
  try {
    const host = new URL(resolved.website).hostname.replace(/^www\./, "");
    const base = host.split(".").slice(-2).join(".");
    add(`https://${base}`);
    add(`https://auth.${base}`);
  } catch {}
  return [...hosts].slice(0, 4);
}

export type ProbeOpts = {
  fetch: typeof globalThis.fetch;
  now: () => Date;
  perRequestMs?: number;
  stepMs?: number;
  dnsLookup?: DnsLookup;
};

// Every probe URL derives from user input, the seed, or a remote discovery document: guard each one.
// Redirects are recorded, never followed.
async function probeGet(url: string, opts: ProbeOpts, accept: string) {
  const check = await checkFetchUrlResolved(url, opts.dnsLookup);
  if (!check.ok) throw new UnsafeUrlError(url, check.reason);
  const res = await fetchWithTimeout(
    opts.fetch,
    url,
    { headers: { "User-Agent": BROWSER_UA, Accept: accept }, redirect: "manual" },
    opts.perRequestMs ?? 5000,
  );
  const body = res.status >= 300 && res.status < 400 ? "" : (await res.text()).slice(0, 200_000);
  return { status: res.status, location: res.headers.get("location"), body };
}

export async function runProbes(resolved: ResolvedApp, opts: ProbeOpts): Promise<ProbeResult> {
  const deadline = Date.now() + (opts.stepMs ?? 20_000);
  const remaining = () => Math.max(0, deadline - Date.now());
  const probes: Probe[] = [];
  const at = () => opts.now().toISOString();
  const authorizeHint = KNOWN_AUTHORIZE[resolved.slug];
  const result: ProbeResult = { probes, summary: "" };

  // 1. Discovery documents, in parallel.
  const urls = [
    ...candidateOrigins(resolved, authorizeHint).flatMap((o) => WELL_KNOWN_PATHS.map((p) => o + p)),
    ...(authorizeHint ? pathDiscoveryUrls(authorizeHint) : []),
  ].filter(isSafeFetchUrl);
  const settled = await Promise.allSettled(
    urls.map(async (url) => {
      const r = await probeGet(url, { ...opts, perRequestMs: Math.min(opts.perRequestMs ?? 5000, remaining()) }, "application/json");
      let disc: Discovery | null = null;
      if (r.status === 200) {
        try {
          disc = parseDiscovery(JSON.parse(r.body));
        } catch {}
      }
      return { url, r, disc, at: at() };
    }),
  );
  let misses = 0;
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const { url, r, disc } = s.value;
    if (disc && !result.discovery) {
      result.discovery = { ...disc, url, at: s.value.at };
      probes.push({ url, method: "GET", status: r.status, observed: `Discovery document found. ${describeDiscovery(disc)}`, at: s.value.at });
    } else if (!disc) {
      misses += 1;
      if (misses <= 3) {
        probes.push({
          url,
          method: "GET",
          status: r.status,
          redirect: r.location ?? undefined,
          observed: "No discovery document here (unknown, not unsupported)",
          at: s.value.at,
        });
      }
    }
  }

  // 2. Authorize endpoint with a dummy client_id.
  const authorizeEndpoint = result.discovery?.authorizationEndpoint ?? authorizeHint;
  if (authorizeEndpoint && remaining() > 0) {
    // OIDC providers (Google) reject a missing scope before checking the client.
    const oidc = !!result.discovery && (result.discovery.url.includes("openid") || result.discovery.scopes.includes("openid"));
    const url = authorizeProbeUrl(authorizeEndpoint, oidc ? "openid" : undefined);
    try {
      const r = await probeGet(url, { ...opts, perRequestMs: Math.min(opts.perRequestMs ?? 5000, remaining()) }, "text/html");
      const { kind, observed } = interpretAuthorize(r.status, r.location, r.body);
      result.authorize = { url, kind };
      probes.push({ url, method: "GET", status: r.status, redirect: r.location ?? undefined, observed, at: at() });
    } catch (e) {
      // Blocked URLs are dropped silently (no probe record that echoes an internal address).
      if (!(e instanceof UnsafeUrlError)) probes.push({ url, method: "GET", status: 0, observed: `Request failed: ${errMsg(e)}`, at: at() });
    }
  }

  // 3. Developer console reachability.
  if (resolved.consoleUrl && remaining() > 0) {
    try {
      const r = await probeGet(resolved.consoleUrl, { ...opts, perRequestMs: Math.min(opts.perRequestMs ?? 5000, remaining()) }, "text/html");
      const toLogin = !!r.location && LOGIN_RE.test(r.location);
      probes.push({
        url: resolved.consoleUrl,
        method: "GET",
        status: r.status,
        redirect: r.location ?? undefined,
        observed: toLogin
          ? "Console reachable; redirects to login"
          : r.location
            ? `Console redirects to ${r.location.slice(0, 120)}`
            : r.status < 400
              ? "Console reachable without login"
              : `Console returned HTTP ${r.status}`,
        at: at(),
      });
    } catch (e) {
      if (!(e instanceof UnsafeUrlError)) {
        probes.push({ url: resolved.consoleUrl, method: "GET", status: 0, observed: `Request failed: ${errMsg(e)}`, at: at() });
      }
    }
  }

  result.summary = [
    result.discovery ? "discovery document found" : "no discovery document (unknown)",
    result.authorize ? `authorize: ${result.authorize.kind}` : "authorize endpoint unknown",
    resolved.consoleUrl ? "console checked" : "no console URL",
  ].join("; ");
  return result;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? (e.name === "AbortError" ? "timeout" : e.message) : String(e);
}
