# Verification log

Every entry is dated in IST. The rule for screenshots: **no client secrets visible.** Test apps are deleted or their secrets rotated after the attempt.

## Method
- **Probes (automated, no credentials).** Discovery docs (`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`, `openid_configuration`), an authorize call with a dummy `client_id` and `redirect_uri=https://example.com/cb`, and console URL reachability. Results are stored per guide as `tested` (kind `probe`). They prove endpoint behaviour, not policy.
- **Attempts (agent-driven, human logged in).** The agent fills the console forms; the human handles login and 2FA. Recorded below.
- **Initial probe run:** 2026-10-20 ~00:45 IST from the Grokbot box. Results are in `docs/research.md` §6.1.

## Probe methodology (T-004 run, 2026-10-20 02:07–02:09 IST)

The T-004 probes for the five demo guides were run by hand with `curl`, because `scripts/probe.ts` did not exist yet. The pipeline probe should reproduce these exactly.

- **Tool:** `curl -sS -A "<UA>" -o <body> -w "%{http_code} %{redirect_url}" --max-time 20 <url>`. No `-L`: we record the first hop's status and `Location`.
- **Timestamp:** `date -u +%Y-%m-%dT%H:%M:%SZ` taken immediately before each request. Stored as `probes[].at` in UTC.
- **Dummy client:** `client_id=oauth-atlas-probe`, `redirect_uri=https://example.com/cb`, `response_type=code` where the provider needs it, plus one representative scope (Slack `channels:history`, Google `gmail.readonly`, Instagram `instagram_business_basic`). Notion also needs `owner=user`.
- **Discovery paths tried:** `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server` on the auth host, plus any provider-documented path. A 404/400 means "no document at this path", **not** "unsupported". GitHub is the example: root 404, but documented paths under `/login/oauth` return 200.
- **What we record per probe:** `url`, `method`, `status`, `redirect` (if any), `observed` (one-line plain-English result), `at`. For discovery docs, `observed` lists `issuer`, `authorization_endpoint` and `code_challenge_methods_supported`.
- **What probes can claim:** endpoint liveness, discovery contents (PKCE methods, grant types) and error shape for an unknown client. **Never policy, review or timelines.** Claims backed by a probe use `status: "tested"`, `testKind: "probe"`.
- **Fetcher quirks found:** `developers.facebook.com` returns HTTP 400 to a full Chrome User-Agent string but 200 to `Mozilla/5.0`. Slack's authorize endpoint first returns 200 with a JS redirect (`&tracked=1`), and the second hop is a 302 to `workspace-signin`. `help.salesforce.com` is a JS shell. `blogs.intuit.com` and Reddit return 403.
- **Source fetches for quotes:** the same curl (`-L`, UA `Mozilla/5.0` or a browser string), HTML stripped to text, and every `quote` in the guides string-matched against that text. Fetch timestamps are stored as `fetchedAt` / `retrievedAt`.

| App | Probe | Status | Result | At (UTC) |
|---|---|---|---|---|
| GitHub | `github.com/.well-known/openid-configuration` | 404 | No document at the root | 2026-10-19T20:37:16Z |
| GitHub | `github.com/.well-known/oauth-authorization-server/login/oauth` | 200 | Issuer `https://github.com/login/oauth`; PKCE `S256`; grants auth_code, refresh_token, device_code | 2026-10-19T20:38:49Z |
| GitHub | `github.com/login/oauth/.well-known/openid-configuration` | 200 | Same issuer and endpoints | 2026-10-19T20:38:49Z |
| GitHub | `github.com/login/oauth/authorize?client_id=oauth-atlas-probe…` | 302 | → `github.com/login?…return_to=…` (login before client validation) | 2026-10-19T20:37:17Z |
| Notion | `api.notion.com/.well-known/oauth-authorization-server` | 400 | `invalid_request_url` | 2026-10-19T20:37:17Z |
| Notion | `api.notion.com/v1/oauth/authorize?…owner=user` | 302 | → `app.notion.com/install-integration?…` | 2026-10-19T20:37:17Z |
| Slack | `slack.com/.well-known/openid-configuration` | 200 | Sign in with Slack OIDC (`/openid/connect/authorize`) | 2026-10-19T20:37:18Z |
| Slack | `slack.com/oauth/v2/authorize?…&tracked=1` | 302 | → `slack.com/workspace-signin?redir=…` | 2026-10-19T20:37:43Z |
| Google | `accounts.google.com/.well-known/openid-configuration` | 200 | PKCE `plain`, `S256` | 2026-10-19T20:37:19Z |
| Google | `accounts.google.com/o/oauth2/v2/auth?client_id=oauth-atlas-probe…` | 302 | → `signin/oauth/error?authError=…`; decodes to "invalid_client: The OAuth client was not found." | 2026-10-19T20:37:19Z |
| Instagram | `www.instagram.com/.well-known/openid-configuration` | 200 | Issuer `https://www.instagram.com`; authorize `/oauth/dialog`; no PKCE methods listed | 2026-10-19T20:37:20Z |
| Instagram | `www.instagram.com/oauth/authorize?client_id=oauth-atlas-probe…` | 200 | Web app shell (~587 KB); no visible client error without a session | 2026-10-19T20:37:21Z |

## Entries

### GitHub — OAuth app (T-011)
**Not performed:** cut at 03:30 IST; human-supervised setup attempts were not run. Evidence for these guides is primary sources + automated probes only.
- **Tier:** stays `verified`; no attempt claims in `data/guides/github.json`.
- **Open checks for a later attempt:** up to 10 callback URLs; "Expire user access tokens" on by default; required fields (docs: Application name, Homepage URL, Authorization callback URL; description optional; "Enable Device Flow" checkbox).

### Notion — public connection (T-011)
**Not performed:** cut at 03:30 IST; human-supervised setup attempts were not run. Evidence for these guides is primary sources + automated probes only.
- **Tier:** stays `verified`; no attempt claims in `data/guides/notion.json`.
- **Open checks for a later attempt:** portal URL actually used (seed and guide say `https://www.notion.so/my-integrations`); installation-scope choices and whether the form warns that they can't be changed; any PKCE or token-lifetime setting (both unknowns in the guide).

### Slack — app from manifest (optional)
**Not performed** (optional attempt; not run). Evidence for the Slack guide is primary sources + automated probes only.

### Automated setup attempts, 10 apps (T-014)
**Run:** 2026-10-28 00:28 IST (2026-10-27T18:58Z), `runProbes` + `runAttempts` from a local script against the live providers. No accounts; nothing created. The code exchange used `client_id=oauth-atlas-probe-fake` and `code=oauth-atlas-attempt`; every registration request carried a body that is not JSON. Each app took 1.1–4.4 s.

| App | Code exchange (fake client, fake code) | Remote MCP server | Client registration |
|---|---|---|---|
| Asana | 400 `invalid_grant`: checks the code before the client | `mcp.asana.com` | MCP: **looks open** (400 "Invalid request body format") |
| Notion | 401 `invalid_client` | `mcp.notion.com` | MCP: **looks open** (400 `invalid_client_metadata`) |
| Slack | **HTTP 200** with `{"ok":false,"error":"invalid_code"}` (via the OIDC token endpoint): errors are in the body | `mcp.slack.com`, but its auth server is Slack's own OAuth (`oauth/v2_user`) | none advertised: a Slack app is still needed |
| Calendly | 400 **`Missing required parameter: code_verifier`**: PKCE required | `mcp.calendly.com` → auth server `calendly.com` | inconclusive (generic HTML 400 page) |
| GitHub | 404 `Not Found` for the fake client (not evidence the endpoint is missing) | none found | — |
| Miro | 401 "Client not found" | `mcp.miro.com` | inconclusive (500) |
| Linear | no token endpoint known | `mcp.linear.app` | MCP: **looks open** (400 `invalid_request`) |
| Gmail | 401 `invalid_client` | none found | — |
| Atlassian | 400 "authorization_code is invalid": checks the code first | `mcp.atlassian.com` (no RFC 9728 document; metadata on the host itself) | MCP: **looks open**; main OAuth `auth.atlassian.com/oidc/register`: 404, unavailable |
| Zoom | 400 `invalid_client` | `mcp.zoom.us` (auth server is `zoom.us` OAuth) | none advertised |

**What this changed in the guidance:**
- Four of the ten apps (Asana, Notion, Linear, Atlassian) run an MCP server whose client registration accepts unauthenticated requests. An agent connecting through MCP can likely register its own client, with no developer console and no OAuth app review. Guides now say so, as `tested` evidence (confidence `medium`, because a 400 for a malformed body is strong but indirect evidence) and as the first agent task.
- Slack's and Zoom's MCP servers sit on their regular OAuth, so they don't remove the need for an app.
- Calendly's PKCE requirement is now `tested` (`testKind: "attempt"`), not just "advertised in discovery".

**Classifier fixes found by this run:** Atlassian's "authorization_code is invalid" was first classified as `other` (regex fixed); Calendly's generic HTML 400 was first read as "open" (now inconclusive: an HTML error page is not an answer from a registration endpoint); GitHub's 404 wording no longer implies a missing endpoint.

**Still not attempted (needs a human):** creating an app in a developer console, a real consent and code exchange, and any review submission. T-011 remains cut.
