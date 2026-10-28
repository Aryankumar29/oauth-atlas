# Testing OAuth Atlas

Everything below runs **without API keys**. Unit tests inject fakes directly. `MOCK_LLM=1` swaps the running app to the mock LLM (`tests/fixtures/llm/miro.json`), the recorded HTTP fixtures (`tests/fixtures/http/recorded.json`; unrecorded URLs return 404, so the app never touches the network), and the in-memory store (Redis is ignored even if configured).

## Scripts (`package.json`)
| Script | What it runs | When |
|---|---|---|
| `npm run typecheck` | `next typegen && tsc --noEmit` | every change |
| `npm run lint` | `eslint` | every change |
| `npm test` | `vitest run`: 22 files, 271 tests (2026-10-28) | every change |
| `npm run validate:guides` | `scripts/validate-guides.ts`: Zod-validates `data/apps.seed.json` and every `data/guides/*.json`, plus no duplicate slugs, filename = slug, slug in the seed, file imported in `data/guides/index.ts`, and `verdict.difficulty` equal to the computed score. Prints `OK: 100 apps, 5 guides` | after any guide or seed edit |
| `npm run build` | `next build` | part of `check` |
| `npm run check` | typecheck && lint && test && validate:guides && build | **definition of done** |
| `npm run test:e2e` | Playwright (`e2e/smoke.spec.ts`), Chromium, against `npm run dev -- --port 3300` with `MOCK_LLM=1` | after UI or pipeline merges |
| `E2E_BASE_URL=https://<host> npx playwright test` | the same suite against a deployed URL; no local server | at QA |

Other scripts:
- `npx tsx scripts/probe.ts <domain|slug|url>`: runs the probe step against the real network and prints probe records as JSON.
- `npm run snapshot:composio`: refreshes `data/composio-managed.json`.
- `npx tsx scripts/generate-library.ts [--only a,b] [--limit N] [--force] [--dry-run]`: T-007 batch generation (see below).
- `npx tsx scripts/cache-guide.ts <file>`: see `docs/deploy.md` §4.

## Unit tests (`tests/`)
- `schema.test.ts`: the seed and every guide parse.
- `difficulty.test.ts`: the expected scores are GitHub 1, Notion 1, Slack 3, Gmail 5 (send-only 3), Instagram 4, and Microsoft 3 (Microsoft from `tests/fixtures/guides/microsoft.json`). These are the regression guard on the scoring rules.
- `markdown.test.ts` (snapshot of `guideToMarkdown`), `format.test.ts`.
- `tests/agent/`. All offline: `runPipeline(input, deps)` gets a fake fetch, LLM, memory store, and fixed clock.
  - `pipeline.test.ts`: happy path, a hung research call → labeled partial, extraction retried once then partial, no docs → partial, no OAuth program → `no-self-serve` (score 5), ambiguous query in unknowns, empty query.
  - `validate.test.ts`, `officialDomains.test.ts`: primary only for an official host with the quote in that URL's own doc; off-domain → secondary; UGC hosts/paths; downgrades of `tested` without a probe record.
  - `probe.test.ts`, `fetchDoc.test.ts` (403 → UA retry, Meta minimal UA, reader fallback, login walls, timeouts), `resolve.test.ts` (short queries, prefix-over-substring ranking), `cache.test.ts` and `cacheGuide.test.ts` (demo cache hit/miss, `force` bypass, client IP, partial never overwrites complete, hand-written guides refused), `prompts.test.ts`.

**Fixtures:** HTTP fixtures are entries in `tests/fixtures/http/recorded.json` (`{url, status, contentType, body, …}`). Entries marked `synthetic` are hand-written test pages, not real provider docs. There is no recording script; add entries by hand.

## Batch generation (T-007)
`tests/agent/batch.test.ts` runs offline:
- mock mode refuses to write unless `--dry-run`
- idempotent skip unless `--force`; curated guides are never overwritten (QA-14); `--limit` accepts only positive integers (QA-15b)
- the thin mock Miro guide fails the QA gate and is not written
- every gate reason is reported; probe/test sources don't count toward the 3 distinct sources (QA-15a)
- schema-invalid input is rejected
- the curated guides are run through `qaGate` as a strictness sanity check
- generated `index.ts` lines are valid identifiers

Smoke-test the script itself with no keys:
```bash
MOCK_LLM=1 npx tsx scripts/generate-library.ts --dry-run --only miro
```
Expected: Miro is skipped with the QA gate's reasons, and nothing is written. A real run needs LLM keys exported in the shell (`tsx` does not read `.env.local`). It only writes `data/guides/<slug>.json`. A human then adds the printed import lines to `data/guides/index.ts`, sets the seed tier to `generated`, spot-checks the guide, and runs `npm run check`.

## E2E (`e2e/smoke.spec.ts`)
The first time, run `npx playwright install chromium`. There are five tests:
1. `/` loads.
2. `/apps` shows "100 tracked" and 100 cards; the difficulty filter narrows them.
3. Queued app cards link to `/generate`.
4. `/apps/gmail` shows the Composio box and three milestones.
5. `/generate` with "Miro" streams steps and lands on `/generate/<id>`. Locally it expects the `MOCK MODE` banner; against `E2E_BASE_URL` it expects no mock banner and a "Cached demo guide" or "Live-generated" label.

Against a deployment, test 5 is a cache hit only if Miro was warmed (`docs/deploy.md` §4); otherwise it uses up one live run of the 5/IP/hour budget. Results go to `e2e/.results` (traces are kept on failure).

## Live check (real keys)
Put the keys in `.env.local` (names in `.env.example`) and leave `MOCK_LLM` unset. Run `npm run dev`, then go to `/generate` and submit "Miro". Expect:
- the steps stream within a few seconds
- the run finishes within about 3 min (150 s soft deadline, then a labeled partial guide)
- a shareable `/generate/<id>`
- Composio and probe steps visible
- with Upstash set, the run survives a server restart

## QA
Follow `docs/deploy.md` §5 on the preview.

**Live red-team runner (`e2e/redteam.mjs`, T-009).** Plain Node, not part of Playwright or `check`:
```bash
node e2e/redteam.mjs https://<preview> "Miro" "Calendly" "Toggl Track"
```
For each query, it POSTs to `/api/generate`, reads the SSE stream, and prints one block with:
- the run status, its duration (flagged if over 3 min), and the `mock` and `cached` flags
- what the app resolved to, and its Composio status
- the probe count, and whether every probe is timestamped
- the computed difficulty, how many claims were downgraded out of how many checked (with the first 8 downgrades), and the primary-evidence count
- any step errors

Every uncached query is a live run and counts toward the 5/IP/hour rate limit, so keep a batch to 5 or fewer, or use cached demo slugs.

## Secret hygiene check (before every push)
```bash
git grep -nE "AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|xox[bp]-|ghp_[A-Za-z0-9]{20,}" ; grep -nE "^[A-Z_]+=.+" .env.example
```
Expected: no output.
