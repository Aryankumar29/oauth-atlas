# Testing OAuth Atlas

Everything below runs **without API keys**. `MOCK_LLM=1` swaps in the mock LLM, recorded HTTP fixtures, and an in-memory store.

## Scripts
| Script | What it runs | When |
|---|---|---|
| `npm run typecheck` | `tsc --noEmit` | every change |
| `npm run lint` | ESLint | every change |
| `npm test` | Vitest: schema, difficulty, markdown, offline pipeline | every change |
| `npm run validate:guides` | Zod-validates `data/guides/*.json` + `data/apps.seed.json`; checks ≥3 primary sources on curated guides, timestamps on probes, three milestones | after any guide edit |
| `npm run test:e2e` | Playwright smoke against `npm run dev` with `MOCK_LLM=1` | after UI or pipeline merges |
| `npm run check` | typecheck && lint && test && validate:guides && build | **definition of done** |
| `E2E_BASE_URL=https://<preview> npx playwright test` | the smoke test against a deployed preview (real LLM) | at QA |

Suggested `package.json` scripts (schema-architect adds them in T-010):
```json
{
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "validate:guides": "tsx scripts/validate-guides.ts",
  "snapshot:composio": "tsx scripts/snapshot-composio.ts",
  "probe": "tsx scripts/probe.ts",
  "check": "npm run typecheck && npm run lint && npm test && npm run validate:guides && npm run build"
}
```

## By stage
1. **Contracts (T-010).**
   - `tests/schema.test.ts` validates the seed and every guide.
   - `tests/difficulty.test.ts` checks the expected scores: GitHub 1, Notion 1, Slack 3, Gmail 5 (send-only 3), Instagram 4, Microsoft 3. These scores are the regression guard on the scoring rules.
2. **Guides (T-004).**
   - Run `npm run validate:guides`.
   - Then spot-check one quote per guide: open the URL and search for the quote text.
3. **UI (T-002/T-003).**
   - `tests/markdown.test.ts` snapshot-tests `guideToMarkdown`.
   - Manually check `npm run dev` with `/apps` and `/apps/gmail` on desktop and mobile width.
4. **Pipeline (T-005).** `tests/agent/*.test.ts` run offline. `runPipeline(input, deps)` takes fakes:
   - **`fetch`:** the fixture fetcher reads `tests/fixtures/http/<sha1(url)>.json` (`{url,status,headers,body}`).
   - **`llm`:** `llm/mock.ts` reads `tests/fixtures/llm/<slug>.json`.
   - **`store`:** memory. **`now`:** a fixed clock.
   - Cases covered:
     - 403 → UA retry
     - probe parsing (Google `authError`, LinkedIn `invalid "…"`, GitHub login redirect, Notion no-discovery)
     - validator downgrade
     - timeout → `partial`
     - no-OAuth → `no-self-serve`
   - **Record new fixtures** with `npx tsx scripts/record-fixtures.ts miro`. This does a real fetch, but no LLM call.
5. **Live (real keys).**
   - Put the keys in `.env.local` and unset `MOCK_LLM`.
   - Run `npm run dev`, then `/generate` with "Miro". Expect under 3 min, a shareable `/generate/<id>`, Composio and probe steps visible, and the run in Redis.
6. **E2E (T-013).** Run `npm run test:e2e`. The first time, run `npx playwright install chromium`.
7. **QA (T-009).**
   - Run the e2e against the preview via `E2E_BASE_URL`.
   - Follow the verifier's checklist and record results in `docs/qa-report.md`.

## Secret hygiene check (before every push)
```bash
git grep -nE "AIza[0-9A-Za-z_-]{20,}|sk-[A-Za-z0-9]{20,}|xox[bp]-|ghp_[A-Za-z0-9]{20,}|UPSTASH_REDIS_REST_TOKEN=.+" -- . ':!.env.example'
```
Expected: no output.
