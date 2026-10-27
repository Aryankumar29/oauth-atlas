# OAuth Atlas — Product Spec (v1.1, ship-day)

> v1 changes: three milestones, Composio "do you need your own app?" opener, gate-based deterministic difficulty, automated probes + recorded setup attempts, fixed demo set, Redis persistence, Gemini default LLM, trimmed library. Facts come from `docs/research.md` (checked 2026-10-20).
>
> v1.1 (01:15 IST) changes:
> - added conditional-gate rule and the Gmail default scope profile
> - code layout (`lib/agent/*`) and dependency-injection pipeline
> - `MOCK_LLM` offline mode
> - Upstash env names
> - cached demo guides and a rate limit for the public link
> - testing criteria

## 1. Problem

A developer building an AI agent needs each user to connect a third-party app. Before launch, the developer may need to create an OAuth app with the provider, configure it, and get it approved. Today they piece together provider docs, blogs, forums, and trial-and-error. They cannot easily tell:

- whether to use a managed OAuth app or create their own
- which scopes trigger review
- whether they can test with real users before approval
- how much hands-on work is required
- how long the approval wait will be
- what will block them, and what to do next

The result is wasted engineering time, over-broad scopes, late-discovered launch blockers, and delayed launches.

## 2. Target user

**Primary:** a developer or technical founder building a multi-tenant AI agent or SaaS product that connects third-party accounts, often already on Composio managed auth and about to need their own OAuth app.

**Secondary:** an integration engineer, solutions engineer, or PM who needs to understand the approval path and share it with the team.

The product is not for end users connecting their personal accounts, and it is not a replacement for provider documentation.

## 3. Product thesis

Provider docs answer "how do I configure OAuth?" The product answers:

> **"Can I ship this, how long will it take, what will block me, and what should I do next?"**

Creating a client ID takes minutes almost everywhere. The real cost is the gates between "works for me" and "works for any user": review, verification, security assessment, partner approval, payment, and caps or throttles applied until you are listed. That is a decision and sequencing problem, not a documentation problem. The guide is the core object, and evidence is a first-class feature.

## 4. Product principles

1. **Decision before documentation.** Lead with the verdict and fastest path.
2. **Start with "do you need your own app?"** Composio may already manage it. Say when it stops being enough.
3. **Evidence over confidence.** Every important claim has a source, date, and status.
4. **Three milestones.** Dev-ready → pilot-ready → production-ready, each with hands-on time, wait range, and basis.
5. **Difficulty is computed, not generated.** Code derives it from gates. The LLM never picks the score.
6. **Agent does the work; human owns the gate.** Show the split per step.
7. **One pipeline, two modes.** The same pipeline generates library guides and live guides.
8. **Shareable by default.** Public URL, Markdown export.
9. **Honest coverage.** Tiers are visible. No fake approvals, invented waits, or mass low-quality guides.

## 5. Core objects

The canonical Zod schema lives in `lib/schema.ts`. Do not change it without updating this spec and the seed data. The v1 additions are below.

### App

```ts
type App = {
  slug: string;
  name: string;
  website: string;
  category: string;
  approvalModel:
    | "none"                 // self-serve, no review
    | "listing-review"       // works unlisted; marketplace review to scale (Slack, HubSpot, Zoom)
    | "scope-verification"   // per-scope review, maybe security assessment (Google)
    | "app-review"           // app review + business verification (Meta)
    | "partner-program"      // apply for access (LinkedIn)
    | "admin-consent"        // tenant admin consent / publisher verification (Microsoft)
    | "unknown";
  docsUrl?: string;
  consoleUrl?: string;
  composio: {
    toolkitSlug?: string;
    managed: "yes" | "no" | "unknown";  // from Composio managed-auth directory
    checkedAt: string;
  };
  tier: "tested" | "verified" | "generated" | "queued";
  lastVerified?: string;
};
```

Tiers:
- **tested:** a guide plus a real setup attempt.
- **verified:** a guide with ≥3 primary sources, fact-checked by Fable.
- **generated:** produced by the agent and labeled unverified.
- **queued:** a seed entry with no guide yet. Its card offers "Generate now."

### Guide (v1 sections)

- **Do you need your own OAuth app?** Covers:
  - Composio managed status for this toolkit.
  - The generic triggers for bringing your own app (§5.1).
  - The redirect URI instruction: "copy the callback URL from the Composio dashboard (Create Auth Config); don't hard-code it."
- **Verdict:** difficulty 1–5 (computed), approval model, one-line summary, can-test-before-approval.
- **Milestones** (exactly three):

  ```ts
  type Milestone = {
    id: "dev-ready" | "pilot-ready" | "production-ready";
    definition: string;              // e.g. "any Google user, no warning screen"
    handsOnHours: { min: number; max: number };
    wait: { minDays: number; maxDays: number | null };
    basis: "official-sla" | "official-estimate" | "community" | "estimate" | "unknown";
    limitsUntilNext: Claim[];        // e.g. "100 test users; refresh tokens expire after 7 days"
  };
  ```

  - **dev-ready:** works for you and your test users.
  - **pilot-ready:** a limited set of external users or workspaces.
  - **production-ready:** unrestricted public users.
  - **Pilot pain must be explicit.** Examples:
    - Google Testing mode caps you at 100 test users, and authorizations and refresh tokens expire after 7 days.
    - Slack unlisted commercial apps get 1 req/min with max 15 objects on `conversations.history` and `conversations.replies`.
    - Meta Standard Access only works for users who hold a role on the app.
- **Gates:**

  ```ts
  type Gate = {
    type: "self-serve" | "testing-cap" | "listing-throttle" | "sandbox-to-prod"
        | "scope-review" | "marketplace-review" | "admin-consent" | "publisher-verification"
        | "app-review" | "business-verification" | "paid-access"
        | "security-assessment" | "partner-program" | "no-self-serve";
    name: string;
    appliesWhen: string;             // e.g. "only if you request restricted Gmail scopes"
    requiredFor: ("pilot-ready" | "production-ready")[];
    cost?: Claim; duration?: Claim; recurring?: Claim;
  };
  ```

- **Requirements:** what to prepare before touching the console, and the owner (agent/human/both).
- **Scopes:** sensitivity, why needed, review trigger, draft justification.
- **Steps:** phase, actions, owner, time, done-when, artifacts.
- **OAuth config:** redirect URI rules, PKCE, token lifetime and refresh behaviour, rate limits.
- **Blockers:** severity, affected milestone, workaround, whether an agent can help.
- **Agent tasks / human tasks:** the explicit handoff.
- **Probe results:** from the automated probe step (§9).
- **Unknowns:** what we could not verify.
- **Evidence:** claim-level sources with quote, date, status, confidence.
- **Corrections:** what changed and why.

### 5.1 Composio tie-in (shown on every guide)

- Composio's managed-auth directory lists **123 toolkits with Composio-managed OAuth and 211 that need your own OAuth app** (checked 2026-10-20). Source: https://docs.composio.dev/toolkits/managed-auth
- You need your own app when any of these apply (source: https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app):
  - the consent screen must show your brand, not "Composio"
  - you need custom scopes
  - you need your own rate quota, because managed apps share quota
  - you need polling faster than 15 minutes, the managed minimum
  - you connect to a custom or self-hosted instance
  - enterprise customers require your branding end-to-end
- **Switching to your own app affects new connections only.** Existing connected accounts stay on the old auth config until users re-authenticate. Source: https://docs.composio.dev/docs/authentication/white-labeling-authentication
- **Snapshot:** `data/composio-managed.json`, parsed from `https://docs.composio.dev/toolkits/managed-auth.md` and stamped with `checkedAt`. Live runs re-fetch it. `COMPOSIO_API_KEY` is optional; when present, the pipeline calls `GET /api/v3.1/toolkits/{slug}` and reads `composio_managed_auth_schemes`.

### 5.2 Difficulty (deterministic, `lib/difficulty.ts`)

```
difficulty = max(weight[g.type]) over gates where g.requiredFor includes "production-ready"
             (default: 1 if there are no such gates)

weights:
  self-serve 1
  testing-cap 2 · listing-throttle 2 · sandbox-to-prod 2 · paid-access 2
  scope-review 3 · marketplace-review 3 · admin-consent 3 · publisher-verification 3
  app-review 4 · business-verification 4
  security-assessment 5 · partner-program 5 · no-self-serve 5

labels: 1 Instant · 2 Easy · 3 Moderate · 4 Hard · 5 Very hard
```

- **Conditional gates do not score.** A gate that only applies in some setups (for example, GitHub org OAuth restrictions, or Google restricted scopes for a send-only app) gets `requiredFor: []` and an `appliesWhen` text. It renders in the guide but does not count toward difficulty.
- **Gmail's default profile is read/modify,** which uses restricted scopes and scores 5, because that is what AI agents typically need. The guide also shows "send-only path: 3", computed with `difficulty(gates, { profile: "send-only" })`.
- The function is pure, and unit tests cover the demo fixtures. Expected scores:
  - GitHub 1
  - Notion 1
  - Slack 3 (marketplace review needed to escape the throttle)
  - Gmail 5 with restricted scopes, 3 with `gmail.send` only
  - Instagram 4
  - Microsoft 3
- The guide also shows `rationale`: the gates that drove the score.
- If the LLM emits its own difficulty, discard it.

### Evidence

```ts
type EvidenceStatus =
  | "tested"
  | "primary"
  | "secondary"
  | "inferred"
  | "conflicting"
  | "stale";
```

Rules:

- **`tested`** requires a dated test log, a screenshot, or a **timestamped probe record** (`{ url, method, status, redirect?, observed, at }`).
  - Probe-derived claims cover only endpoint behaviour, never policy.
  - Every tested claim says which kind it is: `probe` or `attempt`.
- **`primary`** means official provider docs, console, policy, pricing, or trust center.
- **`secondary`** means community reports, changelogs, or reputable third parties. Forum and Reddit timelines render with a "reported by developers, not a commitment" badge (for example, Meta App Review taking about 20 days).
- **`inferred`** is model reasoning and must be labeled. Never present it as fact.
- **`conflicting`** means sources disagree; show both.
- **`stale`** means older than the freshness window (default 90 days).
- **Validator:** a claim marked `primary` must carry a quote that string-matches text actually fetched in that run. If it doesn't, downgrade it to `inferred`.

## 6. Pages and routes

| Route | Purpose |
|---|---|
| `/` | Positioning, search, featured guides, "submit an app" CTA |
| `/apps` | Library with search, filters, and guide cards |
| `/apps/[slug]` | Shareable guide: own-app decision, verdict, milestones, gates, scopes, blockers, evidence |
| `/generate` | Submit a name or URL and watch live generation |
| `/generate/[runId]` | Persisted live-generated guide and run trace (read from Redis) |
| `/evidence` | Verification log, corrections, methodology |
| `/api/generate` | Streaming generation endpoint (SSE) |

`/api/apps` is cut for v1.

## 7. Library requirements

- Search by app name or website.
- Filters (trimmed for v1):
  - difficulty (1–5)
  - approval model
  - managed by Composio (yes/no)
  - tier (tested / verified / generated / queued)
- Cards show a one-line verdict, a "dev-ready → production-ready" time chip, and the Composio-managed badge.
- Status dashboard: "100 apps tracked · N guides · M tested."
- "Submit an app" is always visible. Queued cards link to `/generate?app=…`.
- Empty states explain what to do next.

## 8. Guide requirements

**Above the fold:**
- App name and website.
- The "Do you need your own OAuth app?" box: Composio status, triggers, redirect URI note.
- Difficulty (with rationale), approval model, confidence, last verified.
- A three-milestone strip showing hands-on time, wait range, and basis badge for each.
- Top 3 next actions.
- Top blockers.

**Below the fold:**
- Before you start
- Gates timeline
- OAuth configuration: redirect URIs, scopes, PKCE, token lifetime and refresh, rate limits
- Scope review risk table
- Approval checklist and reviewer criteria
- Blockers and workarounds
- Agent vs. human split
- Probe results, evidence, unknowns, corrections
- Share: copy link, copy as Markdown. Print and PDF are nice-to-have.

## 9. Live generation requirements

1. **Input:** app name or URL.
2. **Resolve the app.** If ambiguous, show the top candidates and let the user pick. No blocking chat.
3. **Stream these steps:**
   1. resolve
   2. **composio** (managed status lookup)
   3. discover (search + fetch official docs)
   4. **probe**
   5. **attempt** (T-014, below)
   6. extract
   7. verify (validator + `lib/difficulty.ts`)
   8. render

   Critique is nice-to-have.
4. **Probe step** (automated, no credentials; results tagged `tested` with an ISO timestamp):
   - GET `/.well-known/openid-configuration`, `/.well-known/oauth-authorization-server`, and the known variants. Intuit, for example, uses `openid_configuration`.
     - Record the authorize and token endpoints, `code_challenge_methods_supported`, and grant types.
   - Hit the authorize endpoint with a dummy `client_id` and `redirect_uri=https://example.com/cb`. Record the status, the redirect target, and the error shape.
     - Google redirects with `authError` = invalid_client.
     - LinkedIn renders `invalid "fake"`.
     - GitHub redirects to login.
   - Check console URL reachability (status, plus whether it redirects to login).
   - Treat a miss as "unknown," never "unsupported." For example, GitHub and Notion publish no discovery doc.
   - Timeout is 5 s per request; the whole step is capped at 20 s.
4b. **Attempt step** (T-014, `lib/agent/attempt.ts`; automated, no account, never creates anything). The agent tries the setup steps it can take itself and records each one as a probe with `kind: "attempt"`:
   - **Code exchange.** POST a fake code with a fake client to the token endpoint (from discovery, else `KNOWN_TOKEN`). The error shape is the result: `code_verifier` demanded first → PKCE required; HTTP 200 with an error body → check the body, not the status; otherwise which check fails first (client or code).
   - **Remote MCP server.** For each official domain, GET `mcp.<domain>/.well-known/oauth-protected-resource` (RFC 9728), then the named authorization server's RFC 8414 metadata; without protected-resource metadata, try the MCP host's own metadata.
   - **Client registration.** Where a `registration_endpoint` is advertised (MCP or main OAuth server), POST a body that is not JSON, so nothing can be registered. A 400/422 OAuth or plain-text error with no credential demand → registration looks open (evidence confidence `medium`); 401/403 → protected; 404/405 → unavailable; a generic HTML page, 5xx or anything else → inconclusive, listed in unknowns.
   - Every URL passes the SSRF guard; redirects are never followed. Same caps as the probe step (5 s per request, 20 s per step). It runs after the probe step, in parallel with discovery.
   - **Code, not the LLM, writes the facts:** PKCE required becomes `oauthConfig.pkce` with `status: "tested"`, `testKind: "attempt"`; the MCP server and registration result become `tested` evidence; open registration becomes the first agent task. The validator accepts `tested` only when an attempt or probe record backs it.
5. Produce the same guide schema as the library.
6. Show "Live-generated — verify before relying on it."
7. Include source count, confidence, probe results, and "what we couldn't verify."
8. Handle these cases:
   - no public OAuth program: say so, with difficulty 5 / `no-self-serve`
   - login-walled docs
   - multiple products
   - conflicting sources
   - generation timeout
9. **Fetch fallback chain:**
   1. plain `fetch`
   2. retry with a browser User-Agent
   3. reader service (`r.jina.ai/…`, optional key) for JS-rendered or blocking sites
   4. mark the source "unreachable"

   Meta and X docs return 403 to simple fetchers but work with a browser UA. Xero pricing is JS-rendered. A headless browser is out of scope on Vercel.
10. **LLM:**
    - Default is the **Gemini API** (free Google AI Studio key) with **Google Search grounding**.
    - Switch providers with `LLM_PROVIDER=gemini|anthropic|openai`.
    - **Pattern:** a grounded research call (search plus our own fetches), then a separate extraction call with a JSON schema, validated by Zod. If validation fails, retry once, then save a partial result. This assumes grounding and strict JSON output may not combine in one call. [verify on build]
11. **Persistence:**
    - Store runs in **Upstash Redis / Vercel KV**, because the Vercel filesystem is read-only. Keys:
      - `run:{id}` holds status, steps, partial guide, and trace.
      - `guide:{slug}` holds the latest guide.
    - Each step writes to Redis as it completes, so a refresh or timeout still shows partial results.
    - Local dev falls back to an in-memory store.
12. **Architecture:**
    - The pipeline lives in `lib/agent/*`. It is a pure orchestrator `runPipeline(input, deps)` with injected dependencies: `{ fetch, llm, store, now, emit }`. Tests swap in fakes, so no keys or network are needed.
    - Provider adapters live in `lib/agent/llm/{gemini,anthropic,openai,mock}.ts`, and the store in `lib/store.ts`.
13. **`MOCK_LLM=1` (offline demo/test mode):**
    - The LLM is replaced by `mock.ts`, which uses fixtures in `tests/fixtures/llm/`.
    - Network calls are served from recorded HTTP fixtures in `tests/fixtures/http/`.
    - The store uses memory when the Upstash vars are absent.
    - The UI shows a "MOCK MODE" banner, so a mocked run is never passed off as real.
14. **Public-link protection:**
    - **Demo cache:** Miro and Calendly guides are pre-generated and stored as `guide:{slug}`. `/generate` shows the cached guide with "generated at …" plus a Regenerate button, so the live demo works even if the LLM quota fails.
    - **Rate limit:** at most 5 live runs per IP per hour, as a Redis counter.
15. **Timeouts:**
    - Route `maxDuration` is set to the plan's limit. [verify Vercel plan limit]
    - Soft deadline is 150 s. When it hits, stop discovery, extract from what we have, and mark the result `partial: true` with unknowns listed.

Target latency: under 3 minutes for the demo app. Partial results are acceptable if clearly labeled.

**Env vars** (in `.env.local` / Vercel; never committed):
- `GEMINI_API_KEY`
- `LLM_PROVIDER`
- optional: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (if the Vercel integration provides `KV_REST_API_*` instead, map them across)
- `LLM_MODEL` (optional; overrides the default model name, so check the provider's current model list)
- `MOCK_LLM` (`1` = offline mock mode)
- optional: `JINA_API_KEY`, `COMPOSIO_API_KEY`

## 10. Evidence and verification

Every guide has:

- claim-level citations
- last verified date
- confidence and rationale
- probe results (timestamped)
- "What we couldn't verify"
- a corrections log
- a "Report an error" link (a mailto or GitHub issue link is fine)

Version history is cut for v1. Show `generatedAt` / `lastVerified` only.

**Verification log** (`docs/verification-log.md`) entries include:

- app, date/time (IST), account type
- driver: agent-in-browser with a human-logged-in session, or human
- what was attempted
- what was completed
- where we stopped and why
- screenshot path (`docs/screenshots/…`), **with no client secrets visible**
- what the docs said vs. what the console required

**Recorded real attempts for v1:** GitHub (OAuth app), Notion (public connection), and optionally Slack (app from manifest plus the distribution page). The human logs in and handles 2FA; the agent drives the forms. Delete the test apps or rotate their secrets afterwards.

## 11. Demo app set (fixed)

| App | Approval model | Composio | Why included | Milestones (draft, see research.md) |
|---|---|---|---|---|
| GitHub | none | managed | Happy path; GitHub App vs OAuth app; org access restrictions | All three same-day |
| Notion | none | managed | Instant public connection; users grant per page | All three same-day |
| Slack | listing-review | managed | Easy to build; 1 req/min throttle unlisted; Marketplace ≥10 installs, up to 10 bd + up to 10 weeks | Dev: minutes. Production: weeks to about 3 months (official estimate) |
| Google (Gmail) | scope-verification | managed | Testing mode (100 users, 7-day tokens); restricted scopes require annual CASA | Dev: under 1 h. Production: several weeks or more, plus assessor cost (AL1 about $500–3k/yr, secondary) |
| Meta (Instagram) | app-review | managed | **The "weeks of waiting" case:** business verification plus per-permission App Review; professional accounts only | Production: Business Verification up to 14 business days (secondary) plus App Review about 20 days (community) |
| *Stretch:* Microsoft Entra/Graph | admin-consent | managed | Tenant admin consent, publisher verification via Partner Center, Files/Sites consent block | Only if time remains |
| *Stretch:* Salesforce or Plaid | partner/enterprise | Salesforce managed; Plaid not listed | Moved from core | Only if time remains |
| **Live-gen demo:** Miro (backup: Calendly) | — | both managed | An app outside the library, generated live | Under 3 min |

## 12. 100-app strategy

- **`data/apps.seed.json`** holds 100 entries. Build it from Composio's managed and bring-your-own lists plus well-known OAuth providers, with `composio.managed` set from the snapshot.
- **`scripts/generate-library.ts`:**
  - Runs the same pipeline in batch.
  - Is **idempotent**: it skips slugs that already have a guide unless `--force`.
  - Writes to `data/guides/`.
  - Takes `--limit` and `--only`.
- **Ship only about 5–10 guides:** the 5 curated, plus Microsoft if done, plus the live-generated ones.
- **The other ~90 stay `queued`**: listed, filterable, and one click from live generation.
- **We do not publish mass low-quality indexed guides.**
- **Batch QA gate before a guide leaves `queued`:**
  - schema valid
  - ≥3 sources, of which ≥1 primary
  - citation coverage on milestones and gates
  - probe step ran
  - unknowns listed
  - an owner on every step
- Human spot-check every tested and verified guide.

## 13. Non-goals

- Production OAuth token storage or a full auth platform
- User accounts, billing, admin
- 100 hand-written guides, or 100 shipped auto-generated guides
- Browser automation **for every provider**. v1 has only 2–3 recorded, human-supervised attempts.
- Completed provider approvals
- Legal or compliance advice
- A custom design system or mobile app
- Version history, PDF export, and an `/api/apps` endpoint (v1 cuts)

## 14. MVP acceptance criteria (ship today)

**Must-have**
- [ ] `npm run check` (typecheck + lint + unit tests + validate:guides + build) passes, and the app is deployed on Vercel and works in incognito.
- [ ] `npm run test:e2e` passes in `MOCK_LLM=1` mode (library, guide, generate flow).
- [ ] The library lists 100 seed apps with the four filters, and its status counts are correct.
- [ ] 5 guide pages (GitHub, Notion, Slack, Gmail, Instagram) render from the schema. Each has:
  - the "Do you need your own OAuth app?" box
  - three milestones with basis
  - gates
  - unknowns
- [ ] Difficulty comes from `lib/difficulty.ts`, and unit tests on the 5 fixtures pass.
- [ ] Every demo guide has ≥3 primary sources and a probe block with timestamps.
- [ ] At least 2 real recorded setup attempts (GitHub and Notion) in `docs/verification-log.md`, with screenshots.
- [ ] Live generation produces a shareable `/generate/[runId]` guide for Miro or Calendly in under 3 min. It includes the Composio status and probe results, and it is persisted in Redis.
- [ ] A timeout or failure yields a labeled partial guide, not a blank page.
- [ ] Cached Miro and Calendly guides exist, and the rate limit is active on the public deploy.
- [ ] The evidence panel shows source, date, status, and confidence.
- [ ] The README explains setup, key decisions, and limitations.
- [ ] No credentials or client secrets are in the repo or in screenshots.

**Nice-to-have**
- [ ] Slack attempt logged.
- [ ] Microsoft guide.
- [ ] Critique step.
- [ ] Print/PDF export.
- [ ] Reader-service fallback.
- [ ] Batch script has generated more than 0 guides.
- [ ] The `/evidence` page renders a corrections table, rather than linking to markdown.
