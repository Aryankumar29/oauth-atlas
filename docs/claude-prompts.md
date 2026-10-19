# Claude Code prompts (copy and paste, in order)

**Setup (once, 01:30):**
1. Copy the kit into the repo root:
   - `CLAUDE.md`
   - `.claude/agents/*`
   - `.claude/settings.json`
   - `.env.example`
   - `vitest.config.ts`, `playwright.config.ts`
   - `docs/*`
   - `SPEC.md`, `TASKS.md`, `STATUS.md`
2. If the repo already had a `CLAUDE.md`, merge its notes under "Conventions". The new file imports `@AGENTS.md`.
3. `git add -A && git commit -m "kit: claude code agents, specs v1.1, testing docs" && git push`
4. Create `.env.local` with `MOCK_LLM=1` for now. Add the real keys when you have them.
5. Optional, for T-011: add the Playwright MCP with `claude mcp add playwright -- npx @playwright/mcp@latest`.
6. Start Claude Code in the repo root: `claude`. Then run `/agents` (or ask "list project subagents") and confirm all 6 load.

---

## 0. Kickoff (lead session). Paste this first
```
You are the lead for OAuth Atlas. We ship today: preview by 05:30 IST, prod by 07:00 IST.
Read CLAUDE.md, SPEC.md, TASKS.md, STATUS.md, then skim docs/research.md §0 and §3. Use plan mode first: give me a 10-line plan (phases, which subagent runs what, merge order, cut lines with clock times) and wait for my OK.

Operating rules:
- You orchestrate; subagents in .claude/agents do the work inside their owned paths (CLAUDE.md table). Do not implement feature code yourself except merges and tiny glue.
- Phase 0 (now → 02:30): run @schema-architect on T-010 in the main checkout on branch feat/T-010-contracts. When `npm run check` is green, merge to main and push main (ask me). Phase 1 cannot start before this, because worktree subagents branch from the default branch.
- Phase 1 (02:30 → 04:30): in parallel, in the background, run @ui-builder (T-002 → T-003 → T-006b), @pipeline-engineer (T-005a → T-005b) and @guide-researcher (T-004 → T-006a). At 03:00 add @verifier (T-013). Tell each agent to start with `npm ci` in its worktree and confirm lib/difficulty.ts exists.
- Merge order: T-010 → T-004 → T-002 → T-003 → T-005 → T-006 → T-013 → T-007 → T-008. Each PR merges only when @verifier approves and `npm run check` is green on the rebased branch.
- At every block boundary (02:30, 03:00, 04:00, 04:30, 05:30, 06:30), update STATUS.md (done / in progress / cuts) and tell me which cut lines from TASKS.md apply. Enforce the per-task time caps.
- Never read .env.local, never print secrets, never run `vercel --prod` without my explicit OK.
- If usage limits hit, rerun subagents with model sonnet.
Start with the plan.
```

## 1. Phase 0: contracts (lead → schema-architect)
```
@schema-architect Do T-010 exactly as specified in TASKS.md and your agent file. Cap 45 minutes.
Acceptance: schema v1 per SPEC §5; difficulty tests pass (GitHub 1, Notion 1, Slack 3, Gmail 5 / send-only 3, Instagram 4, Microsoft 3); Composio snapshot 123/211 dated 2026-10-20; seed has 100 apps; lib/agent/types.ts interfaces; scripts + deps installed.
Verify: npm run check   (paste the last 30 lines)
```

## 2. Phase 1: parallel (lead spawns all three in the background)
```
Run these three subagents in parallel in the background, each in its own worktree:
1) @ui-builder: T-002 then T-003 then T-006b.
2) @pipeline-engineer: T-005a then T-005b. Use MOCK_LLM=1 and fixtures; no real keys needed yet.
3) @guide-researcher: T-004 (github, notion, slack, gmail, instagram) then T-006a.
Each one: `npm ci` first, commit small on its feat/T-xxx branch, and finish with `npm run check` output plus a list of cuts. Report back as each finishes; don't wait for all three.
```

**Per-agent follow-ups** (use them if an agent stalls or needs re-scoping):
```
@ui-builder T-003 only. The cap is 60 min. Above the fold: composio-box, difficulty and rationale, 3 milestone cards with basis badges, next actions, blockers. Reuse GuideView in /generate/[runId]. Verify: npm test -- markdown && npm run check
```
```
@pipeline-engineer T-005b only: probe.ts plus scripts/probe.ts, the Gemini adapter (grounded research, then JSON extraction, then Zod, retry once), validate.ts (quote match → downgrade; recompute difficulty), a 150 s soft deadline, the rate limit, and the demo cache. Verify: npm test -- agent && npm run check
```
```
@guide-researcher Write data/guides/gmail.json. ≥3 primary sources re-fetched today with exact quotes. Milestones: Testing (100 users, 7-day tokens), brand verification 2–3 business days (Google estimate), restricted scope verification "several weeks" plus annual CASA (AL1/AL2; vendor prices are secondary). The send-only path is a conditional gate. Verify: npm run validate:guides
```

## 3. Setup attempts (T-011, 02:45; you need to be at the keyboard)
```
I'm logged in to GitHub and Notion in the browser. Using the Playwright MCP (headed), go to github.com/settings/developers → New OAuth App. Fill in name "oauth-atlas-test", homepage https://example.com, callback https://example.com/cb, and try adding callback URLs until the UI stops you, up to 10. Note whether "Expire user access tokens" is on by default. Screenshot each screen to docs/screenshots/github-*.png with NO client secret visible (don't click "Generate a new client secret"). Then delete the app. Do the same for Notion: Developer portal → Public connections → Create, recording the required fields and capabilities. Write both entries in docs/verification-log.md. Stop and ask me before any 2FA or payment step.
```
If the Playwright MCP isn't set up, ask Grokbot to drive the box browser instead, and paste its notes into the log.

## 4. Verifier: e2e and PR reviews (from 03:00)
```
@verifier Do T-013: playwright.config.ts (already in the repo; adjust if needed) and e2e/smoke.spec.ts per your agent file, using MOCK_LLM=1. Then review each PR as it lands, against its acceptance criteria in TASKS.md. Verify: npm run test:e2e && npm run check
```

## 5. Integration (04:30)
```
Merge in order T-004 → T-002 → T-003 → T-005 → T-006 → T-013, rebasing each branch on main and running `npm run check` and `npm run test:e2e` after each merge. Then:
- @pipeline-engineer: with real keys (I've set GEMINI_API_KEY, LLM_MODEL, and the UPSTASH vars in .env.local, unset MOCK_LLM), run live generation for "Miro" and "Calendly", measure the time, and fix anything blocking. Then T-007 (batch script; generate nothing beyond those two).
- @release-engineer: T-008 preview part. Write docs/deploy.md with env var names, link Vercel (I'll log in), deploy a preview (ask me), and warm the Miro/Calendly cache on the preview. Draft the README and demo script.
Apply the 05:00 cut line if Gemini grounding or quota fails.
```

## 6. Final QA (05:30)
```
@verifier Do T-009 against the preview URL <PASTE>. Re-fetch ≥3 cited URLs per guide; red-team live generation (Miro, Calendly, Toggl Track, a non-OAuth app, and garbage input); check the rate limit, the secret grep, and incognito. Write docs/qa-report.md with pass/fail for every SPEC §14 must-have and a P0/P1/P2 bug list with owners. Run E2E_BASE_URL=<PASTE> npx playwright test.
```
Then: `Route each P0 from docs/qa-report.md to its owning subagent. Fix, re-run check and e2e, re-deploy the preview. Feature freeze is in effect.`

## 7. Prod and demo rehearsal (06:30)
```
@release-engineer Prod deploy: confirm `npm run check` is green on main, run `vercel --prod` (I'll approve), smoke-test /, /apps, /apps/gmail, /apps/instagram, /generate (Miro) in a fresh browser context, and put the prod URL in the README and STATUS.md.
```
```
Rehearse the demo with me using docs/demo-script.md. Time each section (5 minutes total). For the live part, submit an app I haven't mentioned yet ("Toggl Track") and narrate what each streamed step proves. List anything that looked wrong or slow, and the fallback line for each.
```

---

## Productivity tips
- **Plan mode first** (Shift+Tab until it shows plan mode) for the kickoff and for any task over 30 min. Approve, then switch to auto-accept edits.
- **Run subagents in parallel and in the background.** Keep the lead's context for orchestration. Ask "report as each finishes"; check progress with `/tasks`.
- **One task, one context.** `/clear` in the lead between phases. Restate the next step by pasting the next prompt from this file. Use `/compact` if you must keep context.
- **Keep context small.** Point agents at file paths and section numbers (e.g. "SPEC §9"), not pasted text. Facts live in `docs/research.md`.
- **Contracts first.** If any agent wants a schema change, the lead approves it, schema-architect makes it, and everyone rebases.
- **Commit often:** `T-xxx: <change>`. If a task goes sideways, roll back with the rewind command (Esc twice) rather than patching on top.
- **Always paste the verification command output.** "Done" means `npm run check` is green.
- **Usage limits** (Max plan): parallel opus agents use up quota fastest. Drop builders to `sonnet` first; keep the verifier on `fable`.
- **Windows:** worktrees work fine. If `npm ci` is slow per worktree, start the three Phase 1 agents a minute apart.
