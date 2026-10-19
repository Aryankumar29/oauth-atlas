# QA report

Owner: verifier. Pre-merge findings from PR reviews (2026-10-20 IST), plus the SPEC §14 checklist. T-009 proper runs on the preview URL after T-008 deploys.

## SPEC §14 checklist

Baseline: local `main` @ c86ab7c, clean `.next`, `MOCK_LLM=1`, checked about 03:15 IST. Statuses:
- **PASS (local):** verified on main. Items that also need a deploy are re-checked on the preview.
- **PENDING:** needs the preview, real keys, or work that hasn't landed.
- **FAIL:** checked and not met.

### Must-have

| # | Criterion | Status | Evidence / what's left |
|---|---|---|---|
| 1 | `npm run check` passes; deployed on Vercel; works in incognito | PASS (local) / PENDING (deploy) | 13 files, 118/118 tests, "OK: 100 apps, 5 guides", build OK. Deploy and incognito are checked at T-009. |
| 2 | `npm run test:e2e` passes in `MOCK_LLM=1` (library, guide, generate) | PASS | 5/5 in 16.6 s: home, /apps (100 tracked + difficulty filter), queued → /generate, /apps/gmail (Composio box + 3 milestones), Miro → /generate/<id> with MOCK banner. |
| 3 | Library lists 100 seed apps with four filters; status counts correct | PASS | Header "100 tracked · 5 guides · 0 tested". The counts match the data: seed has 5 `verified` + 95 `queued`, and nothing is `tested` until the T-011 attempts upgrade GitHub/Notion. Filters: difficulty, approval model, Composio-managed, tier. |
| 4 | 5 guide pages render: own-app box, 3 milestones with basis, gates, unknowns | PASS | GitHub/Notion/Slack/Gmail/Instagram are prerendered. Gates: 2/1/3/4/3. Unknowns: 3/4/4/4/5. Bases are stated on every milestone. |
| 5 | Difficulty from `lib/difficulty.ts`; unit tests on 5 fixtures pass | PASS | `tests/difficulty.test.ts`. `validate:guides` enforces verdict == computed. Scores: 1/1/3/5 (send-only 3)/4. |
| 6 | Every demo guide has ≥3 primary sources and timestamped probes | PASS | Distinct primary URLs: 8/4/8/7/7. Probes: 3/2/2/2/2, all with UTC timestamps. I re-fetched 17 primary quotes (T-004 review) and all matched. |
| 7 | ≥2 real recorded setup attempts (GitHub, Notion) with screenshots | **FAIL / PENDING** | `docs/verification-log.md` GitHub and Notion entries are still PENDING (T-011), and `docs/screenshots/` doesn't exist. |
| 8 | Live generation for Miro or Calendly in < 3 min: shareable `/generate/[runId]`, Composio status, probes, persisted in Redis | PENDING | Needs real keys plus Upstash on the preview. Mock flow passes (e2e #5). |
| 9 | Timeout or failure yields a labeled partial guide, not a blank page | PASS (mock) | Pipeline tests: hung research → partial, extraction never validates → partial, no docs → partial. Manual mock runs of "asdfgh" and "bo" give status partial with MOCK, Live-generated and Partial banners, "Difficulty: unknown (partial result)", hands-on/wait "unknown", and a guessed-website note. To re-check live at T-009. |
| 10 | Cached Miro and Calendly guides exist; rate limit active on the public deploy | PENDING | `DEMO_CACHE_SLUGS` = miro, calendly. They need `scripts/cache-guide.ts` or real runs against Upstash. The rate limit (5/IP/hour, 429 + Retry-After) is in code, and mock runs are exempt. Verify both on the preview. |
| 11 | Evidence panel shows source, date, status, confidence | PASS | GuideView "Evidence" lists sourceUrl, sourceType · retrieved date, a status badge and "<confidence> confidence". `/evidence` shows the methodology and the 6 status definitions. |
| 12 | README explains setup, key decisions, limitations | PENDING (T-008) | The current README still has a "Planned architecture" section (pre-build). It needs the T-008 rewrite before it can be judged. |
| 13 | No credentials or client secrets in repo or screenshots | PASS (repo) / PENDING (screenshots) | `git grep` for the secret patterns is clean outside docs/agent defs. The client bundle has no key names or server SDKs. Screenshots don't exist yet; re-check after T-011. |

### Nice-to-have

| Item | Status | Note |
|---|---|---|
| Slack attempt logged | not done | verification-log Slack entry is empty |
| Microsoft guide | not done | T-012 |
| Critique step | not done | no critique step in `lib/agent` |
| Print/PDF export | not done | |
| Reader-service fallback | done | `fetchDoc` reader step, tested; enabled unless MOCK or `READER_FALLBACK=0` |
| Batch script > 0 guides | not done | T-007 `scripts/generate-library.ts` isn't on main |
| `/evidence` renders a corrections table | not done | it links to `docs/corrections.md` on GitHub (private repo, QA-6) |

### T-009 plan (preview URL)

1. Run `E2E_BASE_URL=<preview> npx playwright test` (real LLM, so the Miro spec runs live).
2. Live red team with Miro, Calendly, Toggl Track, a non-OAuth app and garbage input. For each, record:
   - the Composio status
   - whether probes are present and timestamped
   - that no primary claim is off-domain
   - that difficulty matches `lib/difficulty.ts`
   - that a partial result is labeled
   - the run time (< 3 min)
3. Rate limit: 6 live runs from one IP should give a 429 on the 6th. Check that cache hits are free.
4. Client bundle has no secrets; incognito load of /, /apps, /apps/gmail, /evidence, /generate.
5. Re-fetch ≥3 cited URLs per guide (drift check). Re-check items 7, 12 and 13 once T-011 and T-008 land.

## Bugs

| ID | Pri | Area | Finding | Repro | Owner | Status |
|---|---|---|---|---|---|---|
| QA-1 | P0 | T-005 validator | An off-domain source can stay `primary`. `lib/agent/validate.ts` only checks that the quote appears in *any* fetched doc. It never compares the source host with the app's domain or docs hosts, and never checks the quote against the doc at the cited URL. | `validateGuide` on a guide with `evidence.sourceUrl = https://some-random-blog.example/...`, `status: primary`, and a fetched doc from that blog containing the quote: the status stays `primary`. | pipeline-engineer | fixed in db71776 |
| QA-2 | P1 | T-005 fallback guide | `fallbackGuide` milestones use `handsOnHours {0,0}` / `wait {0,null}`, so a failed run renders "0–0 min" and "0+ days" next to "basis: unknown". | Any run with no fetchable docs, then open `/generate/<id>`. | pipeline-engineer / ui-builder | fixed in 98aa40a |
| QA-3 | P2 | T-005 boundaries | No `import "server-only"` in `lib/store.ts`, `lib/agent/deps.ts`, `lib/agent/llm/*`. No leak today (the client bundle grep is clean), but nothing guards against one. | `git grep server-only` returns nothing. | pipeline-engineer | accepted (lead) |
| QA-4 | P2 | T-005 demo cache | `cacheGuide` accepts any valid guide. A `generatedBy: "human"` file served from `/generate` would lose the "Live-generated, verify" banner. | `npx tsx scripts/cache-guide.ts data/guides/github.json` (with MOCK/memory). | pipeline-engineer | fixed in db71776 |
| QA-5 | P2 | `/apps/[slug]` (fix/guide-suspense) | An unknown slug returns HTTP 200 with the not-found UI and `noindex`, not a 404. This is the same as `/generate/<unknown>`. It's an accepted trade-off of awaiting params inside Suspense for instant navigation. | `GET /apps/definitely-not-an-app` returns status 200, `<meta name="robots" content="noindex">`. | ui-builder | accepted |
| QA-6 | P2 | Content | `/evidence` log links point to the GitHub repo, which is private, so they 404 for outside reviewers. | Open `/evidence` and click `docs/verification-log.md`. | lead | accepted until the repo is public |
| QA-7 | P1 | T-005 official domains | `isOfficialUrl` false positives. (1) User-generated content on official domains counts as primary: sites.google.com, groups.google.com, storage.googleapis.com, any `*.slack.com` workspace, techcommunity.microsoft.com, any github.com repo, and community.miro.com / community.calendly.com for the demo apps. (2) `registrable()` keeps 2 labels, so a user-entered `acme.co.uk` makes all of `co.uk` official, and `foo.github.io` makes all of `github.io` official. (3) A guessed website (`toggltrack.com`, `websiteGuessed: true`) becomes official. | tsx: `isOfficialUrl("https://evil.co.uk/x", officialDomainsFor(resolveApp("https://acme.co.uk")))` returns true. | pipeline-engineer | fixed in aeadf09 (residuals: QA-10) |
| QA-8 | P2 | T-005 official domains | False negatives (downgraded to secondary): developers.google.com for youtube; learn.microsoft.com for outlook, one-drive, onenote, microsoft-todo, linkedin; developer.atlassian.com for bitbucket and trello. Add `OFFICIAL_DOMAINS` rows. | `isOfficialUrl("https://developers.google.com/youtube/...", officialDomainsFor({slug:"youtube", website:"https://www.youtube.com"}))` returns false. | pipeline-engineer | fixed in aeadf09 |
| QA-9 | P1 | T-005 resolve | Short queries fuzzy-match the wrong seed app: `resolveApp("X")` returns **Dropbox**, because "x" is a substring of "dropbox" and the twitter seed name is not an exact match. The run is then generated for the wrong app. The alternatives are listed in unknowns, but the headline app is wrong. | tsx: `resolveApp("X").slug` is `"dropbox"`; `/generate` with "X". | pipeline-engineer | fixed in a06f6ab |
| QA-10 | P2 | T-005 official domains | Residuals after aeadf09. (1) Path-based UGC on official hosts still counts as primary: learn.microsoft.com/…/answers/questions/…, support.google.com/<product>/thread/…, developers.facebook.com/community/…. (2) `github.com/<slug>` is official by default for every app (e.g. github.com/calendly) with no ownership check. (3) Not a bug, by design: docs.composio.dev is not official for provider claims, so Composio-sourced claims grade secondary. | tsx: `isOfficialUrl("https://support.google.com/mail/thread/123", officialDomainsFor(resolveApp("Gmail")))` returns true. | pipeline-engineer | (1) fixed in a06f6ab; (2) open; (3) by design |
| QA-11 | P2 | T-005 resolve | A URL input with a multi-part TLD is named from the second-level label: `resolveApp("https://acme.co.uk")` gives slug `co`, name "Co". resolve.ts `baseDomain` keeps 2 labels; `validate.ts` `registrable()` already handles this case. | tsx: `resolveApp("https://acme.co.uk")` returns `{slug: "co", name: "Co"}`. | pipeline-engineer | fixed in f1d601c |
| QA-12 | P2 | T-005 official domains | The UGC path denylist matches `/thread/` and `/community/` anywhere in the path, so a real docs page with that segment is downgraded (hypothetical example: `docs.slack.dev/messaging/.../thread/`). Real pages checked (learn.microsoft.com graph/entra, support.google.com/.../answer, Gmail `users.threads`, docs.github.com/en/communities) are not affected. Consider anchoring the patterns to the hosts: `support.google.com/*/thread/`, `developers.facebook.com/community/`. | tsx: `isOfficialUrl("https://docs.slack.dev/messaging/retrieving-messages/thread/", …Slack)` returns false. | pipeline-engineer | open |
| QA-13 | P2 | T-005 resolve | URL inputs match seeds only by registrable domain, never by exact host or by seed docs/console hosts. As a result: `https://mail.google.com` and `https://calendar.google.com` resolve to the generic `google` (Google Workspace) seed instead of `gmail`/`googlecalendar`, which are only listed as alternatives; and `https://developers.notion.com` resolves to a non-seed "notion" (seed website is notion.so), losing the seed's Composio status and approval model. Was already on main before f1d601c. Fix: match the exact seed website host first, then seed docsUrl/consoleUrl hosts, then registrable domain. | tsx: `resolveApp("https://mail.google.com").slug` returns `"google"`. | pipeline-engineer | fixed in 446f41f, rebased as 67cf9cd (residual: www.microsoft.com/microsoft-teams → microsoft, Teams as alternative; host-only match ignores path) |
| QA-14 | P1 | T-007 batch | `--only <curated> --force` reruns the pipeline for a hand-curated guide and would overwrite `data/guides/<slug>.json` if the live output passes the QA gate. Nothing protects `generatedBy: "human"` / tier `verified`/`tested` files. | `MOCK_LLM=1 npx tsx scripts/generate-library.ts --only github --force --dry-run`: the pipeline runs and only the gate stops it. | pipeline-engineer | fixed in 2c456c2 |
| QA-15 | P2 | T-007 batch | (1) The QA gate's distinct-source count includes the probe discovery URL (`sourceType: test`), so a guide's own probe can count toward "≥3 sources". (2) `--limit abc` is silently ignored. | `qaGate` source set; `--limit abc --dry-run` runs with no limit. | pipeline-engineer | fixed in 2c456c2 |
