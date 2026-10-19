# Task Board

**Statuses:** `todo` → `in_progress` → `review` → `done`
**Owners:** `grokbot` (coordination), `claude` (build), `fable` (verification), `human` (accounts/legal/demo)
**Rule:** one task per branch; acceptance criteria are the merge gate.

## T-001 — Finalize guide schema and seed data

- **Owner:** claude
- **Reviewer:** fable
- **Status:** done
- **Depends on:** none
- **Estimate:** 60 min
- **Deliverable:** `lib/schema.ts`, `data/apps.seed.json`, `data/guides/README.md`
- **Acceptance:**
  - Zod schema covers app, verdict, time, requirements, scopes, steps, blockers, evidence, corrections.
  - Types are exported and used by the library.
  - 20 seed apps across at least 5 archetypes.
  - `npm run build` passes.

## T-002 — Build library page with search, filters, and cards

- **Owner:** claude
- **Reviewer:** fable
- **Status:** in_progress
- **Depends on:** T-001
- **Estimate:** 90 min
- **Note:** Basic shell, search, archetype filter, and cards exist. Remaining: difficulty/approval/time/managed/tier filters and the “can test before approval?” badge.
- **Deliverable:** `/apps` route and reusable `AppCard`
- **Acceptance:**
  - Search by name and website.
  - Filters: difficulty, approval model, time, managed OAuth, tier.
  - Cards show one-line verdict and “can test before approval?”
  - Empty state explains how to submit an app.
  - Mobile layout works.

## T-003 — Build guide detail page

- **Owner:** claude
- **Reviewer:** fable
- **Status:** todo
- **Depends on:** T-001
- **Estimate:** 120 min
- **Deliverable:** `/apps/[slug]` route
- **Acceptance:**
  - Verdict strip, fastest path, next actions, top blockers above the fold.
  - Timeline, scope table, requirements, approval checklist, agent/human split.
  - Evidence panel with source, date, status, confidence.
  - Share link and Markdown/print export.
  - Handles missing guide data gracefully.

## T-004 — Add 5 demo guides with sources

- **Owner:** claude (draft) + fable (source check)
- **Reviewer:** fable
- **Status:** todo
- **Depends on:** T-003
- **Estimate:** 150 min
- **Apps:** GitHub, Google, Slack, Notion, Salesforce **or** Plaid
- **Acceptance:**
  - Every guide follows the schema.
  - At least 3 primary sources per guide.
  - Unknowns and confidence are explicit.
  - At least one guide has a real test log.
  - No invented review times or approvals.

## T-005 — Build live generation API and streaming UI

- **Owner:** claude
- **Reviewer:** fable
- **Status:** todo
- **Depends on:** T-001
- **Estimate:** 150 min
- **Deliverable:** `/generate`, `/api/generate`, persisted run
- **Acceptance:**
  - Accepts name or URL.
  - Streams resolve → discover → extract → verify → plan → critique → render.
  - Produces the same guide schema.
  - Shows source count, confidence, and unknowns.
  - Handles no-OAuth, login-wall, timeout, and ambiguous app cases.
  - Live guide is shareable and labeled unverified.

## T-006 — Evidence panel, verification log, corrections

- **Owner:** fable
- **Reviewer:** claude
- **Status:** todo
- **Depends on:** T-003, T-004
- **Estimate:** 60 min
- **Deliverable:** `/evidence`, `docs/verification-log.md`, `docs/corrections.md`
- **Acceptance:**
  - Verification log template and at least 3 planned/actual entries.
  - Corrections log shows before/after and source.
  - Evidence panel links each claim to a source.
  - “What we couldn’t verify” is visible in every guide.

## T-007 — Seed 100 apps and batch generation script

- **Owner:** claude
- **Reviewer:** fable
- **Status:** todo
- **Depends on:** T-001
- **Estimate:** 90 min
- **Deliverable:** `data/apps.seed.json` (100 entries), `scripts/generate-library.ts`
- **Acceptance:**
  - 100 apps across the six archetypes.
  - Status dashboard counts tested/verified/indexed.
  - Script is idempotent and writes to `data/guides/`.
  - At least 20 guides generated or clearly queued.

## T-008 — Deploy, README, demo script

- **Owner:** claude + grokbot
- **Reviewer:** human
- **Status:** todo
- **Depends on:** T-002–T-007
- **Estimate:** 60 min
- **Deliverable:** deployed URL, `README.md`, `docs/demo-script.md`
- **Acceptance:**
  - Deployed app works in incognito.
  - README has setup, decisions, limitations, evidence summary.
  - 5-minute demo script covers library, guide, live generation, evidence.
  - No secrets in repo.

## T-009 — Independent QA pass

- **Owner:** fable
- **Reviewer:** grokbot
- **Status:** todo
- **Depends on:** T-008
- **Estimate:** 45 min
- **Acceptance:**
  - Every MVP acceptance criterion in `SPEC.md` checked.
  - At least 3 source/link checks per demo guide.
  - Bugs filed with file and reproduction steps.
  - Final `STATUS.md` updated.

## Coordination rules

- Grokbot writes the next 3 tasks and keeps `STATUS.md` current.
- Claude implements one task per branch and includes test/build output in the handoff.
- Fable reviews against acceptance criteria and evidence, not style preference.
- The human handles provider accounts, legal acceptance, and final submission.
- If a task exceeds 90 minutes, split it or cut scope.
