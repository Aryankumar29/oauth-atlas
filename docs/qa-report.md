# QA report

Owner: verifier. Pre-merge findings from PR reviews (2026-10-20 IST). The T-009 pass on the preview URL, with pass/fail per SPEC §14, will be added below.

## Bugs

| ID | Pri | Area | Finding | Repro | Owner | Status |
|---|---|---|---|---|---|---|
| QA-1 | P0 | T-005 validator | An off-domain source can stay `primary`. `lib/agent/validate.ts` only checks that the quote appears in *any* fetched doc. It never compares the source host with the app's domain or docs hosts, and never checks the quote against the doc at the cited URL. | `validateGuide` on a guide with `evidence.sourceUrl = https://some-random-blog.example/...`, `status: primary`, and a fetched doc from that blog containing the quote: the status stays `primary`. | pipeline-engineer | open (T-005 blocked) |
| QA-2 | P1 | T-005 fallback guide | `fallbackGuide` milestones use `handsOnHours {0,0}` / `wait {0,null}`, so a failed run renders "0–0 min" and "0+ days" next to "basis: unknown". | Any run with no fetchable docs, then open `/generate/<id>`. | pipeline-engineer / ui-builder | open |
| QA-3 | P2 | T-005 boundaries | No `import "server-only"` in `lib/store.ts`, `lib/agent/deps.ts`, `lib/agent/llm/*`. No leak today (the client bundle grep is clean), but nothing guards against one. | `git grep server-only` returns nothing. | pipeline-engineer | open |
| QA-4 | P2 | T-005 demo cache | `cacheGuide` accepts any valid guide. A `generatedBy: "human"` file served from `/generate` would lose the "Live-generated, verify" banner. | `npx tsx scripts/cache-guide.ts data/guides/github.json` (with MOCK/memory). | pipeline-engineer | open |
| QA-5 | P2 | `/apps/[slug]` (fix/guide-suspense) | An unknown slug returns HTTP 200 with the not-found UI and `noindex`, not a 404. This is the same as `/generate/<unknown>`. It's an accepted trade-off of awaiting params inside Suspense for instant navigation. | `GET /apps/definitely-not-an-app` returns status 200, `<meta name="robots" content="noindex">`. | ui-builder | accepted |
| QA-6 | P2 | Content | `/evidence` log links point to the GitHub repo, which is private, so they 404 for outside reviewers. | Open `/evidence` and click `docs/verification-log.md`. | lead | accepted until the repo is public |
