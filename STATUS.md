# Status

**Last updated:** 2026-10-20 06:55 IST
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

- **T-014 (2026-10-28, post-submission): automated setup attempts.** New `attempt` step (`lib/agent/attempt.ts`): fake-code exchange, remote MCP discovery, unparseable client-registration request. Facts written as `tested` / `testKind: "attempt"`; "Setup attempts" section on the guide and in Markdown. `npm run check` green (254 tests), e2e 5/5. Live check on 10 apps logged in `docs/verification-log.md`. T-011 (human-logged-in console attempts) stays cut.

- **T-015 (2026-10-28): real setups.** Linear set up for real end to end through its MCP server (`scripts/verify-mcp-setup.ts`, record in `docs/evidence/`). GitHub app creation verified; real sign-in pending. Notion pending. Production LLM moved to Azure OpenAI (`gpt-6-sol`) via `OPENAI_BASE_URL`.
- **T-016 (2026-10-28): repo completeness.** `docs/USAGE.md`, `docs/screenshots/` (captured from production), author metadata, site footer, README in Aryan's voice; fixed the "no wait wait" chip and the stale `/generate` steps list.

## In progress

**05:30 block boundary.** Code complete; all merged work is pushed (origin/main d628e3f). T-009 QA is running on the preview.

**Done since 03:00**
- All tasks merged and verifier-approved: T-002, T-003, T-004, T-005, T-006a/b, T-007, T-008 docs, T-013, plus QA fixes QA-1…QA-17 (open: QA-10(2), QA-12, the QA-13 Teams residual; accepted: QA-3/5/6/16).
- **LLM switched to the Claude API** (no Gemini key): `claude-opus-5-5`, effort medium, `web_search_20260209`, pause_turn handling, server-side refusal fallback, per-attempt hard deadline, abort at deadlines.
- **T-011 cut at 03:30**: setup attempts not performed; SPEC §14 #7 = FAIL (cut). GitHub and Notion stay `verified`.
- **Vercel**: project `aryn7/oauth-atlas` (Hobby), linked via CLI, no Git integration (no auto-deploys). Env set as secrets: `ANTHROPIC_API_KEY`, Upstash `KV_REST_API_URL/TOKEN`.
- **Preview** https://oauth-atlas-qwv4suwb6-aryn7.vercel.app (protected): real Miro run done in 168 s (34 claims, 0 downgraded, 25 primary); Calendly 127 s; Miro repeat is a cache hit (8 s). Demo cache is warm in Upstash.

**Incident, 04:3x**: Vercel assigned the project's FIRST deploy to production (https://oauth-atlas.vercel.app) without a `--prod` OK. That deploy also uploaded `.env` (Anthropic key) and `claude-kit.zip` into its stored source, because there was no `.vercelignore`. The key is not in client JS; the source is team-visible only. Fixed: `.vercelignore` added (d628e3f), and the clean preview is verified to have no `.env`. **Pending human decision:** delete the contaminated prod deployment, rotate the key, and choose when to promote the clean build.

**Cut lines at 05:30:** 05:00 (real LLM) is met. 05:30 (preview deploy) is met, so no feature freeze is triggered beyond fixes only.


**06:55 update: SHIPPED.** Prod https://oauth-atlas.vercel.app passed e2e 5/5 against prod and the incognito smoke (all routes 200, no secrets in the bundle, /.env and /.git 404). Demo guides regenerated live on prod at 06:48: Miro 152 s (run 69bfaa60-c9de-4c89-94c2-f213051c16aa), Calendly 116 s (run 9e60428c-49f3-46c6-a8fb-e1fbb4a1653c). Both are clean, with "Skipped 1 non-public URLs" (QA-18 confirmed live) and 0 off-domain primaries; the cache serves them. No P0 or P1 open. SPEC §14: all PASS except #7 (T-011 cut, disclosed). Open P2s: QA-10(2), QA-12, the QA-13 residual, QA-19, QA-20, QA-22(2).
- Human, before submission: rotate the Anthropic key, make the repo public, stop the port-3100 server, rehearse with docs/demo-script.md, submit.

**06:10 update: PRODUCTION LIVE** at https://oauth-atlas.vercel.app (dpl_3cddrZeGFk1auywQKr7wb9pRs47f, from main b343790), promoted under the human's option-(c) approval after every gate passed (verifier APPROVE on 21aeccf; check 3x green with 236 tests; e2e 5/5; final preview smoke 11/11 routes at 200, no .env in files). The contaminated first deploy (dpl_HdGd…) has been **removed**. Public smoke without auth: all routes 200, "100 tracked", 100 cards, no MOCK banner.
- T-009 QA (preview): no P0. QA-18 (SSRF, P1) fixed in b632dcd plus 21aeccf. QA-21 fixed. Open P2s: QA-19 (guessed-website domains), QA-20 (nonexistent app shows as done/5), QA-22(2) (DNS rebinding), QA-10(2), QA-12, the QA-13 Teams residual.
- Remaining: ~06:45 forced Miro/Calendly regeneration on prod (clears the stale localhost unknowns and confirms SSRF live); verifier e2e against prod; then buffer, demo rehearsal and submission (human).
- Human, open: rotate the Anthropic key (recommended), repo visibility (the /evidence links need public), stop the stale port-3100 server.

**Earlier next:** T-009 QA (verifier, 05:25–06:20) → P0 fixes → prod at about 06:30 on the human's explicit OK → incognito smoke test.

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
