# Corrections log

These are claims that common tutorials or older knowledge get wrong, checked against sources on 2026-10-20. The guide-researcher re-verifies each entry in T-006a.

| # | Topic | Commonly believed | What sources say now | Source | Status |
|---|---|---|---|---|---|
| 1 | GitHub OAuth apps | One callback URL; tokens never expire | Up to 10 callback URLs; "Expire user access tokens" enabled by default (8 h access / 6-month refresh) | https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app · https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps | primary; to confirm in T-011 |
| 2 | Slack distribution | Unlisted distribution is enough for production | New unlisted commercial apps: `conversations.history`/`replies` limited to 1 req/min with ≤15 objects; Marketplace needs ≥10 active installs; review up to 10 business days plus up to 10 weeks | https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps · https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide · https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement | primary |
| 3 | X API | Free/Basic/Pro tiers | Pay-per-use credits; no free tier for new developers except Public Utility apps | https://docs.x.com/x-api/getting-started/pricing | primary |
| 4 | Xero | Revenue-share App Store model | Connection-based plans from 2026-03-02 (Starter 5 connections free … Advanced A$1,445/mo); API data may not train AI/ML models | https://developer.xero.com/pricing | primary |
| 5 | Google CASA | "Tier 2 / Tier 3" | Now AL1 / AL2; annual; assigned by Google | https://support.google.com/cloud/answer/13465431 | primary |
| 6 | Meta App Review | "A few days" | Dashboard reportedly says "within 20 days" (2026); no official SLA page found | https://www.reddit.com/r/facebook/comments/1u1h6rl/ | secondary (community); confirm via screenshot |
| 7 | Salesforce | Create a Connected App | New Connected Apps blocked from Spring '26; use External Client Apps | https://help.salesforce.com/s/articleView?id=005228017 | secondary (page JS-rendered) |
| 8 | Intuit refresh tokens | Rolling 100 days, effectively permanent | Plus a 5-year hard maximum (`x_refresh_token_hard_expires_in`) | https://blogs.intuit.com/2025/11/12/important-changes-to-refresh-token-policy | secondary (403 to fetcher) |
