# Status

**Last updated:** 2026-10-20 03:00 IST
**Phase:** 1, ship day (build starts 01:30). **Prod target: 07:00 IST**, buffer to 08:30.
**Owner:** Grokbot (coordination), Claude Code lead + subagents (build), verifier on Fable (verification), Human (accounts/demo)

## Done

- Scaffolded Next.js 16.4.2 + React 19 + TypeScript + Tailwind 4 + Zod. `npm run build` passes (28 routes).
- 20 seed apps and `lib/schema.ts` v0. Initial home, library, app placeholder, generate placeholder, and evidence pages.
- Research brief → `docs/research.md`.
- SPEC v1.1, TASKS v1.1, and the Claude Code kit:
  - `CLAUDE.md`
  - `.claude/agents/*`
  - `.claude/settings.json`
  - `.env.example`
  - `docs/testing.md`, `docs/claude-prompts.md`, `docs/corrections.md`, `docs/verification-log.md`
- Kit committed to `main` (lead, 01:40). Branch renamed `master` → `main`; remote `origin` = github.com/Aryankumar29/oauth-atlas (private).
- **T-010 merged to `main` (01:45, ahead of the 02:30 target; no cuts).** `npm run check` green (typecheck, lint, 21/21 tests, validate:guides "100 apps, 0 guides", build). Composio 123/211; seed 100 (all `queued`; 70 managed / 29 BYO / 1 unknown). Difficulty fixtures: GitHub 1, Notion 1, Slack 3, Gmail 5 (send-only 3), Instagram 4, Microsoft 3.
  - Contract notes for agents: gate `skipForProfiles` + `difficulty(gates, {profile})`; validate-guides rejects a `verdict.difficulty` that doesn't match `difficulty(gates)`; milestones exactly 3 in order; `requiredFor`/`affects` use milestone ids; `Claim.testKind`; guides have `ownApp` and `oauthConfig`.
  - Lead glue: UI reads migrated to `approvalModel` / `composio.managed`; `npm run check` now includes `build`. `vitest.config.ts` → `vitest.config.mts`.

## In progress

**03:00 block boundary.** About 1h45m ahead of plan. Local `main` is at 92c3449 and is **19 commits ahead of origin (unpushed; awaiting human OK)**. Builders work in worktrees under `Desktop/One Piece/oauth-wt/`.

**Merged to main (all verifier-approved; integrated main green: check 102/102 tests, 5 guides; e2e 5/5 incl. Miro mock):**
- T-010 contracts; T-004 5 guides + T-006a corrections/probe methodology (17/17 primary quotes re-matched)
- T-002 library; T-003 guide page (GuideView, markdown, "up to N days", partial/unknown handling)
- T-006b `/evidence`
- T-005 live generation (SSE, store, probe, Gemini/Anthropic/OpenAI adapters, validator, rate limit, demo cache, cache-guide script) + official-domain hardening
- T-013 Playwright smoke (5 specs) + `docs/qa-report.md`
- fixes: Next 16 Suspense on `/apps/[slug]`; placeholder milestones render "unknown"; Instagram unsourced wording removed

**Open:**
- `fix/T-005-resolve` (pipeline-engineer, cap 03:35): QA-9 P1, `resolveApp("X")` returns Dropbox; QA-10.1 path denylist for Q&A/forum pages.
- T-011 attempts: no notes from human yet. **Cut 03:30:** GitHub/Notion stay `verified`, log says "not performed".
- T-007 batch script and real Gemini runs: blocked on keys.
- T-008 deploy/README: blocked on keys, `vercel link`, repo visibility, Vercel plan (`maxDuration = 300`).

**Cut lines at 03:00:** none triggered. 04:00 (T-003) and 04:30 (live gen end-to-end in mock) are already met. 05:00 (real Gemini) depends on keys.

**Accepted P2s:** typo slugs / unknown run ids return 200 with not-found UI; no `server-only` import (bundle verified clean); `/evidence` links 404 while repo is private.

**Blockers (human):**
- push approval
- stale `next start -p 3100` (PIDs 25504/18744) locking the main checkout's node_modules (stop was denied by the permission classifier)
- keys (Gemini, Upstash) + `vercel link`
- T-011 notes
- repo visibility
- Vercel plan

## Schedule (IST)

| Block | What |
|---|---|
| 01:30–01:45 | Kit commit; keys; lead in plan mode |
| 01:45–02:30 | T-010 contracts + harness (schema-architect) |
| 02:30 | Merge T-010 to `main` (cut line 02:45) |
| 02:30–04:30 | Parallel: T-002/T-003/T-006b (ui-builder), T-005 (pipeline-engineer), T-004/T-006a (guide-researcher), T-013 (verifier, from 03:00), T-011 (human + grokbot, 02:45–03:30) |
| 04:30–05:30 | Integration + real Gemini runs + demo cache + T-007; preview deploy + README (release-engineer) |
| 05:30–06:30 | T-009 QA + P0 fixes |
| 06:30–07:00 | Prod deploy + incognito smoke |
| 07:00–08:30 | Buffer: fixes, demo rehearsal, submit |

## Next 3 tasks

1. **T-010:** contracts, fixtures, test harness, deps, seed 100 (schema-architect, 01:45).
2. **Parallel kickoff at 02:30:** T-002 (ui-builder), T-005a (pipeline-engineer), T-004 (guide-researcher).
3. **T-011:** GitHub + Notion setup attempts (human + grokbot, 02:45).

## Cut-line checkpoints

- **02:45:** contracts.
- **03:30:** attempts.
- **04:00:** guide page.
- **04:30:** live gen.
- **05:00:** real LLM. If it fails, use the demo cache.
- **05:30:** feature freeze.
- **07:00:** prod is what's deployed.

Details are in `TASKS.md`.

## Blockers (human, before 01:45)

- **Keys** go in `.env.local` and Vercel env vars, never committed:
  - `GEMINI_API_KEY` from AI Studio (free)
  - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
  - the Vercel project
  - Until the keys exist, everything runs with `MOCK_LLM=1`.
- **Go-ahead for T-011** at 02:45: GitHub and Notion attempts on your accounts. You log in; the agent fills the forms. Test apps are deleted afterwards, and no secrets appear in screenshots.
- **To verify during the build:**
  - Vercel `maxDuration` on the plan
  - whether Gemini grounding and JSON output can combine in one call (the fallback is two calls)
  - Gemini free-tier rate limits
  - the current Gemini model name (`LLM_MODEL`)
- **Claude Max usage:** parallel subagents can hit usage limits. The fallback is to run every subagent on `sonnet`.

## Demo readiness

- [ ] `npm run check` green on `main`
- [ ] `npm run test:e2e` green (mock)
- [ ] Library: 100 tracked, four filters
- [ ] 5 demo guides: GitHub, Notion, Slack, Gmail, Instagram
- [ ] Difficulty computed in code, tests pass
- [ ] ≥2 recorded setup attempts plus probes on every guide
- [ ] Live generation for Miro/Calendly in under 3 min, persisted, cached, rate-limited
- [ ] Evidence panel + verification log + corrections
- [ ] Deployed URL (incognito)
- [ ] README + demo script

## Notes

- The folder name is `OAuth Agent`; the package slug is `oauth-atlas`.
- Next.js 16 has breaking changes. Read `AGENTS.md` and `node_modules/next/dist/docs/` before editing framework code.
- Vercel's filesystem is read-only at runtime. Live runs go to Redis; curated guides are JSON loaded via static imports.
- Meta and X docs return 403 to simple fetchers. Use the `fetchDoc` fallback chain.
- Windows dev machine: npm scripts must not rely on POSIX-only syntax. Playwright sets `MOCK_LLM` via `webServer.env`, so no `cross-env` is needed.
