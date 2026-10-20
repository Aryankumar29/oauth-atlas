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
| 7 | ≥2 real recorded setup attempts (GitHub, Notion) with screenshots | **FAIL (cut)** | T-011 was cut at 03:30 IST. `docs/verification-log.md` records the GitHub and Notion attempts as "Not performed", and evidence is primary sources plus automated probes only. No `docs/screenshots/`. This is a known, disclosed miss against §14 (README Limitations says so). |
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

## T-009 results (preview, 2026-10-20 05:25–06:00 IST)

- **Target:** preview `https://oauth-atlas-qwv4suwb6-aryn7.vercel.app` (deployment `dpl_QekUQfp6bs1BCLhZh465FetokGJF`), built from main `d628e3f`. Live provider: Anthropic `claude-opus-5-5`; store: Upstash.
- **Access:** the preview is behind Vercel Authentication, so every request went through `vercel curl --deployment …`.
- **Not covered:** `E2E_BASE_URL` Playwright against the preview was not run. It needs the protection-bypass secret, and I don't read secrets. The same assertions were checked by hand over `vercel curl`, below.

### SPEC §14 on the preview

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | check passes; deployed; incognito | **PASS** | check green on main (3× on the prod commit). **Prod** `https://oauth-atlas.vercel.app` (dpl_3cddrZeG…, main b343790), checked with no cookies or auth at about 06:30 IST: all 11 app routes return 200 with no MOCK banner; `/apps` shows 100 tracked. `/.env`, `/.env.local`, `/.env.example`, `/.git/config`, `/package.json`, `/README.md` and `/docs/*` all return 404. A grep of all 11 client JS/CSS assets (738 KB) for key names, `sk-ant-`, `AIza…`, `x-api-key`, `@anthropic-ai` and `upstash.io` found 0 hits. HSTS is set. `GET /api/generate` returns 405. |
| 2 | e2e | **PASS** | 5/5 locally in MOCK mode, and **5/5 against prod** (`E2E_BASE_URL=https://oauth-atlas.vercel.app`, 9.4 s). The Miro spec was a demo-cache hit (2.7 s), so no live run was spent. |
| 3 | 100 apps, four filters, correct counts | **PASS** | `/apps` header "100 tracked · 5 guides · 0 tested"; 0 tested is correct after the T-011 cut. |
| 4 | 5 guide pages with own-app box, 3 milestones, gates, unknowns | **PASS** | `/apps/{github,notion,slack,gmail,instagram}`: `composio-box` ×1 and `milestone` ×3 each, no MOCK banner. |
| 5 | difficulty from `lib/difficulty.ts` | **PASS** | Live runs report `computed` difficulty; the LLM value is ignored (`llm=null`). Curated scores are unchanged. |
| 6 | ≥3 primary sources and timestamped probes per demo guide | **PASS** | Drift re-check at about 05:55 IST: 17/17 cited primary URLs return 200 and every quote still matches. |
| 7 | ≥2 recorded setup attempts with screenshots | **FAIL (cut)** | T-011 was not performed (see above). |
| 8 | Live Miro or Calendly in < 3 min, Composio + probes, persisted in Redis | **PASS** | See the per-run table: Miro 168 s and Calendly 127 s, Composio yes, 5 and 6 timestamped probes. The run pages load from a separate invocation, so they are persisted in Redis. |
| 9 | timeout/failure gives a labeled partial guide | **PASS (tests + mock)**; not triggered live | No live run hit a deadline. Deadline and abort behaviour was verified in the QA-16/QA-17 reviews. Garbage input produced a labeled low-confidence guide; see QA-20. |
| 10 | cached Miro and Calendly; rate limit on the deploy | **PASS** | Miro and Calendly both return `cached:true` (Calendly from run 033a8a42). The 6th live run in the hour returned **HTTP 429** with `Retry-After: 3600` and the rate-limit message. Cache hits still worked after the 429, so they are free. |
| 11 | evidence panel shows source, date, status, confidence | **PASS** | Run pages list evidence with URL, sourceType, retrieved timestamp, status badge and confidence. |
| 12 | README: setup, decisions, limitations | **PASS** | T-008 final pass, plus the T-011 wording fix on main. |
| 13 | no credentials in repo or screenshots | **PASS** | I downloaded all 10 client JS chunks from the preview. A grep for API key names, `sk-ant-`, `x-api-key`, `@anthropic-ai` and `upstash` found 0 hits. The repo secret grep is clean, and there are no screenshots. |

### Live red team (preview)

| Input | Time | Final | Resolve | Composio | Probes | Difficulty | Primary handling | Labels |
|---|---|---|---|---|---|---|---|---|
| Miro (lead run 8e304b6b) | 168 s | done | seed | yes | 5, timestamped (discovery 403, bot-blocked) | 1 | 4/4 primary evidence on developers.miro.com, 0 off-domain. Hand-checked the ">50 MAU … >10 installs" Marketplace claim against developers.miro.com/docs/miro-marketplace: verbatim. | Live-generated banner. Unknowns include "Could not fetch http://localhost:3000/" (QA-18). |
| Calendly (lead run 033a8a42) | 127 s | done | seed | yes | 6, timestamped | 1 | All primary evidence on developer.calendly.com, 0 off-domain | Live-generated. Unknowns include "Could not fetch http://localhost" (QA-18). |
| Toggl Track | 113 s | done | guessed `toggltrack.com` | unknown (not in snapshot; correct) | **0** (guessed domain) | 5 (no-self-serve; Toggl uses API tokens, so plausible) | 15/20 primaries downgraded as "not official": engineering.toggl.com and support.toggl.com are official but `toggl.com` was never in the set (QA-19). community.toggl.com was correctly not primary. | Live-generated, confidence low, guessed-website note |
| Netflix (non-OAuth) | 93 s | done | guessed `netflix.com` | unknown | 3, timestamped | 5 (no-self-serve), correct | help.netflix.com terms downgraded (guessed website excluded, QA-19). Press articles are secondary. | Live-generated, confidence low |
| `qwzx plorbt 9000` (garbage) | 74 s | **done** | guessed | unknown | 0 | **5** | Sources were unrelated (sneakers, a radio station) and all downgraded | Verdict honestly says no sources describe the app. Live-generated, confidence low. QA-20. |
| 6th live run (`Linear`) | 0.4 s | **429** | — | — | — | — | — | Retry-After 3600 |

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
| QA-16 | P2 | LLM adapter (fix/llm-anthropic) | After the pipeline's hard deadline abandons an extract call, the underlying Anthropic request can keep running (and billing) for up to its fixed 180 s timeout. There is no AbortSignal and the timeout isn't capped at the pipeline's remaining budget. Since 52d8567 (`maxRetries: 0`, per-attempt `remainingMs()`), this is bounded to one request (~32k output max), the run itself is unaffected, and on Vercel the 300 s cap bounds it. Fix: `timeout: min(EXTRACT_TIMEOUT_MS, deadlineAt - now)` plus an AbortSignal at the deadline. | Fake `create()` on `anthropicAdapter`: 1 call, `timeout: 180000` regardless of the pipeline's remaining time. | pipeline-engineer | fixed in 5badfdb |
| QA-17 | P2 | Pipeline deadlines (5badfdb) | When the soft-deadline AbortSignal wins the race against `withTimeout`, research fails with "Anthropic request cancelled at the pipeline deadline". The pipeline's partial check only matches `/timed out/`, so the unknowns line "Generation hit the soft deadline; discovery stopped early." is not added. The guide is still labeled partial (no-docs fallback or `stoppedEarly`); only the explanation is missing. Fix: check `LlmError.kind === "timeout"`. | tsx: real `anthropicAdapter` with a `create()` that hangs until abort; soft 6.3 s → unknowns contain only "Research call failed: … cancelled …". | pipeline-engineer | fixed in eeb500f |
| QA-18 | **P1** | Pipeline discover (security) | SSRF. Discovery fetches every URL the model cites (`citedUrls`, from model text and web-search content an attacker can influence) server-side. The only check is `/^https?:\/\//`, so loopback, private, link-local and metadata addresses are fetched and their text is fed to extraction. | Preview runs Miro 8e304b6b and Calendly 033a8a42: unknowns "Could not fetch http://localhost:3000/" and "Could not fetch http://localhost". Fix: reject non-https, `localhost`, IP literals in loopback/private/link-local/CGNAT ranges and single-label hosts in discover + fetchDoc; optionally fetch only official/docs hosts. | pipeline-engineer | fixed in b632dcd (residuals: QA-22) |
| QA-19 | P2 | Official domains for guessed websites | When the website is guessed (not in the seed), the official set has no provider domain at all (since QA-7.3), so every real docs source is downgraded to secondary and probes target the guessed host. Toggl Track guessed `toggltrack.com` (real: `toggl.com`): 15/20 primaries downgraded, 0 probes. Netflix: help.netflix.com downgraded. Conservative, but the guides lose all primary evidence. Fix: once research returns docs, promote the docs' registrable domain to official when it matches the resolved name, or add these apps to the seed. | Preview runs b2d5c98a (Toggl), 77315b6d (Netflix). | pipeline-engineer | open |
| QA-20 | P2 | Generation for nonexistent apps | Garbage input (`qwzx plorbt 9000`) completes as a **done** (not partial) guide with difficulty **5 "Very hard"** derived from the absence of evidence (no-self-serve gate). The verdict text is honest and confidence is low, but the 5/5 badge is presented as a finding. Fix: when the guide has zero primary or official sources, mark it partial and show difficulty as unknown (reuse `isDifficultyUnknown`). | Preview run ec1be11b. | pipeline-engineer | open |
| QA-21 | P2 | Pipeline `withTimeout` | Intermittent unhandled rejection. `withTimeout(llm.extract(...), remainingMs(), ...)` starts the LLM call before `withTimeout` runs. When `ms <= 0`, `withTimeout` rejects without subscribing to that promise, so its later rejection is unhandled (and the request was still issued). Same shape for research in discover. Seen as a vitest "1 unhandled error" from tests/agent/deadline.test.ts that made `npm run check` exit 1 (1 of 5 full runs). Fix: `p.catch(() => {})` on the `ms <= 0` path, or check remaining before calling. | `npm run check` on main+b632dcd, run 1 of 5. | pipeline-engineer | fixed in 21aeccf |
| QA-22 | P2 | SSRF guard residuals (b632dcd) | (1) IPv6 transition prefixes are allowed: `https://[64:ff9b::7f00:1]` (NAT64) and `https://[2002:7f00:1::]` (6to4) embed 127.0.0.1. Block 64:ff9b::/96 and 2002::/16 by their embedded IPv4, and 2001::/32 Teredo. (2) DNS-rebinding TOCTOU between the guard's lookup and the fetch's own resolution; the full fix pins the resolved IP via a dispatcher `lookup`. | tsx: `checkFetchUrlResolved("https://[64:ff9b::7f00:1]")` returns ok. | pipeline-engineer | (1) fixed in 21aeccf; (2) DNS rebinding open (P2, accepted today) |
