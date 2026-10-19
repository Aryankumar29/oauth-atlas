# OAuth Atlas — Product Spec (v0)

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

Primary: a developer or technical founder building a multi-tenant AI agent or SaaS product that connects third-party accounts.

Secondary: an integration engineer, solutions engineer, or PM who needs to understand the approval path and share it with the team.

The product is not for end users connecting their personal accounts, and it is not a replacement for provider documentation.

## 3. Product thesis

Provider docs answer “how do I configure OAuth?” The product answers:

> **“Can I ship this, how long will it take, what will block me, and what should I do next?”**

That is a decision and sequencing problem, not a documentation problem. The guide is the core object, and evidence is a first-class feature.

## 4. Product principles

1. **Decision before documentation.** Lead with the verdict and fastest path.
2. **Evidence over confidence.** Every important claim has a source, date, and status.
3. **Two timelines.** Time to first test user vs. time to public launch.
4. **Agent does the work; human owns the gate.** Show the split per step.
5. **One pipeline, two modes.** The same pipeline generates the library and live guides.
6. **Shareable by default.** Public URL, clean export, versioned permalink.
7. **Honest coverage.** Quality tiers are visible; no fake approvals or invented waits.

## 5. Core objects

### App

```ts
type App = {
  slug: string;
  name: string;
  website: string;
  category: string;
  archetype:
    | "self-serve"
    | "verification-heavy"
    | "marketplace"
    | "enterprise"
    | "fintech"
    | "long-tail";
  docsUrl?: string;
  consoleUrl?: string;
  managedOAuth: "yes" | "no" | "partial" | "unknown";
  tier: "tested" | "verified" | "indexed";
  lastVerified?: string;
};
```

### Guide

A guide contains:

- **Verdict** — difficulty 1–5, approval model, one-line summary, can-test-before-approval.
- **Fastest path** — managed vs. own app; internal vs. public; test vs. production.
- **Time estimate** — hands-on hours, time to first test user, time to public launch, approval wait, cost, confidence, basis.
- **Requirements** — what to prepare before touching the console; owner (agent/human/both).
- **Scopes** — sensitivity, why needed, review trigger, draft justification.
- **Steps** — phase, actions, owner, time, done-when, artifacts.
- **Blockers** — severity, affected path, workaround, whether an agent can help.
- **Agent tasks / human tasks** — explicit handoff.
- **Unknowns** — what we could not verify.
- **Evidence** — claim-level sources with quote, date, status, confidence.
- **Corrections** — what changed and why.

The canonical Zod schema lives in `lib/schema.ts`. Do not change it without updating this spec and the seed data.

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

- `tested` requires a dated test log or screenshot.
- `primary` means official provider docs, console, policy, pricing, or trust center.
- `secondary` means community reports, changelogs, or reputable third parties.
- `inferred` is model reasoning and must be labeled; never present it as fact.
- `conflicting` means sources disagree; show both.
- `stale` means older than the freshness window (default 90 days).

## 6. Pages and routes

| Route | Purpose |
|---|---|
| `/` | Positioning, search, featured guides, “submit an app” CTA |
| `/apps` | Library with search, filters, and guide cards |
| `/apps/[slug]` | Shareable guide with verdict, timeline, scopes, blockers, evidence |
| `/generate` | Submit a name or URL and watch live generation |
| `/generate/[runId]` | Persisted live-generated guide and run trace |
| `/evidence` | Verification log, corrections, methodology |
| `/api/generate` | Streaming generation endpoint |
| `/api/apps` | Library data endpoint (optional for v0) |

## 7. Library requirements

- Search by app name or website.
- Filters:
  - difficulty (1–5)
  - approval model
  - hands-on time
  - approval wait
  - category
  - managed OAuth availability
  - confidence tier
  - “can I test before approval?”
- Cards show a one-line verdict, not a paragraph.
- Status dashboard: “100 indexed · N verified · M tested.”
- “Submit an app” is always visible.
- Empty states explain what to do next.

## 8. Guide requirements

Above the fold:

- App name and website
- Difficulty, approval model, hands-on time, wait, confidence, last verified
- “Fastest path” decision
- Top 3 next actions
- Top blockers

Below:

- Before you start
- Setup timeline
- OAuth configuration (redirect URIs, scopes, PKCE, token lifetime)
- Scope review risk table
- Approval checklist and reviewer criteria
- Blockers and workarounds
- Agent vs. human split
- Evidence, unknowns, corrections
- Share/export

## 9. Live generation requirements

1. Input: app name or URL.
2. Resolve the app; ask a clarifying question if ambiguous.
3. Stream steps: resolve → discover → extract → verify → plan → critique → render.
4. Produce the same guide schema as the library.
5. Show “Live-generated — verify before relying on it.”
6. Include source count, confidence, and “what we couldn’t verify.”
7. Handle:
   - no public OAuth program
   - login-walled docs
   - multiple products
   - conflicting sources
   - generation timeout
8. Save the run and make the guide shareable.

Target latency: under 3 minutes for the demo; partial results are acceptable if clearly labeled.

## 10. Evidence and verification

Every guide has:

- claim-level citations
- last verified date
- confidence and rationale
- “What we couldn’t verify”
- corrections log
- version history
- “Report an error” link

Verification log entries include:

- app, date, account type
- what was attempted
- what was completed
- where we stopped and why
- screenshot/evidence path
- what the docs said vs. what the console required

## 11. Demo app set

| App | Archetype | Why it is included |
|---|---|---|
| GitHub | self-serve | Happy path; instant OAuth app; testable flow |
| Google | verification-heavy | Sensitive/restricted scopes; verification gate |
| Slack | marketplace | Internal install vs. public distribution |
| Notion | self-serve vs. review | Internal integration vs. public integration |
| Salesforce or Plaid | enterprise/fintech | Business/partner gate; hard blocker |
| Miro or Calendly | long-tail | Live generation on an app outside the library |

## 12. 100-app strategy

Start from the managed OAuth directory and public OAuth provider lists. Classify each app into an archetype. Run the same agent pipeline in batch mode. Apply quality tiers:

- **Tested** — we attempted setup and captured evidence (5–10 apps).
- **Verified** — 3+ primary sources and claim-level citations (30–50 apps).
- **Indexed** — official docs and metadata, lower confidence (remainder).

Batch QA:

- required fields present
- minimum source count
- citation coverage
- time estimate rationale
- no unresolved contradictions
- owner assigned for every step
- unknowns listed

Human spot-check the top 20 and every tested guide. Re-verify quarterly or on report.

## 13. Non-goals

- Production OAuth token storage or a full auth platform
- User accounts, billing, admin
- 100 hand-written guides
- Browser automation for every provider
- Completed provider approvals
- Legal or compliance advice
- A custom design system or mobile app

## 14. MVP acceptance criteria

- [ ] `npm run build` passes.
- [ ] Library lists at least 12 apps with filters.
- [ ] At least 5 guide pages render from the schema.
- [ ] At least 1 guide has a real test log.
- [ ] Live generation produces a shareable guide for an app outside the library.
- [ ] Evidence panel shows source, date, status, and confidence.
- [ ] Verification log and corrections page exist.
- [ ] README explains setup, decisions, and limitations.
- [ ] No credentials or client secrets in the repo.
