# OAuth Atlas: submission notes (start here)

**What it is.** Decision-grade OAuth setup and approval guides for developers building AI agents. For any app it answers: *do I need my own OAuth app, can I ship, how long will approval take, what will block me, and what do I do next?* It has three parts: a library of 100 tracked apps with 5 curated guides, a shareable guide page, and live generation for any app.

**Live:** https://oauth-atlas.vercel.app. Try `/apps`, `/apps/gmail` and `/generate` (type "Miro").

## Run it locally (no keys needed)

```bash
npm ci
cp .env.example .env.local     # then set MOCK_LLM=1 in .env.local for offline mode
npm run dev                    # http://localhost:3000
```

- `npm run check`: typecheck, lint, 236 unit tests, guide validation and production build.
- `npm run test:e2e`: 5 Playwright smoke tests in mock mode.
- Real live generation needs `ANTHROPIC_API_KEY`. Upstash Redis is optional locally; without it, runs are kept in memory.

## Where to look

| Read this | For |
|---|---|
| `README.md` | What it does, architecture, key decisions, limitations, evidence summary |
| `SPEC.md`, `DECISIONS.md` | Product spec and decision log |
| `docs/qa-report.md` | Independent QA: SPEC §14 pass/fail, live red team, every bug (QA-1…QA-22) and its status |
| `docs/verification-log.md`, `docs/corrections.md` | Probe methodology, setup-attempt log, and corrections to common assumptions |
| `docs/research.md` | The research brief the guides are built from |
| `data/guides/*.json` | The 5 curated guides (GitHub, Notion, Slack, Gmail, Instagram), with claim-level sources |
| `STATUS.md`, `TASKS.md` | The ship-day timeline, task board and cut lines as they happened |

## How it works

`resolve → composio → discover → probe → extract → verify → render`, streamed over SSE (`app/api/generate`, `lib/agent/*`).

- **Difficulty is computed, never generated** (`lib/difficulty.ts`): it's the highest-weight gate required for production.
- **"Primary" evidence** must come from an official host and quote text actually fetched from that URL; anything else is downgraded (`lib/agent/validate.ts`).
- **Probes** hit OAuth discovery and authorize endpoints with a dummy client and are recorded as timestamped `tested` evidence.
- **Deadlines:** a run has a 150 s soft deadline and a 250 s hard deadline; anything late becomes a labeled partial guide.
- **Persistence:** runs are stored in Upstash Redis, with a demo cache and a rate limit of 5 live runs per IP per hour.
- **Safety:** model-cited URLs are fetched only if they're public https (SSRF guard, `lib/agent/urlGuard.ts`).
- **Model:** Claude (`claude-opus-5-5`) with server-side web search. The provider can be switched to Gemini or OpenAI.

## How it was built

One lead Claude Code session orchestrated six subagents (`.claude/agents/`): schema-architect, ui-builder, pipeline-engineer, guide-researcher, release-engineer, and an independent **verifier** that never reviewed its own code.

- Contracts were landed first; then the agents worked in parallel git worktrees, one branch per task.
- A branch merged only after verifier approval and a green `npm run check`.
- The verifier caught and drove fixes for, among others:
  - off-domain "primary" sources
  - an extraction retry that could overrun Vercel's 300 s limit
  - a server-side request forgery (SSRF) hole in URL fetching
- Every bug is in `docs/qa-report.md` with its fix commit.

## Honest status

- **SPEC §14 must-haves:** all pass on production except **#7, recorded setup attempts**. The human-supervised GitHub and Notion attempts (T-011) were cut at 03:30 for time. Those guides are tier `verified` (primary sources plus automated probes), not `tested`.
- **Open, low priority (P2):**
  - guessed websites can wrongly downgrade real docs (QA-19)
  - a nonexistent app finishes as "difficulty 5" instead of partial (QA-20)
  - DNS rebinding between the URL check and the fetch (QA-22(2))
  - three minor resolver and domain edge cases (QA-10(2), QA-12, QA-13)
- **Incidents, both disclosed and fixed:**
  - Vercel made the project's first deploy production, and it uploaded a local `.env`. That deployment was deleted, `.vercelignore` was added, and the key is being rotated.
  - One commit was merged before review. It was approved afterwards, and merges now go by exact commit hash.
- Live guides are labeled "Live-generated, verify before relying on it". No provider approvals were completed, and no review times were invented: community figures are labeled as such.
