// Usage: npx tsx scripts/verify-github-device-flow.ts --client-id <GitHub OAuth app client ID> --out <record.json>
// T-015: a real sign-in with a GitHub OAuth app through the Device Flow (RFC 8628): no callback and no client secret.
// The human creates the OAuth app (Device Flow enabled), enters the user code at github.com/login/device, and deletes
// the app afterwards; the script then checks that deleting the app killed the token. Tokens, the user code and the
// account's identity are never written to the record.
import { writeFileSync } from "node:fs";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

type Step = { step: string; at: string; status?: number; observed: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// docs/evidence/README.md redaction rule: client IDs are masked in records.
const mask = (id: string) => `${id.slice(0, 4)}…${id.slice(-2)}`;

async function form(url: string, body: Record<string, string>) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

async function main() {
  const clientId = flag("--client-id");
  const out = flag("--out");
  if (!clientId || !out) {
    console.error("Usage: npx tsx scripts/verify-github-device-flow.ts --client-id <id> --out <record.json>");
    process.exit(2);
  }
  const steps: Step[] = [];
  const log = (s: Omit<Step, "at">) => {
    const step = { ...s, at: new Date().toISOString() };
    steps.push(step);
    console.log(`[${step.step}] ${step.status ?? ""} ${step.observed}`);
  };
  const record = (outcome: string) => writeFileSync(out, JSON.stringify({ provider: "github", clientId: mask(clientId), flow: "device", outcome, steps }, null, 2) + "\n");

  // 1. Device authorization request: client_id only, no scope (public read access).
  const dc = await form("https://github.com/login/device/code", { client_id: clientId });
  const deviceCode = typeof dc.json.device_code === "string" ? dc.json.device_code : null;
  log({
    step: "device-code",
    status: dc.status,
    observed: deviceCode
      ? `Device code issued without a client secret; expires_in ${dc.json.expires_in}s, poll interval ${dc.json.interval}s`
      : `Failed: ${JSON.stringify(dc.json).slice(0, 200)}`,
  });
  if (!deviceCode) return record("device-code-failed");
  console.log(`USER_CODE ${dc.json.user_code} at ${dc.json.verification_uri}`);

  // 2. Poll until the human enters the code and authorizes (honouring slow_down).
  let interval = Number(dc.json.interval ?? 5) * 1000;
  const deadline = Date.now() + Number(dc.json.expires_in ?? 900) * 1000;
  let token: string | null = null;
  const seen = new Set<string>();
  while (Date.now() < deadline) {
    await sleep(interval);
    const t = await form("https://github.com/login/oauth/access_token", {
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    if (typeof t.json.access_token === "string") {
      token = t.json.access_token;
      log({
        step: "token",
        status: t.status,
        observed: `Access token issued after authorization (type ${t.json.token_type}, scope "${t.json.scope}", expires_in ${t.json.expires_in ?? "none"}, refresh token: ${t.json.refresh_token ? "yes" : "no"})`,
      });
      break;
    }
    const err = String(t.json.error);
    if (!seen.has(err)) {
      seen.add(err);
      log({ step: "poll", status: t.status, observed: `Polling answered ${err}` });
    }
    if (err === "slow_down") interval += 5000;
    else if (err !== "authorization_pending") return record(`token-failed:${err}`);
  }
  if (!token) return record("expired");

  // 3. Use it.
  const api = (path: string) => fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } });
  const me = await api("/user");
  log({
    step: "api-user",
    status: me.status,
    observed: `GET /user answered ${me.status}; granted scopes header: "${me.headers.get("x-oauth-scopes") ?? ""}"`,
  });
  record("signed-in");

  // 4. The human deletes the OAuth app; check that its tokens die with it.
  console.log("DELETE_APP_NOW: delete the OAuth app in GitHub settings; waiting up to 30 minutes for the token to stop working");
  const until = Date.now() + 30 * 60_000;
  while (Date.now() < until) {
    await sleep(15_000);
    const r = await api("/user");
    if (r.status === 401) {
      log({ step: "after-app-deleted", status: 401, observed: "Token rejected after the OAuth app was deleted" });
      return record("completed");
    }
  }
  log({ step: "after-app-deleted", observed: "Token still worked after 30 minutes; app not deleted or revocation is delayed" });
  record("token-still-valid");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
