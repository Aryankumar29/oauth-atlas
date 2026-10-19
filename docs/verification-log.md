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

<!-- PLACEHOLDER (T-011): the human and Grokbot run the GitHub and Notion attempts 02:45–03:30 IST.
     Fill the fields below from their notes. Until then these entries are NOT evidence, and the guides stay tier "verified". -->

### GitHub — OAuth app (T-011) — PENDING
- **When (IST):**
- **Account type:** personal, free
- **Driver:** grokbot box browser / Claude Code Playwright MCP; human login
- **Attempted:** register an OAuth app at github.com/settings/developers
- **Completed:**
- **Stopped because:**
- **Docs said vs console required:**
  - Up to 10 callback URLs?
  - "Expire user access tokens" on by default?
  - Required fields? (Docs: Application name, Homepage URL, Authorization callback URL; description optional; "Enable Device Flow" checkbox.)
- **Screenshots:** `docs/screenshots/github-*.png`
- **Cleanup:** app deleted / secret rotated

### Notion — public connection (T-011) — PENDING
- **When (IST):**
- **Account type:** free workspace
- **Driver:**
- **Attempted:** Developer portal → Build → Public connections → Create
- **Completed:**
- **Stopped because:**
- **Docs said vs console required:** required fields, installation scope, capabilities, console URL
  - Portal URL actually used (seed and guide say `https://www.notion.so/my-integrations`; docs say "Developer portal → Build → Public connections")?
  - Installation scope choices "Any workspace" / "Selected workspaces only", and does the form warn that the choice can't be changed later?
  - Any PKCE or token-lifetime setting visible? (Both are unknowns in `data/guides/notion.json`.)
- **Screenshots:** `docs/screenshots/notion-*.png`
- **Cleanup:**

### Slack — app from manifest (optional)
- **When (IST):**
- **Attempted:** create from a manifest, open Manage Distribution, check the Marketplace submission page's estimated review time
- **Completed / Stopped because:**
- **Screenshots:** `docs/screenshots/slack-*.png`
