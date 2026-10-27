# OAuth Atlas — Claude Code instructions

@AGENTS.md

> AGENTS.md holds the Next.js 16 breaking-change notes. **Before editing any framework code** (routing, route handlers, server/client components, caching, config), read the relevant file in `node_modules/next/dist/docs/`. Do not rely on memory of Next 13–15 APIs.

## What we're building (ship today)
Decision-grade OAuth setup and approval guides for developers building AI agents. It has three parts:
1. **Library** of curated guides, plus 100 tracked apps (most of them `queued`).
2. **Guide page.** Opens with "Do you need your own OAuth app?" (Composio managed status), then a computed difficulty, three milestones (dev-ready, pilot-ready, production-ready), gates, an agent/human split, and evidence.
3. **Live generation** for any app: resolve → composio → discover → probe → attempt → extract → verify → render, streamed over SSE and persisted in Upstash.

Sources of truth:
- `SPEC.md`: product and schema
- `TASKS.md`: tasks, owners, times, cut lines
- `STATUS.md`: current state
- `docs/research.md`: facts. **Never invent provider facts or timelines.**

## Commands
```bash
npm run dev               # local; set MOCK_LLM=1 in .env.local to run without keys
npm run typecheck         # tsc --noEmit
npm run lint
npm test                  # vitest (unit + offline pipeline tests)
npm run validate:guides   # every data/guides/*.json + seed against Zod
npm run test:e2e          # Playwright smoke, MOCK_LLM=1 via webServer.env
npm run check             # typecheck && lint && test && validate:guides && build  ← definition of done
```

## File ownership (stay in your lane)
| Owner | Owns | Must not touch |
|---|---|---|
| schema-architect | `lib/schema.ts`, `lib/difficulty.ts`, `lib/composio.ts`, `lib/agent/types.ts`, `data/apps.seed.json`, `data/composio-managed.json`, `data/guides/index.ts` (initial), `tests/schema.test.ts`, `tests/difficulty.test.ts`, `tests/fixtures/guides/**`, `scripts/validate-guides.ts`, `vitest.config.ts`, `package.json` | `app/**`, `components/**` |
| ui-builder | `app/**` except `app/api/**` and `app/generate/**` internals owned by pipeline, `components/**`, `lib/markdown.ts`, `lib/data.ts`, `tests/markdown.test.ts` | `lib/schema.ts`, `lib/agent/**`, `data/**` |
| pipeline-engineer | `app/api/**`, `app/generate/**`, `lib/agent/**` (not `types.ts` without lead OK), `lib/store.ts`, `scripts/{probe,generate-library,record-fixtures}.ts`, `tests/agent/**`, `tests/fixtures/{http,llm}/**` | `components/guide/**` (reuse `GuideView`, don't fork it), `data/guides/*.json` |
| guide-researcher | `data/guides/*.json` (+ index entries), `docs/verification-log.md`, `docs/corrections.md`, `docs/screenshots/**` | all code |
| verifier | `e2e/**`, `playwright.config.ts`, `docs/qa-report.md` | everything else is read-only; file bugs instead |
| release-engineer | `README.md`, `.env.example`, `docs/{demo-script,deploy,testing}.md`, `vercel.json` | app code (except trivial config) |
| lead | `SPEC.md`, `TASKS.md`, `STATUS.md`, `CLAUDE.md`, merges | — |

Need a change outside your lane, such as a new dependency or a schema field? Ask the lead. Only the lead edits `package.json` after T-010.

## Conventions
- TypeScript strict. Zod is the contract: parse every external input, guide JSON, and LLM output.
- The pipeline uses dependency injection: `runPipeline(input, deps)`, with `deps = { fetch, llm, store, now, emit }`. No hidden globals, so it can be tested offline.
- Difficulty is **only** computed by `lib/difficulty.ts`. Never accept an LLM-provided score.
- Evidence statuses: `tested | primary | secondary | inferred | conflicting | stale`.
  - Probe results are `tested` (kind `probe`) and carry an ISO timestamp. Setup attempts are probes with `kind: "attempt"` and back `testKind: "attempt"` claims.
  - Community timelines are `secondary` and get a badge.
- Guides load through static imports in `data/guides/index.ts`. **No runtime `fs`**, because Vercel's filesystem is read-only.
- Server-only code (LLM keys, Redis) never ships in client components.
- Keep UI plain Tailwind. No new design system.
- Windows dev box: don't write POSIX-only npm scripts.

## Definition of done (every task)
1. The acceptance criteria in `TASKS.md` are met.
2. `npm run check` passes. Paste the tail of its output in the handoff.
3. New logic has tests. Pipeline tests run offline with fixtures.
4. No secrets: never read or print `.env.local`, never commit keys, no client secrets in screenshots.
5. Small commits (`T-xxx: <what>`), one branch per task, rebased on `main`.
6. Append a one-line entry to `STATUS.md` → "Done", or hand that line to the lead if `STATUS.md` isn't in your lane.
7. If you hit the time cap: stop, ship what passes, and list the cuts.
