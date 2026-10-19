# Verification log

Every entry is dated in IST. The rule for screenshots: **no client secrets visible.** Test apps are deleted or their secrets rotated after the attempt.

## Method
- **Probes (automated, no credentials).** Discovery docs (`/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`, `openid_configuration`), an authorize call with a dummy `client_id` and `redirect_uri=https://example.com/cb`, and console URL reachability. Results are stored per guide as `tested` (kind `probe`). They prove endpoint behaviour, not policy.
- **Attempts (agent-driven, human logged in).** The agent fills the console forms; the human handles login and 2FA. Recorded below.
- **Initial probe run:** 2026-10-20 ~00:45 IST from the Grokbot box. Results are in `docs/research.md` §6.1.

## Entries

### GitHub — OAuth app (T-011)
- **When (IST):**
- **Account type:** personal, free
- **Driver:** grokbot box browser / Claude Code Playwright MCP; human login
- **Attempted:** register an OAuth app at github.com/settings/developers
- **Completed:**
- **Stopped because:**
- **Docs said vs console required:**
  - Up to 10 callback URLs?
  - "Expire user access tokens" on by default?
  - Required fields?
- **Screenshots:** `docs/screenshots/github-*.png`
- **Cleanup:** app deleted / secret rotated

### Notion — public connection (T-011)
- **When (IST):**
- **Account type:** free workspace
- **Driver:**
- **Attempted:** Developer portal → Build → Public connections → Create
- **Completed:**
- **Stopped because:**
- **Docs said vs console required:** required fields, installation scope, capabilities, console URL
- **Screenshots:** `docs/screenshots/notion-*.png`
- **Cleanup:**

### Slack — app from manifest (optional)
- **When (IST):**
- **Attempted:** create from a manifest, open Manage Distribution, check the Marketplace submission page's estimated review time
- **Completed / Stopped because:**
- **Screenshots:** `docs/screenshots/slack-*.png`
