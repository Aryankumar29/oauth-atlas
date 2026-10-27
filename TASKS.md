# Task Board — Ship Day (Tue 20 Oct 2026, IST) · v1.1, starting 01:30

**Statuses:** `todo` → `in_progress` → `review` → `done`
**Owners** (Claude Code subagents are in `.claude/agents/`):
- `lead`: the main Claude Code session. Orchestrates, merges, and keeps STATUS current.
- `schema-architect`
- `ui-builder`
- `pipeline-engineer`
- `guide-researcher`
- `verifier`: runs on the Fable model, as the independent check.
- `release-engineer`
- `grokbot`: coordination outside Claude Code; can drive the box browser for T-011.
- `human`: Aryan Kumar (project owner). Accounts, 2FA, keys, approvals, submission.

**Rules**
- One task per branch (`feat/T-xxx-*`). The merge gate is acceptance criteria plus `npm run check` green.
- Hard cap per task: at the cap, ship what passes and log the rest as a cut.
- Contract-first: nothing parallel starts until T-010 is merged to `main`.
  - Subagents with `isolation: worktree` branch from the default branch, **not** HEAD.

**Goal:** preview by 05:30, **production deployed by 07:00 IST**, buffer 07:00–08:30. Facts come from `docs/research.md`.

## Schedule (IST)

| Time | lead | schema-architect | ui-builder | pipeline-engineer | guide-researcher | verifier | human / grokbot |
|---|---|---|---|---|---|---|---|
| 01:30–01:45 | Copy the kit, commit to `main`, plan mode | — | — | — | — | — | Keys (Gemini, Upstash, Vercel link); go-ahead for T-011 |
| 01:45–02:30 | Review the contract PR | **T-010** contracts, fixtures, harness, deps, seed 100 | — | — | — | — | — |
| 02:30 | **Merge T-010 → main** | — | — | — | — | — | — |
| 02:30–03:00 | Spawn the 4 parallel agents | — | T-002 library | T-005a core | T-004 GitHub, Notion | — | — |
| 03:00–04:00 | Merge as PRs land | — | T-003 guide page + markdown | T-005a → T-005b | T-004 Slack, Gmail, Instagram | T-013 e2e smoke (mock) | **T-011** attempts (02:45–03:30) |
| 04:00–04:30 | Merge | — | T-006b `/evidence` | T-005b finish (probe, extract, validate) | T-006a logs + corrections | Review merged PRs | — |
| 04:30–05:30 | **Integration** (merge order below) | — | Fixes | Real Gemini run (Miro, Calendly) → cache; T-007 batch script | Fold attempt results into the guides | Run the suite on `main` | Vercel env vars |
| 05:30–06:30 | Triage | — | P0 fixes | P0 fixes | Source fixes | **T-009 QA** on preview | Watch a live run |
| 06:30–07:00 | **Prod deploy** | — | — | — | — | Incognito smoke | Approve the deploy |
| 07:00–08:30 | **Buffer:** fixes only | | | | | | Demo rehearsal (T-008 script), submit |

Release-engineer (T-008) works 04:30–05:30 (preview deploy, README, `.env.example`, demo script) and 06:30–07:00 (prod).

**Budget check**
- Critical path is T-010 (45m) → T-005a+b (120m) → integration (60m) → QA + fixes (60m) → prod (30m) = **5h15m**. It fits 01:45–07:00.
- Parallel lanes: ui-builder about 120m, guide-researcher about 120m, verifier about 150m, human about 75m.
- Max plan usage: four parallel subagents burn quota fast. Builders run on `sonnet`, schema and pipeline on `opus`, verifier on `fable`. If usage limits hit, switch every subagent to `sonnet` and keep going.

**Merge order:** T-010 → T-004 (data only) → T-002 → T-003 → T-005 → T-006 → T-013 → T-007 → T-008. A fix branch rebases on `main` before its PR.

## Must-have vs nice-to-have

- **Must-have:**
  - T-010, T-002, T-003
  - T-004 (5 guides)
  - T-005: resolve → composio → discover → probe → extract → verify → render; Redis; partial results; `MOCK_LLM`
  - T-011 (GitHub + Notion)
  - T-013 (e2e smoke)
  - the T-007 seed list (lands in T-010)
  - T-008, T-009
  - the demo cache and rate limit
- **Nice-to-have:**
  - Slack attempt
  - T-012 Microsoft guide
  - critique step
  - reader fallback
  - ambiguity picker
  - print/PDF
  - batch script producing more than 0 guides
  - a rich `/evidence` page

## Cut lines (lead calls these; grokbot double-checks)

| At | If | Then cut |
|---|---|---|
| 02:45 | T-010 not merged | Merge what passes (schema + difficulty + fixtures). Seed-100 moves to integration |
| 03:30 | T-011 not done | GitHub only; Notion in the buffer. The guides stay `verified` |
| 04:00 | T-003 not done | Gates timeline becomes a plain list; only "copy as Markdown" |
| 04:30 | Live gen not end-to-end in `MOCK_LLM` | Drop the reader fallback, ambiguity picker, and critique. Single LLM call |
| 05:00 | Real Gemini fails (quota or grounding) | Ship the cached Miro/Calendly guides plus Regenerate. Discover from known URL patterns without grounding. Note it in the README |
| 05:30 | No preview deploy | Feature freeze; deploy whatever builds |
| 07:00 | Anything open | Prod is what's deployed. The buffer is for fixes only |

---

## T-001 — Finalize guide schema and seed data
- **Owner:** lead · **Status:** done · `lib/schema.ts`, `data/apps.seed.json` (20), `data/guides/README.md`

## T-010 — Contracts, fixtures, test harness (phase 0)
- **Owner:** schema-architect · **Reviewer:** lead · **Status:** todo · **Depends on:** T-001
- **Time:** 01:45–02:30 · **Cap:** 45 min · **Branch:** `feat/T-010-contracts`
- **Deliverable:**
  - `lib/schema.ts` (v1), `lib/difficulty.ts`, `lib/composio.ts`
  - `lib/agent/types.ts` (interfaces only: `PipelineDeps`, `LlmAdapter`, `Store`, `RunEvent`)
  - `data/composio-managed.json`, `data/apps.seed.json` (100), `data/guides/index.ts`
  - `tests/fixtures/guides/*.json`, `tests/schema.test.ts`, `tests/difficulty.test.ts`
  - `scripts/validate-guides.ts`
  - `vitest.config.ts`, `package.json` scripts and deps
- **Acceptance:**
  - The schema matches SPEC §5:
    - `composio`, `approvalModel`, tier
    - three `milestones` (handsOnHours, wait, basis, limitsUntilNext)
    - `gates[]` with `requiredFor` and `appliesWhen`
    - `probes[]`
    - `partial`
  - The old `archetype` and `managedOAuth` fields are migrated.
  - `difficulty()` follows SPEC §5.2, including conditional gates and the profile option. Tests pass:
    - GitHub 1, Notion 1, Slack 3, Gmail 5 (send-only 3), Instagram 4, Microsoft 3
  - The Composio snapshot is dated 2026-10-20 with 123 managed / 211 bring-your-own. `lib/composio.ts` exports `isManaged(slug)`.
  - The seed has 100 apps with `composio.managed` and `approvalModel` (`unknown` is allowed). The 20 existing apps are kept.
  - Deps installed once: `vitest`, `@playwright/test`, `tsx`, `@upstash/redis`, `@google/genai`. Optional providers (`@anthropic-ai/sdk`, `openai`) are installed but loaded via dynamic import.
  - Scripts: `typecheck`, `lint`, `test`, `test:e2e`, `validate:guides`, `check`.
  - `npm run check` passes. **After this task, nobody else edits `package.json`;** dependency requests go to the lead.

## T-002 — Library page
- **Owner:** ui-builder · **Reviewer:** verifier · **Status:** in_progress (shell exists) · **Depends on:** T-010
- **Time:** 02:30–03:00 · **Cap:** 30 min · **Branch:** `feat/T-002-library`
- **Acceptance:**
  - `/apps` has search by name or website and exactly four filters: difficulty, approval model, managed by Composio, tier.
  - Cards show the verdict, a dev → production time chip, and the Composio badge. Queued cards link to `/generate?app=<slug>`.
  - The header reads "100 tracked · N guides · M tested."
  - The empty state has a submit CTA. The layout works on mobile.
  - Guides load via `data/guides/index.ts`, with **no runtime `fs`**.

## T-003 — Guide detail page + Markdown export
- **Owner:** ui-builder · **Reviewer:** verifier · **Status:** todo · **Depends on:** T-010
- **Time:** 03:00–04:00 · **Cap:** 60 min · **Branch:** `feat/T-003-guide`
- **Deliverable:** `app/apps/[slug]/page.tsx`, `components/guide/GuideView.tsx` (reused by `/generate/[runId]`), `lib/markdown.ts`, `tests/markdown.test.ts`
- **Acceptance:**
  - Includes everything in SPEC §8:
    - the "Do you need your own OAuth app?" box first: Composio status, the triggers, "copy the redirect URI from the Composio dashboard", sources
    - difficulty with rationale
    - a three-milestone strip with basis badges
    - next actions and blockers
    - gates, scopes, OAuth config, agent/human split
    - probes, evidence, unknowns
  - Community-sourced timelines carry the "reported by developers" badge.
  - Copy link and copy as Markdown work. `lib/markdown.ts` is snapshot-tested.
  - Missing fields render as "unknown," not a crash.

## T-004 — 5 demo guides with sources
- **Owner:** guide-researcher · **Reviewer:** verifier · **Status:** todo · **Depends on:** T-010
- **Time:** 02:30–04:00 · **Cap:** 18 min per guide, 90 min total · **Branch:** `feat/T-004-guides`
- **Deliverable:** `data/guides/{github,notion,slack,gmail,instagram}.json`, entries in `data/guides/index.ts`
- **Acceptance:**
  - Passes `npm run validate:guides`.
  - Each guide has ≥3 primary sources, re-opened today and quoted.
  - Three milestones with basis, including the pilot limits:
    - Google: 100 test users and 7-day refresh tokens
    - Slack: 1 req/min and 15 objects unlisted
    - Meta: Standard Access is roles-only
  - Probe block from a real run (`npx tsx scripts/probe.ts <domain>` once T-005b lands; a manual `curl` before that), with timestamps.
  - The Composio box, citing the directory.
  - Explicit unknowns. Meta App Review timing is labeled community-sourced.
  - **No fact that is absent from `docs/research.md` or a source fetched today.**

## T-005 — Live generation API + streaming UI
- **Owner:** pipeline-engineer · **Reviewer:** verifier · **Status:** todo · **Depends on:** T-010 (UI shell uses `GuideView` from T-003; stub it until then)
- **Time:** 02:30–03:30 (a) + 03:30–04:30 (b) · **Cap:** 120 min · **Branch:** `feat/T-005-agent`
- **Deliverable:**
  - `app/api/generate/route.ts` (SSE), `app/generate/page.tsx`, `app/generate/[runId]/page.tsx`
  - `lib/agent/{pipeline,resolve,composio,discover,fetchDoc,probe,extract,validate}.ts`
  - `lib/agent/llm/{gemini,anthropic,openai,mock}.ts`, `lib/store.ts`, `scripts/probe.ts`
  - `tests/agent/*.test.ts`, `tests/fixtures/{http,llm}/*`
- **T-005a (core):**
  - The SSE route and `runPipeline(input, deps)` with dependency injection.
  - `lib/store.ts`: Upstash (`run:{id}`, `guide:{slug}`, `rl:{ip}`), with memory as the fallback. Each step persists.
  - The `composio` step.
  - `fetchDoc`: plain → browser UA → (optional) reader → unreachable, with an 8 s timeout.
  - `MOCK_LLM=1` serves fixtures for both the LLM and HTTP.
- **T-005b:**
  - **Probe:** well-known variants; authorize with a dummy `client_id` and `redirect_uri=https://example.com/cb`; console reachability. 5 s per request, 20 s per step. Results are tagged `tested` (kind `probe`).
  - **LLM:** a grounded Gemini research call, then extraction, then Zod; retry once; otherwise save as partial.
  - **Validator:** quote-match `primary` claims, otherwise downgrade them. Recompute difficulty.
  - 150 s soft deadline, the rate limit, and the demo cache.
- **Acceptance:**
  - `tests/agent/*` pass offline. They cover:
    - the fetch fallback on a 403
    - probe parsing (Google, LinkedIn, GitHub, and Notion fixtures)
    - validator downgrades
    - pipeline happy path and timeout → partial
  - A real Miro run (or Calendly) finishes in under 3 min with a shareable `/generate/[runId]`.
  - The no-OAuth, login-wall, timeout, and ambiguous cases each produce a labeled result.

## T-011 — Recorded setup attempts (agent-driven, human-logged-in)
- **Owner:** human + grokbot (box browser), or lead via Playwright MCP (headed) · **Reviewer:** verifier · **Depends on:** human go-ahead
- **Time:** 02:45–03:30 · **Cap:** 45 min · **Deliverable:** `docs/verification-log.md` entries, `docs/screenshots/*.png`
- **Acceptance:**
  - **GitHub OAuth app:** record the field list, whether ≤10 callback URLs holds, and whether expiring tokens are on by default.
  - **Notion public connection:** record the required fields and capabilities.
  - **Slack (optional):** create from a manifest; capture the distribution page and the Marketplace estimated review time.
  - Each entry has time (IST), driver, attempted, completed, stopped-because, and docs vs. console.
  - **No secrets in screenshots.** Test apps are deleted or their secrets rotated.

## T-006 — Evidence docs + `/evidence`
- **Owner:** guide-researcher (a: docs) + ui-builder (b: page) · **Reviewer:** verifier · **Depends on:** T-004, T-011
- **Time:** a 04:00–04:30 · b 04:00–04:30 · **Cap:** 30 + 30 min
- **Acceptance:**
  - `docs/verification-log.md` covers ≥2 attempts plus the probe method.
  - `docs/corrections.md` (seeded in the kit) is checked and extended.
  - `/evidence` shows the methodology, the evidence statuses, and links to the logs.

## T-013 — Test harness + e2e smoke
- **Owner:** verifier · **Reviewer:** lead · **Depends on:** T-010; runs against T-002/003/005 as they merge
- **Time:** 03:00–04:00 · **Cap:** 60 min · **Deliverable:** `playwright.config.ts`, `e2e/smoke.spec.ts`
- **Acceptance:**
  - With `MOCK_LLM=1`, the smoke test covers:
    - `/` loads
    - `/apps` shows "100 tracked" and the difficulty filter narrows the list
    - `/apps/gmail` shows the Composio box and 3 milestones
    - `/generate` with "Miro" streams the steps and lands on `/generate/[runId]`
  - `npm run test:e2e` passes locally.

## T-007 — Batch script (seed list ships in T-010)
- **Owner:** pipeline-engineer · **Reviewer:** verifier · **Depends on:** T-005
- **Time:** 04:30–04:50 · **Cap:** 20 min · **Deliverable:** `scripts/generate-library.ts`
- **Acceptance:**
  - Reuses `runPipeline`.
  - Idempotent (`--force`, `--limit`, `--only`).
  - Writes `data/guides/<slug>.json` and updates the index.
  - Ships only about 5–10 guides; the rest stay `queued`.

## T-008 — Deploy, README, demo script
- **Owner:** release-engineer · **Reviewer:** human · **Depends on:** T-002–T-007
- **Time:** 04:30–05:30 (preview + docs) · 06:30–07:00 (prod) · **Cap:** 60 + 30 min
- **Deliverable:** Vercel URL, `README.md`, `.env.example`, `docs/demo-script.md`, `docs/deploy.md`
- **Acceptance:**
  - Works in incognito. Env vars are set in Vercel, and there are no secrets in the repo.
  - The README covers:
    - setup
    - key decisions: own-app opener, three milestones, computed difficulty, probes + attempts, tiers over coverage, mock mode
    - limitations
    - an evidence summary
    - how to test (link to `docs/testing.md`)
  - A 5-minute demo: library → Gmail → Instagram → live Miro → evidence.

## T-009 — Independent QA + fixes
- **Owner:** verifier (QA) → owning agent (fixes) · **Reviewer:** lead · **Depends on:** preview
- **Time:** 05:30–06:30 · **Cap:** 60 min · **Deliverable:** `docs/qa-report.md`
- **Acceptance:**
  - Every SPEC §14 must-have is checked.
  - ≥3 source checks per demo guide.
  - Live-gen red team on Miro, Calendly, and one obscure app.
  - P0s are fixed before 06:30; the rest are logged in STATUS.

## T-012 — (Stretch) Microsoft Entra/Graph guide
- **Owner:** guide-researcher · Only if T-004 is done by 04:00; otherwise generate it live as `generated`.

## T-014 — Automated setup attempts (post-submission)
- **Owner:** lead · **Why:** the brief asks agents to "attempt as much of the setup process as practical"; T-011 (recorded human-logged-in attempts) was cut, so live generation only probed.
- **Scope:** new pipeline step `attempt` (SPEC §9.4b): fake-code exchange at the token endpoint, remote MCP server discovery (RFC 9728 → RFC 8414), and a registration request that cannot register anything. No accounts, nothing created.
- **Acceptance:**
  - Attempts stream as their own step and appear in a "Setup attempts" section on the guide and in the Markdown export.
  - Facts from attempts are written by code as `tested` / `testKind: "attempt"` and survive validation; an attempt claim with no attempt record is downgraded.
  - Registration bodies are never parseable JSON (unit-tested); private-address endpoints are never contacted.
  - Unit tests on recorded responses (Google, Slack, Calendly, Asana, Atlassian, Miro, GitHub, Notion, Linear); the mock Miro run includes attempts; `npm run check` and `npm run test:e2e` green.
  - Live check on ≥8 real apps, logged in `docs/verification-log.md`.

## T-015 — Real setups (post-submission)
- **Owner:** lead, with Aryan for logins and consent.
- **Scope:** real setups where the agent does the work and Aryan only signs in and approves: Linear through its MCP server (DCR + PKCE), GitHub through the Device Flow, Notion through a public connection. Every test token is revoked and every test app deleted.
- **Status:** Linear done; GitHub app creation verified, sign-in pending; Notion pending.

## T-016 — Repo completeness
- **Owner:** lead.
- **Scope:** usage guide, screenshots from production, author attribution (Aryan Kumar), no stale placeholders, nothing confidential in the repo.

## Coordination rules
- The lead keeps `STATUS.md` current at each block boundary and calls the cut lines.
- Every subagent stays inside its owned paths (see `CLAUDE.md`). Cross-path changes go to the lead as a request.
- Handoff = PR description, plus `npm run check` output, plus what was cut.
- The verifier reviews against acceptance criteria and evidence, not style preference.
- The human handles accounts, logins and 2FA, legal acceptance, the Vercel env vars, and final submission. No account-side action without a go-ahead.
