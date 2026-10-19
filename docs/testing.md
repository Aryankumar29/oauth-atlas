# Testing OAuth Atlas

Everything below runs **without API keys**. Unit tests inject fakes directly. `MOCK_LLM=1` swaps the running app to the mock LLM (`tests/fixtures/llm/miro.json`), the recorded HTTP fixtures (`tests/fixtures/http/recorded.json`; unrecorded URLs return 404, so the app never touches the network), and the in-memory store (Redis is ignored even if configured).

## Scripts (`package.json`)
| Script | What it runs | When |
|---|---|---|
| `npm run typecheck` | `next typegen && tsc --noEmit` | every change |
| `npm run lint` | `eslint` | every change |
| `npm test` | `vitest run`: 13 files, 118 tests as of c86ab7c | every change |
| `npm run validate:guides` | `scripts/validate-guides.ts`: Zod-validates `data/apps.seed.json` and every `data/guides/*.json`, plus no duplicate slugs, filename = slug, slug in the seed, file imported in `data/guides/index.ts`, and `verdict.difficulty` equal to the computed score. Prints `OK: 100 apps, 5 guides` | after any guide or seed edit |
| `npm run build` | `next build` | part of `check` |
| `npm run check` | typecheck && lint && test && validate:guides && build | **definition of done** |
| `npm run test:e2e` | Playwright (`e2e/smoke.spec.ts`), Chromium, against `npm run dev -- --port 3300` with `MOCK_LLM=1` | after UI or pipeline merges |
| `E2E_BASE_URL=https://<host> npx playwright test` | the same suite against a deployed URL; no local server | at QA |

Other scripts:
- `npx tsx scripts/probe.ts <domain|slug|url>`: runs the probe step against the real network and prints probe records as JSON.
- `npm run snapshot:composio`: refreshes `data/composio-managed.json`.
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

## E2E (`e2e/smoke.spec.ts`)
The first time, run `npx playwright install chromium`. There are five tests:
1. `/` loads.
2. `/apps` shows "100 tracked" and 100 cards; the difficulty filter narrows them.
3. Queued app cards link to `/generate`.
4. `/apps/gmail` shows the Composio box and three milestones.
5. `/generate` with "Miro" streams steps and lands on `/generate/<id>` with the `MOCK MODE` banner.

Against a real deployment (`E2E_BASE_URL`), test 5 fails by design, because the deployed app is not in mock mode. Treat it as a manual check (`docs/deploy.md` §5). Results go to `e2e/.results` (traces are kept on failure).

## Live check (real keys)
Put the keys in `.env.local` (names in `.env.example`) and leave `MOCK_LLM` unset. Run `npm run dev`, then go to `/generate` and submit "Miro". Expect:
- the steps stream within a few seconds
- the run finishes within about 3 min (150 s soft deadline, then a labeled partial guide)
- a shareable `/generate/<id>`
- Composio and probe steps visible
- with Upstash set, the run survives a server restart

## QA
Follow `docs/deploy.md` §5 on the preview, and record results in `docs/qa-report.md`.

## Secret hygiene check (before every push)
```bash
git grep -nE "AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|xox[bp]-|ghp_[A-Za-z0-9]{20,}" ; grep -nE "^[A-Z_]+=.+" .env.example
```
Expected: no output.
