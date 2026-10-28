# Security

## Reporting a vulnerability

Please report security issues privately through GitHub's **Report a vulnerability** button (Security → Advisories) on this repository, not in a public issue. Include steps to reproduce. I aim to reply within a week.

## What OAuth Atlas does and doesn't handle

- **No user tokens are stored.** OAuth Atlas produces guidance; it is not an OAuth provider or a token vault. The verification scripts in `scripts/` revoke every token they obtain and never write tokens to disk.
- **Model-provider keys stay server-side.** They are read from environment variables in route handlers only and never reach the browser.
- **Outbound requests are guarded.** Every URL the agent fetches (including URLs a model suggests) must be public `https`; private, loopback and link-local addresses are refused, including after DNS resolution (`lib/agent/urlGuard.ts`). Redirects are followed by hand, and every hop passes the same check.
- **Setup attempts never create anything.** The code exchange uses a fake client and code, and client-registration attempts send a body that cannot be parsed.
- **Public live generation is rate-limited** (5 runs per IP per hour by default).

Known open items: DNS rebinding between the URL check and the fetch is not fully closed.
