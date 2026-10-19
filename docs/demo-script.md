# 5-Minute Demo Script

Before you start:
- Warm the cache for Miro and Calendly (`docs/deploy.md` §4).
- Open the tabs: `/apps`, `/apps/gmail`, `/apps/instagram`, `/apps/github`, `/generate`, `/evidence`. Also open the cached Miro run page as the fallback.
- Use the deployed URL `<!-- LIVE_URL -->`, not localhost.

## 0:00–0:30 — The problem

"A developer building an agent can write the OAuth code. What they can't easily learn is whether to use a managed app or their own, whether the provider will let them ship, how long approval takes, and what will block them. So they guess, over-scope, or hit a weeks-long gate late."

## 0:30–1:15 — Library and filters (`/apps`)

- "100 tracked apps; 5 have curated guides. The rest are queued for live generation. We chose quality tiers over fake coverage."
- Search, then use the filters: **difficulty**, **approval model**, **Composio-managed**, **tier**. Filter to difficulty 5, then clear it.
- Point at a queued card: it links straight into live generation.

## 1:15–2:15 — Gmail, the hard path (`/apps/gmail`)

- Start with the box **"Do you need your own OAuth app?"** Gmail is Composio-managed, so stay on managed auth until you need your own brand, scopes, or quota.
- Difficulty **5**, computed from the gates, not by the LLM. `gmail.readonly` / `gmail.modify` are restricted scopes, which means verification plus an annual CASA assessment.
- The **send-only** profile (`gmail.send`) scores **3**: sensitive-scope verification, no CASA. "Pick the narrowest scope and the whole path changes."
- Three milestones: dev-ready under an hour, pilot-ready (Testing mode, 100 test users, 7-day refresh tokens), production-ready at 14+ days with no upper bound.

## 2:15–3:00 — Instagram, weeks of waiting (`/apps/instagram`)

- Difficulty **4**. Testing works only for users with a role on your app.
- To reach anyone else you need Meta Business Verification **and** App Review per permission.
- Show the evidence statuses. The review time ("about 20 days", 9–29 days reported) is **secondary/community**, because Meta publishes no SLA. "We tell you which numbers are community-sourced."

## 3:00–3:30 — GitHub, instant (`/apps/github`)

- Difficulty **1**. Register an OAuth app or GitHub App in minutes, with no review.
- Corrections: up to 10 callback URLs; user tokens expire by default (8 h access / 6-month refresh). GitHub *does* publish OAuth discovery metadata, which the probe confirmed.
- Show "Copy as Markdown" or "Copy link". The guide is shareable.

## 3:30–4:30 — Live generation (`/generate`)

- Submit `Miro`. Narrate the steps as they stream:
  1. resolve
  2. **Composio** check
  3. search and fetch official docs, while the **probe** hits discovery, authorize, and console endpoints in parallel
  4. extract
  5. verify quotes and compute difficulty
  6. save
- "A claim is **primary** only if the source is an official Miro host *and* the quote is in the doc fetched from that exact URL. Off-domain sources drop to secondary."
- Open the result. Show the "Live-generated — verify." banner, the probe-backed PKCE claim (if found), the sources, and the **Unknowns** section.
- If the cached guide appears ("Cached demo guide, generated …"), say so. "Regenerate live" re-runs the pipeline.

**Fallback if the LLM is slow** (no steps after about 20 s, or past 1:30): "Live generation can take up to three minutes. Here's the cached run from earlier." Switch to the pre-opened Miro run tab. If a run hits the 150 s soft deadline, it still returns a guide labeled **partial**. Show that label as a feature.

## 4:30–5:00 — Evidence and limits (`/evidence`)

- How claims are checked; the statuses tested / primary / secondary / inferred.
- One correction, from `docs/corrections.md`: "Research said Slack extended the unlisted-app throttle to existing installs on 2026-03-03. We found no official source, so it isn't in the guide."
- Limits: no completed provider approvals, community-sourced review times, live guides are drafts, and 5 live runs per IP per hour.
- Close: "This is the decision layer above provider docs and managed OAuth directories."

## Rules

- Never improvise an approval claim or a review time. Read what the guide says, with its status.
- If a source is login-walled, point to the guide's **Unknowns** section instead of guessing.
- `/evidence` links to repo docs 404 while the repo is private (QA-6). Open `docs/corrections.md` from the repo if needed.
