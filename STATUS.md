# Status

**Last updated:** 2026-10-20 02:30 IST
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

**02:30 block boundary.** Phase 1 started 02:05 (main pushed). The builders work in worktrees under `Desktop/One Piece/oauth-wt/{ui,pipeline,guides,verify,review}`. Agent-type worktree isolation did not apply, so the lead created them manually. No branch is merged or pushed yet; each waits for verifier approval in merge order.

| Task | Branch @ sha | State |
|---|---|---|
| T-004 guides (5/5) + T-006a docs | `feat/T-004-guides` @ abc6f02 | done, in verifier review (blocks all merges) |
| T-002 library | `feat/T-002-library` @ a65e85e | **approved** |
| T-003 guide page | `feat/T-003-guide` @ aa97634 | 8f51c01 **approved**; partial-difficulty fix delta in review |
| T-006b `/evidence` | `feat/T-006-evidence` @ 0a2e039 | done, queued for review |
| T-005a+b live generation | `feat/T-005-agent` @ 6cf6152 | done in MOCK_LLM (63 tests); `scripts/cache-guide.ts` pending; GuideView swap after T-003 merges |
| T-013 e2e smoke | `feat/T-013-e2e` @ 607581d | done; 3 pass and 2 fixme until T-004/T-005 land |
| T-011 attempts | — | waiting on human + Grokbot |

- **Cut lines at 02:30:** none apply. Every lane is ahead of its cap. The next checks are 03:30 (T-011: GitHub only) and 04:00/04:30 (already met in mock).
- **Main-only commits since T-010:** 7480a2b (`next typegen` before tsc), a7d447b (`.gitattributes` for snapshot EOL). Not pushed.
- **Content decisions:** Slack prod floor 0 (only upper bounds are published) and Instagram prod floor 9 (community), both with explicit notes. research.md was wrong in four places (GitHub discovery, the Slack 2026-03-03 extension, X Public Utility, Xero dates); see docs/corrections.md.
- **Blockers (human):**
  - A stale `next start -p 3100` (PIDs 25504/18744, started 00:49) locks the main checkout's node_modules, so that checkout needs `npm ci` after it stops. Stopping it was denied by the permission classifier.
  - Repo visibility: the /evidence links 404 while the repo is private.
  - Keys must be in before 04:30.
  - Vercel plan for `maxDuration = 300`.

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
