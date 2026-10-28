# OAuth Atlas

**Decision-grade OAuth setup and approval guides for developers building AI agents.**

[![CI](https://github.com/Aryankumar29/oauth-atlas/actions/workflows/ci.yml/badge.svg)](https://github.com/Aryankumar29/oauth-atlas/actions/workflows/ci.yml) [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Provider docs tell you how to configure OAuth. OAuth Atlas tells you whether you need your own OAuth app at all, how long approval will take, what will block you, and what to do next, with a source for every claim.

- **Use it now:** https://oauth-atlas.vercel.app
- **Call it from your agent:** [`GET /api/guides/{app}`](#2-call-it-from-your-agent)
- **Run your own copy:** [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAryankumar29%2Foauth-atlas&project-name=oauth-atlas&repository-name=oauth-atlas&env=ANTHROPIC_API_KEY&envDescription=Key%20for%20the%20model%20that%20writes%20live%20guides.%20Using%20OpenAI%2C%20Azure%20OpenAI%20or%20Gemini%20instead%3F%20See%20the%20link.&envLink=https%3A%2F%2Fgithub.com%2FAryankumar29%2Foauth-atlas%2Fblob%2Fmain%2Fdocs%2FUSAGE.md%234-self-hosting)

![OAuth Atlas home page](docs/screenshots/01-home.png)

## Why

When your agent needs to act in a user's Slack, Gmail or Linear, the OAuth code is the easy part. What costs you weeks is everything around it:

- Do I need my own OAuth app, or is a managed one (such as Composio's) enough?
- Which scopes trigger a review, and can I test with real users before approval?
- Is this an hour of hands-on work, or six weeks of waiting on the provider?
- What will block launch, and what should I do next?

OAuth Atlas answers those per app, as a guide you can follow and share.

## What a guide gives you

- **"Do you need your own OAuth app?"** first, with the exact triggers that force you onto your own app.
- **Difficulty from 1 to 5**, computed from the provider's gates (review, verification, security assessment…), with the gate that sets it.
- **Three milestones:** dev-ready → pilot-ready → production-ready, each with hands-on hours, the wait you can't speed up, and the limits until the next one.
- **Gates, scopes, requirements and ordered steps**, each owned by the agent, you, or both.
- **Setup attempts** the agent made itself, plus **evidence** for every claim (`tested`, `primary`, `secondary`, `inferred`) and an explicit list of **unknowns**.

| Curated guide | Difficulty | Why |
|---|---|---|
| [GitHub](https://oauth-atlas.vercel.app/apps/github) | 1 Instant | Self-serve, no review |
| [Notion](https://oauth-atlas.vercel.app/apps/notion) | 1 Instant | Public connection with no review |
| [Slack](https://oauth-atlas.vercel.app/apps/slack) | 3 Moderate | Unlisted apps work, but history reads are throttled until Marketplace approval |
| [Instagram](https://oauth-atlas.vercel.app/apps/instagram) | 4 Hard | Business Verification plus App Review per permission |
| [Gmail](https://oauth-atlas.vercel.app/apps/gmail) | 5 Very hard (send-only: 3) | Restricted scopes mean verification plus annual CASA |

100 apps are tracked; any other app gets a guide generated live in about 1–2.5 minutes.

## Three ways to use it

### 1. On the website

Search the [library](https://oauth-atlas.vercel.app/apps), open a guide, or [generate one](https://oauth-atlas.vercel.app/generate) for any app name or URL. Every guide has **Copy link** and **Copy as Markdown**.

### 2. Call it from your agent

A read-only JSON API, open to any origin. `{app}` can be a slug, a name or a URL.

```bash
curl https://oauth-atlas.vercel.app/api/guides               # all 100 tracked apps, with difficulty where a guide exists
curl https://oauth-atlas.vercel.app/api/guides/gmail         # one guide as JSON
curl "https://oauth-atlas.vercel.app/api/guides/slack.com?format=md"      # by URL, as Markdown for an LLM prompt
```

A guide response looks like this (trimmed):

```json
{
  "source": "curated",
  "url": "https://oauth-atlas.vercel.app/apps/gmail",
  "difficulty": { "score": 5, "label": "Very hard", "rationale": ["…security-assessment…"] },
  "guide": {
    "app": { "name": "Gmail", "composio": { "managed": "yes" } },
    "ownApp": { "triggers": ["…"] },
    "verdict": { "summary": "…", "canTestBeforeApproval": true },
    "milestones": [{ "id": "dev-ready", "handsOnHours": { "min": 0.5, "max": 1 }, "wait": { "minDays": 0, "maxDays": 0 } }, "…"],
    "agentTasks": ["…"], "humanTasks": ["…"], "unknowns": ["…"], "evidence": ["…"]
  }
}
```

If no guide exists yet, the API answers `404` with a `generateUrl`. To generate one programmatically, `POST /api/generate` with `{"query": "Strava"}`; it streams Server-Sent Events (`run`, `step`, `done`) and saves the guide, after which `GET /api/guides/strava` returns it. Public generation is limited to 5 runs per IP per hour; host your own copy for more.

A typical agent flow: before asking a user to connect an app, fetch its guide; if `guide.app.composio.managed` is `"yes"` and none of `guide.ownApp.triggers` apply, use managed auth; otherwise show the user `humanTasks` and the production-ready wait. More in [`docs/USAGE.md`](docs/USAGE.md).

### 3. Run your own copy

```bash
git clone https://github.com/Aryankumar29/oauth-atlas.git
cd oauth-atlas
npm ci
cp .env.example .env.local     # set MOCK_LLM=1 to run offline with no keys
npm run dev                    # http://localhost:3000
```

For real live generation, set one model provider in `.env.local`: Anthropic, OpenAI, Azure OpenAI or Gemini (table in [`docs/USAGE.md`](docs/USAGE.md#4-self-hosting)). To deploy, use the **Deploy with Vercel** button above and add an Upstash Redis database so runs persist; details in [`docs/deploy.md`](docs/deploy.md). Requires Node.js 20.9+.

## How it works

`POST /api/generate` runs a pipeline and streams each step:

1. **Resolve** the app; a website guessed for an unknown app is trusted only if its homepage names the app.
2. **Composio:** check whether managed OAuth exists.
3. **Discover:** a model searches for the official docs, which are then fetched.
4. **Probe:** credential-free requests to the provider's OAuth discovery, authorize and console endpoints.
5. **Attempt:** the agent tries setup steps itself, without an account: a fake-code exchange (finds "PKCE required"), a remote MCP server lookup, and a client-registration request that cannot register anything (finds "an agent can register its own client").
6. **Extract:** a model drafts the guide from the fetched docs.
7. **Verify:** code checks every quote against the official page it came from and computes the difficulty. The model never scores and can never mark a claim `tested`.
8. **Render:** the guide is saved at a shareable URL.

Full detail: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Design: [`docs/SPEC.md`](docs/SPEC.md), [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Verify a setup yourself

Scripts that run real, credential-free or human-approved setups and never store tokens ([`docs/USAGE.md`](docs/USAGE.md#3-run-the-setup-checks-yourself)):

```bash
npx tsx scripts/probe.ts linear.app                                         # OAuth endpoint probes
npx tsx scripts/verify-mcp-setup.ts https://mcp.linear.app --out rec.json   # register, sign in, call, revoke via MCP
npx tsx scripts/verify-github-device-flow.ts --client-id <id> --out rec.json
```

Results so far are in [`docs/verification-log.md`](docs/verification-log.md); corrections to common assumptions in [`docs/corrections.md`](docs/corrections.md).

## Limitations

- **Live guides are drafts** until a person checks the sources. They are labeled, never rated high confidence, and their difficulty can vary between runs, because the model extracts the gates that the score is computed from.
- **One real end-to-end setup** so far (Linear, through its MCP server). "Registration looks open" is confirmed for Linear and inferred elsewhere.
- **Review timelines** are community-sourced where providers publish none, and are labeled `secondary`.
- **No provider approvals** were completed while building this, and estimates are ranges with a stated basis, not guarantees. This is not legal or compliance advice.
- **Known edge cases:** a guessed website that is wrong (for example `toggltrack.com` for Toggl) stays untrusted, so that guide loses its primary sources; `github.com/<name>` is treated as official without an ownership check; DNS rebinding between the URL check and the fetch is not fully closed.

## Development

```bash
npm run check      # typecheck, lint, 271 unit tests, guide validation, production build
npm run test:e2e   # Playwright smoke tests in offline mode (first time: npx playwright install chromium)
```

```
app/          pages, the guide API and the streaming generate API
lib/agent/    the pipeline: resolve, composio, discover, probe, attempt, extract, verify; model adapters in llm/
lib/          schema, difficulty, store (Upstash or memory), Markdown export
data/         100 tracked apps, 5 curated guides, Composio managed-auth snapshot
scripts/      verification, library generation and maintenance scripts
tests/, e2e/  unit and offline pipeline tests; browser smoke tests
docs/         usage, architecture, deploy, testing, spec, decisions, research, verification log, evidence, screenshots
```

Contributions are welcome: see [`CONTRIBUTING.md`](CONTRIBUTING.md). Security reports: [`SECURITY.md`](SECURITY.md).

## In my words

I built OAuth Atlas because the hard part of letting an AI agent act on a user's behalf is rarely the OAuth code. It is everything around it, and today you piece that together from docs, forum threads and trial and error. So each guide leads with the decision, not the documentation, and three choices shape the rest: **the model reads, code decides**; **evidence is per claim**, with gaps listed rather than filled; and **the agent tries the setup itself**, so what it finds changes the guidance. For Linear I ran the whole setup for real: the agent registered itself on Linear's MCP server, I approved the sign-in, and it called the server and revoked the token, with no developer console involved.

I built it with AI coding agents doing the implementation and an independent verifier agent reviewing every change, while I owned the product decisions. The original take-home submission is preserved at tag [`v0.1.0-submission`](https://github.com/Aryankumar29/oauth-atlas/tree/v0.1.0-submission), with [`SUBMISSION_NOTES.md`](SUBMISSION_NOTES.md).

— Aryan Kumar ([@Aryankumar29](https://github.com/Aryankumar29))

## License

[MIT](LICENSE) © 2026 Aryan Kumar. Guides summarize public provider documentation with links to the sources.
