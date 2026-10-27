# Deploying OAuth Atlas

Target: Vercel (Next.js 16 App Router). Deploys run only with the human's explicit OK. Production deploys run only after the human approves the preview.

## 1. Environment variables

**Who sets them:** the human, in the Vercel dashboard (Project → Settings → Environment Variables), for Preview and Production. Agents never see or handle the values. `.env.example` lists the same names.

| Name | Required | Read by | Notes |
|---|---|---|---|
| `LLM_PROVIDER` | no | `lib/agent/deps.ts` | `anthropic` (default), `gemini`, or `openai` |
| `LLM_MODEL` | no | `lib/agent/llm/index.ts` | Overrides the code defaults: `claude-opus-5-5`, `gemini-2.5-flash`, `gpt-5-mini` |
| `OPENAI_BASE_URL` | no | `lib/agent/llm/index.ts` | Points the OpenAI adapter at an OpenAI-compatible v1 API. Production uses Azure OpenAI (`https://<resource>.openai.azure.com/openai/v1`) with `LLM_PROVIDER=openai` and `LLM_MODEL=gpt-6-sol` (the deployment name) |
| `ANTHROPIC_API_KEY` | yes, for the default provider | `lib/agent/llm/index.ts` | Use `GEMINI_API_KEY` or `OPENAI_API_KEY` instead if you switch the provider |
| `UPSTASH_REDIS_REST_URL` | yes, on Vercel | `lib/store.ts` | Without it the store is in-memory per instance: run pages show "not found" on another instance or after a cold start, and the demo cache is empty |
| `UPSTASH_REDIS_REST_TOKEN` | yes, on Vercel | `lib/store.ts` | |
| `JINA_API_KEY` | no | `lib/agent/deps.ts` | Jina Reader fallback for docs that block plain fetches. The fallback runs without a key |
| `READER_FALLBACK` | no | `lib/agent/deps.ts` | `0` disables the reader fallback |
| `COMPOSIO_API_KEY` | no | `lib/agent/deps.ts` | Without it, the Composio lookup uses the public managed-auth page, then the bundled snapshot |
| `DEMO_CACHE_SLUGS` | no | `lib/agent/cache.ts` | Comma-separated. Default `miro,calendly` |
| `MOCK_LLM` | **never on Vercel** | `lib/agent/deps.ts`, `lib/store.ts` | `1` = offline mode: mock LLM, fixture fetcher, memory store, no rate limit |

**Upstash integration names.** If the Upstash integration from the Vercel Marketplace injects `KV_REST_API_URL` / `KV_REST_API_TOKEN`, nothing needs mapping: `lib/store.ts` reads `UPSTASH_REDIS_REST_*` first and falls back to `KV_REST_API_*`. Don't use the read-only token.

## 2. Function duration

`app/api/generate/route.ts` exports `maxDuration = 300`. The pipeline's soft deadline is 150 s; at that point discovery stops and extraction runs on what was fetched. The hard deadline for extraction is 250 s; past it, a labeled partial guide is saved. Both fit inside 300 s.

Vercel's limits, from https://vercel.com/docs/functions/configuring-functions/duration (page `last_updated: 2026-08-24`, fetched 2026-10-20), with Fluid compute, which is on by default:

| Plan | Default | Maximum | Extended maximum |
|---|---|---|---|
| Hobby | 300 s | 300 s | — |
| Pro | 300 s | 800 s | 1800 s (beta) |
| Enterprise | 300 s | 800 s | 1800 s (beta) |

So `maxDuration = 300` is valid on every plan, Hobby included. **Check that Fluid compute is enabled** in Project → Settings → Functions. The table above is for Fluid compute; the page does not list limits without it.

## 3. Steps

Run from the repo root. Each `vercel` command needs the human's OK.

1. **Pre-flight:** `npm ci && npm run check` is green on the commit you deploy.
2. **Link:** `vercel link`. The human logs in and picks the scope; the project name is `oauth-atlas`.
3. **Env:** the human adds the variables from §1 for Preview and Production. Create the Upstash database first (Vercel Marketplace → Upstash Redis, or upstash.com).
4. **Preview:** `vercel`. Run the smoke checklist (§5) on the preview URL.
5. **Warm the demo cache** on the preview (§4).
6. **Production:** `vercel --prod`, **only after the human approves.** Re-run the smoke checklist in an incognito window. Preview and Production share a Redis database only if they use the same Upstash credentials; if they don't, warm the cache again.
7. Put the production URL in `README.md` (replace `<!-- LIVE_URL -->`).

## 4. Warming the demo cache

`/generate` serves `guide:{slug}` for the slugs in `DEMO_CACHE_SLUGS` (default `miro`, `calendly`) without running the pipeline, unless the user clicks "Regenerate live" (`force=1`). Only complete (non-partial) guides are served. Cache hits don't count against the rate limit.

Use either of these:

- **A live run (preferred).** On the deployed URL, open `/generate`, submit `Miro`, then `Calendly`. A complete run writes `guide:miro` / `guide:calendly`. A partial run is not cached; re-run it.
- **From a file.** Takes a guide JSON produced by an earlier agent run. `cacheGuide` refuses hand-written guides; the guide must have `generatedBy: "agent"` or `app.tier: "generated"`, and its difficulty must match the computed score.
  ```bash
  export UPSTASH_REDIS_REST_URL=...   # the human pastes these in their own shell
  export UPSTASH_REDIS_REST_TOKEN=...
  npx tsx scripts/cache-guide.ts path/to/miro.json
  ```
  If the vars are missing (or `MOCK_LLM=1`), the script warns and writes to a memory store that doesn't persist.

To check it, submit `Miro` again. The result page should show "Cached demo guide, generated …" with a "Regenerate live" link.

## 5. Smoke checklist

Run on the preview, then on production in incognito.

- [ ] `/` loads. The three cards link to `/apps`, `/generate`, and `/evidence`.
- [ ] `/apps` shows 100 tracked apps. The difficulty, approval, Composio-managed, and tier filters narrow the list. Search works.
- [ ] `/apps/gmail`: verdict, difficulty 5 (send-only 3), the Composio box, three milestones, and sources.
- [ ] `/apps/instagram`, `/apps/github`, `/apps/notion`, and `/apps/slack` render.
- [ ] "Copy link" and "Copy as Markdown" work on one guide.
- [ ] `/generate` with `Miro` returns the cached guide quickly (after warming).
- [ ] `/generate` with an app outside the cache (e.g. `Calendly` before warming, or `Linear`): steps stream, it ends on `/generate/<id>`, the guide shows the "Live-generated — verify." banner, and the run page still loads after a refresh (this proves Redis works).
- [ ] No "MOCK MODE" banner anywhere (this proves `MOCK_LLM` is not set).
- [ ] `/evidence` loads. Note: its links to repo docs 404 while the GitHub repo is private (QA-6).
- [ ] The 6th live run from one IP within an hour returns HTTP 429 with a rate-limit message.
- [ ] The browser console shows no errors on the pages above.
- [ ] Optional: `E2E_BASE_URL=https://<preview> npx playwright test`. The spec is deployment-aware: against a deployment, the Miro case asserts there is no `MOCK MODE` banner and the guide is labeled "Cached demo guide" or "Live-generated". Caveat: Miro is a cache hit only after warming (§4); otherwise the test triggers one live run, which uses up one of the 5 runs per IP per hour and can take up to 3 min.

## 6. Rollback

`vercel rollback` (or promote the previous deployment in the dashboard). Guides in Redis aren't versioned with deploys.
