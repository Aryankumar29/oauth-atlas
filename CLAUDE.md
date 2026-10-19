# CLAUDE.md — OAuth Atlas (OAuth Agent)

> Project-specific instructions. Read this first, then `SPEC.md`, `TASKS.md`, and `STATUS.md`. Keep this file under ~150 lines.

## One-line summary

Decision-grade OAuth setup and approval guides for developers building AI agents — a searchable library plus a live agent that researches any app and generates a shareable guide.

## Domain

Technical product / developer tooling / AI integrations. It exists because provider docs explain how to configure OAuth but not whether a developer can ship, how long approval takes, what blocks them, or what to do next.

## Current phase

Phase 0 — scaffold and core guide schema. Target: a working take-home MVP in 6–8 focused hours. Then Phase 1 — live generation and the 100-app library.

## Stack & tools

- Next.js 16.4.2 (App Router), React 19, TypeScript, Tailwind CSS 4, ESLint, npm.
- Zod for schemas.
- Planned: SQLite/Postgres + Drizzle (or JSON for v0), Vercel AI SDK + Anthropic/OpenAI, Tavily/Brave search, Playwright optional.
- Deploy: Vercel; fallback Fly.io/Railway if generation exceeds serverless limits.
- Repo folder: `OAuth Agent`; package slug: `oauth-atlas`; memory prefix: `oauth-agent`.

## Key decisions made

- Decision-first guide, not a docs mirror — `DECISIONS.md` ADR-001.
- One pipeline, two modes: batch library + live generation — ADR-002.
- Claim-level evidence tiers: tested / primary / secondary / inferred — ADR-003.
- Two timelines: time to first test user vs. time to public launch — ADR-004.
- Quality tiers for the 100-app library: tested / verified / indexed — ADR-005.
- No auth, billing, token storage, or completed provider approvals in the MVP — ADR-006.
- JSON files for the v0 library; add a database only if needed — ADR-007.

## Constraints

- 6–8 hour build budget; demo 3–5 varied apps plus one live-generated app.
- No paid accounts, no production domains, no completed provider approvals.
- Credentials never enter the repo; use `.env.local`. Redact screenshots and logs.
- Do not automate account creation, accept legal terms, or bypass provider review.
- Live generation must be labeled as unverified until checked. Never invent approvals or review times.

## What I want from Claude on this project

Implementation help, code review, and agent orchestration. Be proactive on the MVP, but keep scope tight. Prefer working vertical slices over broad scaffolding. When making content claims, cite sources and mark confidence. Ask before changing the guide schema or the demo app set.

## Active TODOs / next steps

1. Finalize guide schema and seed data — T-001.
2. Build the library page with filters and guide cards — T-002.
3. Build the guide detail page with verdict, timeline, scopes, blockers, and evidence — T-003.
4. Add 5 demo guides with sources — T-004.
5. Build the live generation API and streaming UI — T-005.
6. Add evidence panel, verification log, and corrections — T-006.
7. Seed 100 apps and add the batch generation script — T-007.
8. Deploy, README, and demo script — T-008.
9. Independent QA pass — T-009.

## Out of scope (don't suggest)

- Production OAuth token storage or a full auth platform.
- User accounts, billing, admin panels.
- 100 hand-written guides.
- Browser automation for every provider.
- Completed provider approvals.
- A custom design system or a mobile app.

## Team workflow

- **Grokbot** — coordinator/PM. Owns `TASKS.md`, `STATUS.md`, acceptance criteria, merge order. No code unless a small fix.
- **Claude Code Opus 5.5** — lead builder. Owns app code, UI, agent pipeline, tests. One branch per task.
- **Fable 5.1** — independent verifier. Reviews diffs, checks sources, red-teams claims. Never reviews its own code.
- **Human** — accounts, legal acceptance, final submission, demo narration.
- The repo is the source of truth, not chat. Update `STATUS.md` after each block.
- One writer per file area; no concurrent edits to the same files.

## Commands

- `npm run dev` — local dev server.
- `npm run build` — production build.
- `npm run lint` — ESLint.
- `git status` / `git diff` — inspect work before handoff.

## External references

- Assignment brief: `docs/assignment.md`
- Product spec: `SPEC.md`
- Task board: `TASKS.md`
- Decisions: `DECISIONS.md`
- Verification: `docs/verification-log.md`, `docs/corrections.md`
- Demo script: `docs/demo-script.md`
- Next.js version note: read `AGENTS.md` and `node_modules/next/dist/docs/` before changing framework code.

---

## Memory convention reminder

Per-project memories use the prefix `proj-oauth-agent_<topic>.md` under `C:\Users\arygu\.claude\projects\C--WINDOWS-System32\memory\`. The folder is `OAuth Agent`; the slug is `oauth-agent`.
