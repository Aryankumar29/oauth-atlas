# Architecture

How OAuth Atlas produces and checks a guide. For using it, see the [README](../README.md) and [`USAGE.md`](USAGE.md).

## How live generation works

`app/api/generate/route.ts` streams Server-Sent Events from `runPipeline` (`lib/agent/pipeline.ts`):

1. **Resolve.** Matches the query to the seed list in three tiers: exact name, slug, or alias first, then word-prefix, then substring. Substring matching applies only to queries of 3 or more characters; shorter queries resolve on an exact match only. A pasted URL matches the seed website host first, then the docs/console host, then the registrable domain. An ambiguous match is listed in the guide's unknowns. For an app outside the library the website is guessed from its name (`name.com`); the guess is trusted as an official domain only if its homepage names the app in its title, `og:site_name` or `application-name`, with any redirects staying on that domain (`lib/agent/confirmWebsite.ts`). An unconfirmed guess is listed in the unknowns.
2. **Composio.** Checks whether the app is Composio-managed. Sources in order: the toolkit API (with `COMPOSIO_API_KEY`), the live managed-auth page, then the bundled snapshot `data/composio-managed.json`: 123 managed / 211 bring-your-own toolkits, snapshot 2026-10-20, from https://docs.composio.dev/toolkits/managed-auth.
3. **Discover** and **probe**, run concurrently:
   - **Discover:** a grounded LLM research call, then fetching official docs. A 403 gets a browser User-Agent retry, with the Jina Reader as a fallback. Login walls are detected.
   - **Probe:** credential-free requests (20 s cap) to the provider's discovery, authorize, and console endpoints.
   - **Attempt** (after the probe, 20 s cap; `lib/agent/attempt.ts`): the agent tries the setup steps it can take without an account, and nothing is created.
     - It exchanges a fake code at the token endpoint and reads the error. `code_verifier` demanded first means PKCE is required; HTTP 200 with an error body means errors are in the body.
     - It looks for a remote MCP server at `mcp.<official domain>` (RFC 9728, then RFC 8414 metadata).
     - Where client registration is advertised, it sends a registration request whose body is not JSON. A 400 with no credential demand means registration looks open, so an agent can likely register its own client with no developer console.
     - Code writes these as `tested` facts (`testKind: "attempt"`); the guide shows them under "Setup attempts". Results for 10 real apps: `verification-log.md`.
4. **Extract.** A separate JSON-mode LLM call fills the Zod guide schema (`lib/schema.ts`). If the output doesn't validate, it is retried once; if it still fails, a labeled partial guide is saved instead.
5. **Verify** (`lib/agent/validate.ts`). Checks every claim:
   - A claim stays **primary** only if its source is on an **official host** for that app *and* its quote is found in the doc **fetched from that same URL**. If the quote is there but the host is off-domain (blogs, Composio docs), it becomes **secondary**. Otherwise it becomes **inferred**.
   - User-generated content on official domains is never primary: community and forum subdomains, Q&A and thread paths, Slack workspaces, and arbitrary GitHub repos.
   - `tested` needs a matching probe or attempt record. Probe and attempt facts (e.g. PKCE methods from a discovery document, or PKCE required by the token endpoint) are attached as `tested`.
   - **Difficulty is computed, never generated** (`lib/difficulty.ts`). It is the maximum weight of the gates required for production-ready (self-serve 1 … security assessment / partner program / no self-serve 5). Profile-specific gates (e.g. Gmail `send-only`) are skipped for that profile.
   - Generated guides never claim high confidence. They are `medium` only if they are complete with at least 3 primary evidence items; otherwise `low`.
6. **Render.** Saves `run:{id}` (30-day TTL) and `guide:{slug}`. A partial guide never overwrites a complete one.

**Deadlines.** At the 150 s soft deadline, discovery stops and extraction runs on what was fetched. The guide is marked **partial** and says so in its unknowns. Extraction has a 250 s hard cap. The route sets `maxDuration = 300`.

**Rate limit.** 5 live runs per IP per hour (HTTP 429 after that). Cache hits and mock runs don't count.

**Demo cache.** For the slugs in `DEMO_CACHE_SLUGS` (default `miro,calendly`), `/generate` serves the stored complete `guide:{slug}` instantly, marked "Cached demo guide". "Regenerate live" (`force=1`) runs the pipeline instead.

**Mock mode.** `MOCK_LLM=1` swaps in a mock LLM, recorded HTTP fixtures (unrecorded URLs return 404), and an in-memory store, so no network calls are made and no keys are needed. A `MOCK MODE` banner is shown. Mock runs never write to Redis.

**Providers.** Production runs on **Azure OpenAI** (deployment `gpt-6-sol`) through the OpenAI adapter: `LLM_PROVIDER=openai` with `OPENAI_BASE_URL` set to the Azure v1 endpoint; the web search tool and JSON output both work there. The code default is Anthropic (`claude-opus-5-5` with server-side web search, then a separate JSON extraction call). Gemini (`gemini-2.5-flash` with Google Search grounding) and OpenAI itself are also supported; override the model with `LLM_MODEL`. Settings for each: [`docs/USAGE.md`](USAGE.md#4-self-hosting).

## Batch library generation

`scripts/generate-library.ts` runs the same pipeline over the queued seed apps. It writes `data/guides/<slug>.json` only for guides that pass the SPEC §12 QA gate (`qaGate` in `lib/agent/batch.ts`). The gate requires all of these:
- the guide is not partial
- at least 3 distinct sources, not counting the run's own probe URLs, and at least 1 primary source after validation
- at least one milestone limit is cited, and every gate that drives the difficulty score is cited
- the probe step ran
- the unknowns list is not empty
- every step has an owner

```bash
npx tsx scripts/generate-library.ts --dry-run --limit 3        # report only, writes nothing
npx tsx scripts/generate-library.ts --only miro,calendly        # write data/guides/<slug>.json for passing guides
```

- **Idempotent:** existing guide files are skipped unless you pass `--force`. Curated guides (hand-written, or tier `verified`/`tested`) are never overwritten, even with `--force`. `--limit` must be a positive integer.
- **Mock mode:** `MOCK_LLM=1` is refused without `--dry-run`, because mock output is never published.
- **Isolated store:** batch runs use a memory store, so they never touch the public `guide:{slug}` cache.
- **No auto-publish:** the script never edits `data/guides/index.ts` or the seed. It prints the import lines and the tier change for a human to apply after a spot check.
- **Keys:** real runs need the LLM keys exported in your shell, because `tsx` does not load `.env.local`.
- **Status:** on main, the library still has the 5 curated guides; no batch output has been committed.

## Evidence summary

- Verification log: [`verification-log.md`](verification-log.md). Corrections: [`corrections.md`](corrections.md).
- Curated-guide sources were re-fetched on 2026-10-20 (T-006a), and every quote was string-matched against the fetched page.
- Corrections found during that pass:
  - **GitHub does publish OAuth discovery.** The root `/.well-known/openid-configuration` is 404, but RFC 8414 metadata lives at `github.com/.well-known/oauth-authorization-server/login/oauth`, and OIDC metadata at `github.com/login/oauth/.well-known/openid-configuration`. It is public preview and advertises PKCE S256. Probed: both returned 200.
  - **The Slack 2026-03-03 claim is unsourced.** The claim that the unlisted-app throttle was extended to existing installs on that date has no official source, so it is not in the guide. The throttle as documented applies to new unlisted apps and to new installs.
  - **The X Public Utility exception is unconfirmed.** X's pricing page confirms pay-per-use pricing with no subscriptions, but no longer mentions a Public Utility exception.
  - Also: GitHub allows up to 10 callback URLs and expires user tokens by default (8 h / 6 months); Notion's rate limit is 180/min (600/min on Business and Enterprise); Google CASA tiers are now AL1/AL2.

## Key decisions

- **"Do you need your own OAuth app?" comes first.** Composio already manages OAuth for 123 toolkits (123 managed / 211 bring-your-own, snapshot 2026-10-20, [source](https://docs.composio.dev/toolkits/managed-auth)). Your own app (with its review path) becomes your problem only when you need your brand, custom scopes, or dedicated quota. Each guide says which case you're in.
- **Three milestones.** Dev-ready, pilot-ready, and production-ready each have hands-on hours, wait days, and the limits until the next milestone. Time to first test user is separate from time to public launch.
- **Difficulty is computed from gates**, not judged by an LLM. The scores for the curated guides are regression-tested.
- **Evidence is claim-level.** Statuses are tested / primary / secondary / inferred. Probes and the agent's own setup attempts are the only way to get `tested`.
- **Quality tiers over mass coverage.** 100 tracked apps, 5 curated guides, and live generation for the rest. We don't have 100 thin guides.
- **Provider-agnostic models.** One adapter interface for Anthropic, OpenAI (including Azure OpenAI) and Gemini; production uses Azure OpenAI.
- **Redis (Upstash) for runs and generated guides**, because Vercel's filesystem is read-only. The curated library is static JSON.
- **No token storage, accounts, or billing.** This is a guidance product, not an OAuth provider.

See [`DECISIONS.md`](DECISIONS.md) for the full decision log and [`SPEC.md`](SPEC.md) for the product spec.
