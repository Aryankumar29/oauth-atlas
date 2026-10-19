# OAuth Atlas

**Decision-grade OAuth setup and approval guides for developers building AI agents.**

Provider docs tell you how to configure OAuth. OAuth Atlas tells you whether you can ship, how long it will take, what will block you, and what to do next — with sources.

> Status: scaffold. The first working slice is being built. See `STATUS.md` and `TASKS.md`.

## Why this exists

A developer building an agent needs users to connect third-party apps. That means creating an OAuth app, configuring scopes and redirects, testing with users, and sometimes waiting weeks for provider review. The hard part is rarely the OAuth code. It is knowing:

- whether to use a managed OAuth app or create your own
- which scopes trigger review
- whether you can test before approval
- how much hands-on work is required
- how long the wait will be
- what will block launch
- what to do next

Today that answer is assembled from docs, blogs, forums, and trial and error. OAuth Atlas turns it into a shareable guide.

## What the product does

1. **Library** — searchable guides for apps, filterable by difficulty, approval model, time, and confidence.
2. **Guide** — verdict, fastest path, timeline, scopes, blockers, agent/human split, and evidence.
3. **Live generation** — submit an app name or URL; an agent researches it and produces a shareable guide in real time.
4. **Evidence** — every important claim has a source, date, status, and confidence. Unknowns are visible.
5. **100-app library** — one batch pipeline generates coverage at scale, with tested/verified/indexed tiers.

## Quickstart

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

```bash
npm run build
npm run lint
```

## Planned architecture

```
Input (name/URL)
  → Resolve app
  → Discover sources (docs, console, policy, well-known metadata)
  → Extract claims (quote + URL + date)
  → Verify (primary source? current? contradictory?)
  → Plan guide (schema, time model, blockers, agent/human split)
  → Critique (coverage, citations, consistency)
  → Render (web guide, Markdown/PDF, share link)
```

- Next.js App Router + TypeScript + Tailwind.
- Zod schema for apps, guides, evidence, and runs.
- JSON files for the v0 library; database only if needed.
- LLM + search API for live generation; no secrets in the repo.
- Evidence tiers: `tested`, `primary`, `secondary`, `inferred`, `conflicting`, `stale`.

## Key decisions

- **Decision-first, not docs-first.** Every guide leads with a verdict and next actions.
- **Two timelines.** Time to first test user is separate from time to public launch.
- **One pipeline, two modes.** Batch for the library, live for submitted apps.
- **Evidence is a feature.** Claims have sources, dates, and confidence.
- **Quality tiers over fake coverage.** `tested` / `verified` / `indexed` are visible.
- **Explicit agent/human handoff.** Agents research, draft, configure, and test; humans own accounts, legal acceptance, payment, and final submission.
- **No token storage in the MVP.** This is a guidance product, not an OAuth provider.

See `DECISIONS.md` for the full ADR log.

## Demo plan

| App | What it shows |
|---|---|
| GitHub | Instant self-serve OAuth; testable flow |
| Google | Sensitive/restricted scopes; verification gate |
| Slack | Internal install vs. public distribution |
| Notion | Internal vs. public integration review |
| Salesforce or Plaid | Enterprise/partner gate |
| Miro or Calendly | Live generation for an app outside the library |

## Repository map

```
app/                  Next.js routes
components/           UI components
lib/                  Schema, data access, time model, agent pipeline
data/                 Seed apps and guide JSON
scripts/              Batch generation and verification
docs/                 Assignment, verification log, corrections, evidence, prompts
CLAUDE.md             Instructions for Claude Code
SPEC.md               Product and technical spec
TASKS.md              Task board and acceptance criteria
DECISIONS.md          ADR log
STATUS.md             Current state and next actions
```

## Evidence and limitations

- No provider approvals will be completed for this take-home.
- No paid accounts or production domains will be used.
- Setup attempts are limited to free tiers and test users.
- Time estimates are ranges with a stated basis, not guarantees.
- Live-generated guides are drafts until verified.
- Some provider docs are login-walled, stale, or contradictory.
- Not all 100 guides will be equally verified; tiers are shown in the UI.
- This is not legal or compliance advice.

## Team workflow

- **Grokbot** — coordinator/PM: backlog, acceptance criteria, merge order.
- **Claude Code Opus 5.5** — lead builder: app, UI, pipeline, tests.
- **Fable 5.1** — independent verifier: source checks, red-team, QA.
- **Human** — provider accounts, legal acceptance, final submission.

The repo is the source of truth. Update `STATUS.md` after each work block.
