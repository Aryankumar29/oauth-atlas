# Decisions

Short ADRs. Add a new entry when a decision is hard to reverse or likely to be re-litigated.

## ADR-001 — Build a decision-grade guide, not a docs mirror

**Status:** Accepted

Provider docs already explain how to configure OAuth. The product wins by answering whether to use a managed or own app, how long approval takes, what blocks launch, and what to do next. Every page leads with a verdict and next actions.

**Consequence:** Content must be opinionated and evidence-backed; we cannot just summarize docs.

## ADR-002 — One pipeline, two modes

**Status:** Accepted

The same agent pipeline runs in batch mode for the library and live mode for submitted apps. Batch mode has human QA and caching; live mode streams and labels output as unverified.

**Consequence:** The guide schema and renderer must be shared. Avoid separate “library content” and “generated content” formats.

## ADR-003 — Claim-level evidence tiers

**Status:** Accepted

Evidence is classified as `tested`, `primary`, `secondary`, `inferred`, `conflicting`, or `stale`. Important claims need a source URL, date, and confidence.

**Consequence:** The UI needs an evidence panel. The agent needs a verifier step. We cannot ship unsourced time estimates as facts.

## ADR-004 — Two timelines

**Status:** Accepted

Every guide reports time to first test user separately from time to public launch. Many providers allow testing with test users before review completes.

**Consequence:** The time model needs both values and a basis. Do not collapse them into one “setup time.”

## ADR-005 — Quality tiers for 100 apps

**Status:** Accepted

The library has `tested`, `verified`, and `indexed` tiers. Tested means we attempted setup; verified means 3+ primary sources; indexed means official docs and metadata only.

**Consequence:** Coverage is honest. The UI shows tiers and filters by them. Do not claim 100 equally verified guides.

## ADR-006 — No auth, billing, or token storage in the MVP

**Status:** Accepted

The MVP is a guide and research product, not an OAuth provider. It does not store access tokens, refresh tokens, or client secrets. There are no user accounts or payments.

**Consequence:** Share links are public by slug. The demo can focus on guidance and evidence, not infrastructure.

## ADR-007 — JSON files for the v0 library

**Status:** Accepted

The first version reads apps and guides from JSON files in `data/`. Add SQLite/Postgres only if live runs, search, or edits require it.

**Consequence:** Fast iteration and easy deployment. Keep the data access layer small so it can be swapped later.

## ADR-008 — Next.js on Vercel, with a fallback for long jobs

**Status:** Proposed

Use Next.js App Router and deploy to Vercel. If live generation exceeds serverless limits, move the generation worker to Fly.io/Railway or use a background job with polling.

**Consequence:** Measure generation time early. Design the UI to support streaming or polling.

## ADR-009 — No account creation or review bypass automation

**Status:** Accepted

Agents may research, draft, configure, and test with consent. They must not create accounts, accept legal terms, submit reviews, or bypass provider checks on someone’s behalf.

**Consequence:** Every guide has an explicit human gate. Test attempts stop at legal/identity/payment boundaries and document why.
