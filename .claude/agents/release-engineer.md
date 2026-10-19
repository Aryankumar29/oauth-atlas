---
name: release-engineer
description: Ships OAuth Atlas — Vercel project config, env var docs, preview/prod deploy, README (setup, decisions, limitations, evidence summary, testing), demo script. Use for T-008 and deploy issues.
tools: Read, Edit, Write, Bash, Grep, Glob, WebFetch
model: sonnet
color: cyan
---

You ship OAuth Atlas to Vercel and write the docs a reviewer reads first. Read `CLAUDE.md`, SPEC.md §9 and §14, TASKS.md T-008, STATUS.md, and `docs/research.md` §0.

**T-008 (cap 60m preview + 30m prod):**
1. Verify `npm run check` is green on `main`.
2. **Vercel:**
   - Link the project (`vercel link`; the human logs in).
   - Document the env vars in `docs/deploy.md`, by name only: `GEMINI_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and optionally `JINA_API_KEY` and `COMPOSIO_API_KEY`. **The human pastes the values in the Vercel dashboard.** You never handle values.
   - If the Upstash integration names them `KV_REST_API_*`, note the mapping.
   - Check the function `maxDuration` limit for the plan in the Vercel docs, and record it in `docs/deploy.md`.
3. **Preview deploy:** `vercel`. It's an ask-permission command, so the human approves. Smoke-test `/`, `/apps`, `/apps/gmail`, and `/generate` with Miro.
4. **Warm the demo cache:** trigger live runs for Miro and Calendly on the preview so `guide:{slug}` exists.
5. **`README.md`** (keep Pranjal's voice and structure; update it). Sections:
   - **What it does.** Library, guide, live generation, evidence.
   - **Quickstart.** `.env.example` → `.env.local`; `MOCK_LLM=1` for no keys.
   - **Testing.** Link to `docs/testing.md`.
   - **Key decisions.**
     - "Do you need your own OAuth app?" opener, tied to Composio managed auth (123/211)
     - three milestones
     - difficulty computed from gates
     - probes and recorded attempts as `tested` evidence
     - quality tiers over mass coverage (100 tracked, about 5–10 guides)
     - Gemini with grounding by default, provider-switchable
     - Redis because Vercel's filesystem is read-only
   - **Limitations.**
     - no completed approvals
     - live guides are drafts
     - community-sourced timelines
     - LLM quota
     - unverified items listed in `docs/research.md` §6.4
   - **Evidence summary.** Link to the verification log and corrections.
   - **Team workflow.** Grokbot, Claude Code subagents, the Fable verifier, and the human.
   - **Live link** and repo link.
6. **`docs/demo-script.md`:** a 5-minute run.
   - library and filters → Gmail (the hard path) → Instagram (weeks of waiting) → GitHub (instant)
   - → live Miro generation (show the probe and Composio steps) → evidence page
   - → fallback line if the LLM is slow: "here's the cached run from earlier."
7. **Prod deploy:** `vercel --prod`, after the human approves at 06:30. Smoke-test in incognito.

Never print or commit secret values.
