// Usage: npx tsx scripts/verify-mcp-setup.ts <mcp host, e.g. https://mcp.linear.app> --out <record.json> [--scope read] [--port 8976]
// T-015: a real setup through a remote MCP server, with no developer console. Registers a client through Dynamic
// Client Registration (RFC 7591), runs a PKCE sign-in with a localhost callback (a human logs in and consents in the
// browser), calls the MCP server, then revokes the token and checks it is dead. Tokens and secrets are never printed
// or written; the record holds statuses, the public client_id and what each step observed.
import { createHash, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";

import { authServerMetadataUrls } from "../lib/agent/attempt";
import { parseDiscovery } from "../lib/agent/probe";

function flag(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const b64url = (b: Buffer) => b.toString("base64url");
// docs/evidence/README.md redaction rule: client IDs are masked in records.
const mask = (id: string) => `${id.slice(0, 4)}…${id.slice(-2)}`;
type Step = { step: string; at: string; status?: number; observed: string };

async function json(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  // Streamable HTTP may answer with SSE: take the last data line.
  const data = text.includes("data:") ? text.split("\n").filter((l) => l.startsWith("data:")).at(-1)!.slice(5) : text;
  try {
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 200) };
  }
}

async function main() {
  const host = process.argv[2]?.replace(/\/$/, "");
  const out = flag("--out");
  if (!host || host.startsWith("--") || !out) {
    console.error("Usage: npx tsx scripts/verify-mcp-setup.ts <mcp host> --out <record.json> [--scope read] [--port 8976]");
    process.exit(2);
  }
  const scope = flag("--scope", "read")!;
  const port = Number(flag("--port", "8976"));
  const redirectUri = `http://localhost:${port}/callback`;
  const steps: Step[] = [];
  const log = (s: Omit<Step, "at">) => {
    const step = { ...s, at: new Date().toISOString() };
    steps.push(step);
    console.log(`[${step.step}] ${step.status ?? ""} ${step.observed}`);
  };
  const record = (extra: Record<string, unknown>) =>
    writeFileSync(out, JSON.stringify({ host, scope, redirectUri, ...extra, steps }, null, 2) + "\n");

  // 1. Metadata: protected resource (RFC 9728) → authorization server (RFC 8414).
  const pr = await fetch(`${host}/.well-known/oauth-protected-resource`);
  const prJson = pr.ok ? await json(pr) : {};
  const issuer = (Array.isArray(prJson.authorization_servers) && String(prJson.authorization_servers[0])) || host;
  let as: Record<string, unknown> = {};
  for (const url of authServerMetadataUrls(issuer)) {
    const r = await fetch(url);
    if (r.ok) {
      as = await json(r);
      if (parseDiscovery(as)) break;
    }
  }
  const d = parseDiscovery(as);
  if (!d?.authorizationEndpoint || !d.tokenEndpoint || !d.registrationEndpoint) throw new Error("No authorize, token or registration endpoint advertised");
  const resource = String(as.resource ?? prJson.resource ?? host);
  log({ step: "metadata", status: 200, observed: `issuer ${d.issuer}; registration ${d.registrationEndpoint}; MCP resource ${resource}` });

  // 2. Dynamic Client Registration with a real body (or reuse a client this script registered before).
  const reuse = flag("--client-id");
  const reg = reuse
    ? Response.json({ client_id: reuse, token_endpoint_auth_method: "none", reused: true }, { status: 200 })
    : await fetch(d.registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "OAuth Atlas setup verification (T-015)",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  const client = await json(reg);
  const clientId = typeof client.client_id === "string" ? client.client_id : null;
  log({
    step: "register",
    status: reg.status,
    observed: client.reused
      ? `Reusing client_id ${mask(clientId!)}, registered earlier by this script`
      : clientId
      ? `Registered without any credentials: client_id ${mask(clientId)}; auth method ${client.token_endpoint_auth_method ?? "unspecified"}; secret issued: ${"client_secret" in client ? "yes (not recorded)" : "no"}; management URI: ${client.registration_client_uri ? "yes" : "no"}`
      : `Registration failed: ${JSON.stringify(client).slice(0, 200)}`,
  });
  if (!clientId) return record({ outcome: "registration-failed" });

  // 3. PKCE authorization request; the human signs in and consents in the browser.
  const verifier = b64url(randomBytes(32));
  const state = b64url(randomBytes(16));
  const authUrl = new URL(d.authorizationEndpoint);
  for (const [k, v] of Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: b64url(createHash("sha256").update(verifier).digest()),
    code_challenge_method: "S256",
    resource,
  })) authUrl.searchParams.set(k, v);
  console.log(`AUTHORIZE_URL ${authUrl}`);

  const callback = await new Promise<URLSearchParams>((resolve, reject) => {
    const minutes = Number(flag("--wait-minutes", "10"));
    const timer = setTimeout(() => reject(new Error(`No callback within ${minutes} minutes`)), minutes * 60_000);
    const server = createServer((req, res) => {
      const u = new URL(req.url ?? "/", redirectUri);
      if (u.pathname !== "/callback") return void res.writeHead(404).end();
      // Anything without our state is not the provider's answer to this request: note it and keep waiting.
      if (u.searchParams.get("state") !== state) {
        console.log(`[callback] ignored a request without the expected state (params: ${[...u.searchParams.keys()].join(", ") || "none"})`);
        return void res.writeHead(400).end();
      }
      res.writeHead(200, { "Content-Type": "text/html" }).end("<h1>OAuth Atlas: sign-in received. You can close this tab.</h1>");
      clearTimeout(timer);
      server.close();
      resolve(u.searchParams);
    });
    server.listen(port, "localhost");
  });
  const code = callback.get("code");
  log({
    step: "consent",
    observed: code
      ? `Callback received with a code${callback.get("iss") ? ` and iss=${callback.get("iss")}` : ""}`
      : `Callback error: ${callback.get("error")} ${callback.get("error_description") ?? ""}`,
  });
  if (!code) return record({ outcome: "consent-failed", clientId: mask(clientId) });

  // 4. Code exchange with the PKCE verifier and no client secret.
  const tok = await fetch(d.tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId, code_verifier: verifier, resource }),
  });
  const tokens = await json(tok);
  const access = typeof tokens.access_token === "string" ? tokens.access_token : null;
  log({
    step: "token",
    status: tok.status,
    observed: access
      ? `Access token issued (type ${tokens.token_type}, expires_in ${tokens.expires_in ?? "unspecified"}, scope ${tokens.scope ?? "unspecified"}, refresh token: ${tokens.refresh_token ? "yes" : "no"})`
      : `Token exchange failed: ${JSON.stringify(tokens).slice(0, 200)}`,
  });
  if (!access) return record({ outcome: "token-failed", clientId: mask(clientId) });

  // 5. Use it: MCP initialize, then tools/list.
  const mcp = async (body: object, session?: string) =>
    fetch(resource, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-06-18",
        ...(session ? { "Mcp-Session-Id": session } : {}),
      },
      body: JSON.stringify(body),
    });
  const init = await mcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "oauth-atlas-verify", version: "0.1.0" } } });
  const session = init.headers.get("mcp-session-id") ?? undefined;
  const initBody = await json(init);
  const serverInfo = (initBody.result as { serverInfo?: { name?: string; version?: string } } | undefined)?.serverInfo;
  log({ step: "mcp-initialize", status: init.status, observed: `Server ${serverInfo?.name ?? "?"} ${serverInfo?.version ?? ""}; session: ${session ? "yes" : "no"}` });
  await mcp({ jsonrpc: "2.0", method: "notifications/initialized" }, session);
  const list = await mcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, session);
  const tools = ((await json(list)).result as { tools?: { name: string }[] } | undefined)?.tools ?? [];
  log({ step: "mcp-tools", status: list.status, observed: `${tools.length} tools, e.g. ${tools.slice(0, 6).map((t) => t.name).join(", ")}` });

  // 6. Revoke (RFC 7009) and confirm the token no longer works.
  const revocation = typeof as.revocation_endpoint === "string" ? as.revocation_endpoint : null;
  if (revocation) {
    for (const [hint, value] of [["refresh_token", tokens.refresh_token], ["access_token", access]] as const) {
      if (typeof value !== "string") continue;
      const r = await fetch(revocation, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: value, token_type_hint: hint, client_id: clientId }),
      });
      log({ step: `revoke-${hint}`, status: r.status, observed: r.ok ? "Revocation accepted" : `Revocation answered ${r.status}` });
    }
    const after = await mcp({ jsonrpc: "2.0", id: 3, method: "tools/list" }, session);
    log({ step: "after-revoke", status: after.status, observed: after.status === 401 ? "Token rejected after revocation" : `Token still answered ${after.status} after revocation` });
  } else {
    log({ step: "revoke", observed: "No revocation endpoint advertised; the token expires on its own" });
  }
  record({ outcome: "completed", clientId: mask(clientId) });
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
