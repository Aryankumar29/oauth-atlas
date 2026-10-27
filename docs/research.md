# Research brief: OAuth app setup & approval guides (Composio APM Integrations take-home)

Last checked: 2026-10-20 (IST). Researcher: Grok Bot, executor subagent. **Research only. No app code yet.**

**How to read the evidence labels in this brief**
- **[S]** Sourced: read directly on an official provider page (URL given). The page was fetched on 2026-10-20.
- **[S2]** Secondary source: a vendor blog, community post, or search synthesis. I could not fetch the official page (403, JS-rendered, or login-walled). Treat as likely but unconfirmed.
- **[A]** Anecdotal: a forum or Reddit report. Never present this as the provider's commitment.
- **[P]** Probed: I tested it myself from the box without credentials (an OIDC discovery fetch, or a fake-client authorize request). See §6.
- **[I]** Inferred: my reasoning. Not stated anywhere.
- **[?]** Unknown or unverified.

---

## 0. TL;DR

1. **What developers actually need answered.** It is not "how do I create a client ID." That part takes 5 minutes for almost every provider. The real question is when real users outside the developer's own team can connect, and what gates stand in the way. Gates come in several forms:
   - review (Google, Meta, Slack Marketplace, Zoom, HubSpot listing)
   - legal-entity verification (Meta Business Verification, Microsoft Partner Center, LinkedIn Page association)
   - security assessments (Google CASA, Zoom security evidence, Xero Advanced tier)
   - payments (X pay-per-use, Xero Core and above)
   - install caps and throttles applied until you're listed (HubSpot 25 installs, Slack 1 req/min, Xero 5 connections)
2. **Composio already solves day 0 for 123 toolkits** through managed OAuth apps. Its docs say you need your own app when you want your brand on the consent screen, custom scopes, dedicated quota, faster polling, or a custom instance. **That moment is when the approval path suddenly becomes the developer's problem.** Composio's KB covers it only thinly: for example, its Google guide says "complete Google's required verification" and links out. That gap is the product.
3. **Organize every guide around three milestones:**
   - **M1 Dev-ready:** a working token for yourself or test users.
   - **M2 Pilot-ready:** a limited set of external users or tenants.
   - **M3 Production-ready:** unrestricted public users.
   Each milestone gets its own time estimate, effort, blockers, and an agent-vs-human split. This framing is the clearest way to answer the question "is this an hour or weeks?"
4. **Recommended demo set (7):** GitHub (instant), Notion (instant, per-user page grants), Slack (easy to build, gated at scale), Gmail/Google (restricted scopes + CASA), Microsoft Graph/Outlook (enterprise tenant consent + publisher verification), Instagram/Meta (business verification + app review), Xero (paid connection tiers, certification, and an AI-training ban). Stretch: LinkedIn (partner-gated), Zoom (security evidence just to beta-share), QuickBooks (sandbox to production-keys questionnaire).
5. **Live agent:** use a Next.js app on Vercel. A streaming LLM tool loop (search → fetch official docs → probe OAuth endpoints → check Composio managed status → extract into a strict JSON schema with per-claim citations → validate) writes a guide reachable at a shareable `/guides/[slug]`. Keys needed: one LLM key, one search key (or an LLM with built-in web search), and storage. A Composio API key is optional.

---

## 1. What a provider OAuth app is, and how it fits with Composio

### 1.1 Concepts (three layers)

| Layer | Who owns it | What it is | Example |
|---|---|---|---|
| **Provider OAuth app** (aka client, connected app, app registration, integration) | The developer, or Composio when managed | A registration in the provider's developer console that yields a `client_id`/`client_secret`, allowed redirect URIs, requested scopes, and branding (name, logo, privacy policy). The provider reviews and verifies **this object**. | A Google Cloud project's OAuth client plus consent screen; a Slack app; a Microsoft Entra app registration |
| **Developer's integration** (Composio: *auth config*) | Developer | Your product's configuration that says "for toolkit X use OAuth app Y with scopes Z." A Composio auth config references either Composio's managed app or your own client ID and secret. | `ac_1234abcd` passed to `composio.create(user_id, auth_configs={...})` |
| **End-user connection** (Composio: *connected account*) | Each end user or tenant | The grant one user gives to the OAuth app: access token, refresh token, granted scopes, tenant/site ID. | User 123's Gmail grant |

Key implications:
- **One OAuth app serves all your users.** The app's review status caps what every connection can do:
  - Google: unverified apps hit a 100-user lifetime cap.
  - Meta: Standard Access works only for users who hold a role on the app.
  - HubSpot: 25 installs before listing.
- **Switching apps breaks existing connections.** Composio's docs say existing connected accounts stay tied to the auth config they were created with. Moving to your own app affects new connections only. Old users must re-authenticate or be migrated. [S] https://docs.composio.dev/docs/authentication/white-labeling-authentication
- **Enterprise customers add a fourth layer: the tenant admin.** The admin may need to consent, install, or allowlist your app (Microsoft Entra admin consent, Salesforce install-before-use, Google Workspace "Trusted" apps, GitHub org OAuth restrictions).

### 1.2 Composio managed auth vs bring-your-own (BYO)

[S] https://docs.composio.dev/toolkits/managed-auth (fetched 2026-10-20)
- Composio can provide the OAuth app, so you supply no client ID or secret. You can check this per toolkit with `GET https://backend.composio.dev/api/v3.1/toolkits/{slug}`. If `composio_managed_auth_schemes` contains the OAuth method, the toolkit is managed. This call needs an `x-api-key`.
- **123 toolkits are Composio-managed. 211 are BYO OAuth app.** The full lists are on the page; I saved a copy of the docs index at `/workspace/oauth-project/composio-index.txt`.
  - Managed (selection): Airtable, Asana, Box, Calendly, Canva, ClickUp, Confluence, Discord, Dropbox, Dynamics 365, Excel, Facebook, Figma, GitHub, GitLab, Gmail and all Google Workspace toolkits listed (Docs, Drive, Calendar, Sheets, Slides, Meet, Tasks…), HubSpot, Instagram, Intercom, Jira, Linear, LinkedIn, Microsoft Teams, Monday, Notion, OneDrive, Outlook, Pinterest, QuickBooks, Reddit, Salesforce, SharePoint, Slack, Stripe, TikTok Ads, Trello, WhatsApp, YouTube, Zendesk, Zoho*, Zoom.
  - BYO (selection): DocuSign, Shopify, Xero, Twitter/X, Spotify, TikTok, Snapchat, PayPal, Pipedrive, Netsuite, Workday, ServiceNow, Gusto, Klaviyo, Meta Ads, LinkedIn Ads, Google Admin, Google Chat, Google Contacts, Google Forms, Microsoft To Do, OneNote, Power BI, Salesforce Service Cloud, Vercel, Webflow, Wix, Razorpay, Clio Manage, many `*_MCP` toolkits.
  - **Interesting split:** LinkedIn is managed but LinkedIn Ads is BYO. Facebook and Instagram are managed but Meta Ads is BYO. Gmail is managed but Google Chat, Contacts, and Forms are BYO. **[I]** The BYO entries line up with partner-gated or restricted products, which is exactly where guides are most valuable.

[S] https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app gives these reasons to bring your own app:
1. Users would otherwise see "Composio wants to access your account" on the consent screen.
2. You need custom scopes.
3. Managed apps share quota across all Composio users.
4. Managed auth enforces a 15-minute minimum polling interval for triggers.
5. You need a custom or self-hosted instance (e.g., a private Salesforce subdomain).
6. Enterprise customers require your branding end-to-end.

BYO flow, per the same docs:
1. In the Composio dashboard, choose Create Auth Config.
2. The dashboard shows a **redirect URI** to register with the provider.
3. Register the provider app and copy the client ID and secret back into Composio.
4. Pass the auth config ID into the session.

White-labeling has four layers: Connect Link branding, the consent screen (needs your own app), the redirect proxy through your domain (otherwise `backend.composio.dev` flashes in the address bar), and the `callbackUrl` success page. [S] white-labeling page above.

**[?] Exact Composio callback URL:** I did not find it as static text in the docs. They say "the dashboard shows the redirect URI." A guide should tell users to copy it from the dashboard and not hard-code it.

Existing Composio provider guides are thin. Examples: [S] https://docs.composio.dev/kb/guide/platform-google-oauth, https://docs.composio.dev/kb/guide/toolkits-snapchat. These are troubleshooting notes. They don't cover approval timelines, costs, or blockers. **This is the gap the take-home fills.**

---

## 2. Taxonomy of setup-difficulty patterns

Each pattern below is a reusable "gate type." A single provider usually combines several. The guide schema in §4 models gates as a list.

| # | Pattern | What it means for the developer | Examples (evidence) |
|---|---|---|---|
| P1 | **Instant self-serve, no review** | Create the app in minutes and get tokens for any user right away. | **GitHub** OAuth/GitHub App: register under Developer settings, up to 10 callback URLs, no review [S] https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app. **Notion** public connection: create in the developer portal, then the client ID and secret appear [S] https://developers.notion.com/guides/get-started/public-connections. **Atlassian 3LO**: enable sharing with a toggle, but users see an "app has not yet been reviewed by Atlassian" warning until you go through the Marketplace process [S] https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/ |
| P2 | **Testing mode with user caps or short tokens** | Works immediately for allowlisted testers only. Tokens may expire early. | **Google** "Testing": ≤100 test users, and authorizations plus refresh tokens expire after 7 days (except basic openid/email/profile scopes) [S] https://support.google.com/cloud/answer/15549945. **Meta** Standard Access: only users with a role on the app [S] https://developers.facebook.com/docs/graph-api/overview/access-levels. **Zoom**: private apps are limited to your own account [S] https://developers.zoom.us/docs/distribute/sharing-private-and-beta-apps/ |
| P3 | **Per-scope review + security assessment** | Sensitive scopes need a review with a demo video and justification. Restricted scopes also need a paid annual third-party security assessment. | **Google** sensitive/restricted scopes; restricted ones (Gmail read, Drive full) require **CASA** annually [S] https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification, https://support.google.com/cloud/answer/13465431 |
| P4 | **App review + legal-entity verification** | Submit per permission with a screencast and test credentials. Your company must pass business verification with official documents. | **Meta** (Facebook, Instagram, WhatsApp): Advanced Access requires Business Verification (since 2023-02-01) plus App Review, then an annual Data Use Checkup [S] https://developers.facebook.com/docs/development/release/business-verification |
| P5 | **Partner program / gated permissions** | Beyond basic scopes you must *apply* to a program. Approval is discretionary, and some programs are closed. | **LinkedIn**: only `openid/profile/email/w_member_social` are open. Advertising API, SNAP (Sales), and Talent need approval. Compliance is closed [S] https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access |
| P6 | **Paid API access / plan-gated** | You need a credit card or paid plan before real usage, or above a usage threshold. | **X**: pay-per-use credits; no free tier for new developers except "Public Utility" apps [S] https://docs.x.com/x-api/getting-started/pricing (via curl), [S2] @XDevelopers 2026-02-06. **Xero**: Starter is free for up to 5 connections; Core costs A$35/mo for 50 connections, and so on [S] https://developer.xero.com/pricing |
| P7 | **Throttled or capped until listed in the marketplace** | Unlisted distribution technically works but is crippled by low limits. The listing review becomes mandatory in practice. | **Slack**: new non-Marketplace commercial apps get 1 req/min and 15 objects on `conversations.history`/`replies` [S] https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps. **HubSpot**: 25 installs before listing, 10 for private apps [S] https://developers.hubspot.com/docs/apps/developer-platform/build-apps/manage-apps-in-hubspot. **Zoom**: beta authorization URLs need approval, last 4 weeks, and allow 2 extensions [S] |
| P8 | **Marketplace listing review (long queue)** | A formal QA, security, and branding review measured in weeks, often with minimum-install prerequisites. | **Slack Marketplace**: preliminary feedback within 10 business days, functional review up to 10 weeks, ≥10 active installs throughout [S] https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide. **HubSpot**: ≥3 active unaffiliated installs, initial review within 10 business days, ≤60 days total [S]. **Salesforce AppExchange** security review: [S2] 4–6+ weeks, $999 per attempt for paid apps. **QuickBooks App Store**: [S2] |
| P9 | **Enterprise tenant consent / publisher identity** | Each customer org's admin may have to consent or install. Your publisher identity must be verified, or users get "unverified publisher" warnings or blocks. | **Microsoft Entra**: publisher verification needs a verified Microsoft AI Cloud Partner Program account. Since Nov 2020, users can't consent to unverified multitenant apps under risk-based step-up consent [S] https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview. Since July 2025, Microsoft-managed policy blocks user consent for Files/Sites.Read(Write).All [S2]. **Salesforce**: since Sept 2025, users can't self-authorize an uninstalled connected app; it must be installed first [S2] https://help.salesforce.com/s/articleView?id=005132365. **GitHub orgs**: OAuth app access restrictions are on by default for new orgs [S] |
| P10 | **Sandbox to production key gating** | Dev keys work only against sandbox companies. Production keys unlock only after a compliance questionnaire. | **QuickBooks (Intuit)**: App Assessment Questionnaire under Production Settings; requires a live host domain, EULA, privacy policy, and tested connect/disconnect/reconnect [S2] https://docs.codat.io/integrations/accounting/quickbooksonline/qbo-app-assessment-questionnaire. **Salesforce**: separate sandbox login host (`test.salesforce.com`) [I] |
| P11 | **App-type deprecations and migrations** | The console path in older tutorials is gone. Guides go stale fast. | **Salesforce**: new Connected Apps can't be created from Spring '26; use External Client Apps [S2] https://help.salesforce.com/s/articleView?id=005228017. **Instagram**: Basic Display API ended 2024-12-04; the new API supports professional accounts only [S2]. **X**: tiers replaced by pay-per-use on 2026-02-06 [S2] |
| P12 | **Data-use policy constraints (AI-specific!)** | The policy itself may forbid your use case, which matters a lot for AI agents. | **Xero**: API data may not be used to train AI/ML models, and bots/browser automation that simulate user actions are banned (T&Cs updated 2026-03-02) [S] https://developer.xero.com/pricing. **Google**: Limited Use rules; the demo video must show explicit consent if data is used for AI model training [S] https://support.google.com/cloud/answer/13464321 |
| P13 | **No self-serve OAuth / request-access only** | You must contact sales or partnerships, or be a customer, to get a client. | LinkedIn Compliance APIs (closed) [S]. **[?] Candidates I have not verified:** Workday, NetSuite, ServiceNow, Gong, ZoomInfo. These are BYO on Composio and are often tenant-registered or partner-gated. The live agent should flag "no public self-serve path found" as a first-class outcome. |

**Cross-cutting nuances every guide should cover:**
- **Redirect URIs.**
  - Matching is exact. HTTPS is usually required.
  - LinkedIn: absolute URLs only, query params ignored, no `#` [S] https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow.
  - GitHub OAuth apps allow up to 10 callback URLs [S].
  - Google: adding redirect URLs or changing the product name after verification can trigger re-verification [S] https://support.google.com/cloud/answer/7454865.
  - With Composio, register the dashboard-provided callback, or your proxy domain if you white-label.
- **Refresh-token behaviour.** This is where production integrations most often fail silently:

| Provider | Behaviour | Evidence |
|---|---|---|
| Google | 7-day expiry in Testing. Refresh token dies after 6 months unused or on password change (Gmail scopes). Max 100 refresh tokens per account per client; the oldest is silently revoked. | [S] https://developers.google.com/identity/protocols/oauth2 |
| Microsoft | Refresh token lasts 90 days, or 24 h for SPA redirect URIs. Tokens roll on each use. | [S] https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens |
| GitHub | When expiring tokens are enabled (now the default for new OAuth apps): access token 8 h, refresh token 6 months. | [S] |
| LinkedIn | Access token 60 days. Programmatic refresh tokens (365 days, not extended on use) are available only to approved Marketing partners. | [S] https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens |
| Atlassian | Rotating refresh tokens. Needs the `offline_access` scope. | [S] https://developer.atlassian.com/cloud/oauth/getting-started/refresh-tokens/ |
| X | Access token about 2 h. Needs `offline.access` for a refresh token. | [S2] |
| QuickBooks | 100-day rolling refresh token plus a new **5-year hard maximum** (first expiries Feb 2027 for restricted scopes, Oct 2028 for accounting/payments). | [S2] https://blogs.intuit.com/2025/11/12/important-changes-to-refresh-token-policy (403 to my fetcher) |

- **Rate limits tied to app status:** Slack's non-Marketplace throttle; Xero's 1,000/day/org on Starter vs 5,000 on paid plans [S]; Composio managed apps share quota across all Composio users [S].
- **Recurring obligations:** CASA every 12 months [S]; Meta's annual Data Use Checkup [S]; Xero's annual security assessment on Advanced and Enterprise [S]; Zoom beta URL renewals [S].

---

## 3. Recommended demo apps and draft fact sheets

**Why these seven:** each one shows a *different dominant gate*, together they cover consumer, workspace, enterprise, social, and financial providers, and they include both Composio-managed and BYO toolkits. That way the guides answer "why would I leave managed auth, and what happens when I do?"

| App | Dominant challenge | Composio | M1 Dev-ready | M3 Production-ready (realistic) |
|---|---|---|---|---|
| GitHub | None (baseline); App vs OAuth-app choice | Managed | ~10 min | Same day |
| Notion | None; per-user page grants | Managed | ~10 min | Same day |
| Slack | Gated at scale (throttle → Marketplace) | Managed | ~15 min | Weeks to ~3 months (Marketplace) |
| Gmail (Google) | Restricted scopes + CASA | Managed | ~30 min (Testing) | Several weeks to months; $ for CASA |
| Microsoft Graph (Outlook) | Tenant consent + publisher verification | Managed | ~20 min | Days (if Partner account exists) + per-customer admin consent |
| Instagram (Meta) | Business verification + App Review | Managed | ~30 min | ~2–6 weeks [A] |
| Xero | Paid connection tiers + certification + AI-training ban | **BYO** | ~15 min (demo company) | Plan-dependent; certification for >50 connections |

Stretch candidates: **LinkedIn** (partner-gated, discretionary), **Zoom** (security evidence needed even to beta-share), **QuickBooks** (sandbox to production-keys questionnaire), **X** (pay-per-use).

> In the fact sheets below, timelines carry evidence labels. The minute estimates for M1 are my **[I]** estimates of console click-through time. They should be **verified by attempt** during the build (see §6.3).

### 3.1 GitHub — "instant, but pick the right app type"
- **Console:** https://github.com/settings/developers. For orgs: Org settings → Developer settings.
- **Steps:**
  1. Decide between a GitHub App (recommended: fine-grained permissions, per-repo install, short-lived tokens) and an OAuth App [S] https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps.
  2. Register with name, homepage URL, and callback URL(s) (≤10).
  3. Optionally enable device flow.
  4. Generate the client secret [S] https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app.
- **Required fields:** name, homepage URL, callback URL. No privacy policy, logo, or domain verification required.
- **Scopes:** OAuth apps use coarse scopes (`repo` = full access to private repos). GitHub Apps use fine-grained permissions. Org data may be blocked by **OAuth app access restrictions, which are on by default for new orgs**, so an org owner must approve [S] https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions.
- **Tokens:** "Expire user access tokens" is enabled by default. Access tokens last 8 h, refresh tokens 6 months [S].
  - **Correction to common knowledge [S]:** many older tutorials say OAuth apps get non-expiring tokens and a single callback URL. Current docs say up to 10 callbacks and expiring tokens on by default.
- **Review:** none for direct use. GitHub Marketplace listing is optional.
- **Cost:** free.
- **What an agent can do:** fill the form via browser once the user is logged in, and validate the callback. **Human-only:** GitHub login and 2FA, org-owner approval for org access.
- **Uncertain:** [?] whether the API rate limit for OAuth user tokens (5,000/h per user) has changed. Not re-checked.

### 3.2 Notion — "instant, but users grant per page"
- **Console:** Notion Developer portal → Build → Public connections [S] (direct URL likely https://www.notion.so/profile/integrations [?]) https://developers.notion.com/guides/get-started/public-connections.
- **Steps:** Create new connection → name, development workspace, redirect URI(s), installation scope (Any workspace or Selected workspaces), capabilities (read, update, insert content…) → copy the client ID and secret from Configuration [S].
- **Required fields:** the above. For a Marketplace/public listing, also company name, website, privacy policy, terms, and support email [S2].
- **Nuances:**
  - During consent, users **pick specific pages** in a page picker. The agent sees only those pages.
  - Each workspace member authorizes separately [S].
  - The token response includes a `refresh_token` [S] https://developers.notion.com/docs/authorization.
  - The authorize URL needs `owner=user` [S].
- **Review:** none found for creating or using a public connection [S, absence noted]. Marketplace listing is separate [?].
- **Cost:** free.
- **What an agent can do:** the whole form, given a logged-in browser. **Human-only:** Notion login, and choosing the dev workspace.
- **Probe:** `api.notion.com/v1/oauth/authorize` with a fake client redirects to `app.notion.com/install-integration…` [P]. The endpoint is live.

### 3.3 Slack — "five minutes to build; the gates are at distribution"
- **Console:** https://api.slack.com/apps. Docs: https://docs.slack.dev
- **Steps:**
  1. Create the app (from scratch or from a manifest).
  2. Add bot and user scopes.
  3. Add redirect URLs (HTTPS).
  4. Install to your own workspace.
  5. To let other workspaces install, enable distribution ("unlisted distributed app"), which needs an OAuth flow [S] https://docs.slack.dev/distribution/
- **Gates:**
  - **Rate-limit throttle for unlisted commercial apps** created after 2025-05-29, and for new installs of existing ones: `conversations.history` and `conversations.replies` drop to 1 request/min with max 15 objects. Marketplace apps and internal customer-built apps are unaffected [S] https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps.
    - **Huge for AI agents that read channel history.** In practice it forces the Marketplace path.
  - **Marketplace review:** preliminary feedback within 10 business days, then the functional review takes **up to 10 weeks** for new apps (6 for resubmissions). Slack "can't accelerate." [S] https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide
  - **≥10 installs on active workspaces**, maintained throughout the review (since July 2026) [S] https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement.
    - Chicken-and-egg problem: you need 10 pilot customers while throttled.
- **Other nuance:** PKCE is now GA (changelog headline seen [S]). Optional scopes exist.
- **Cost:** free.
- **What an agent can do:** generate the app manifest (YAML or JSON) so the user pastes it at "Create from manifest," and draft the Marketplace listing copy. **Human-only:** workspace admin install, recruiting 10 workspaces, responding to reviewer feedback.
- **Uncertain:** [S2] reports say the throttle was later extended to existing installs from 2026-03-03. Not confirmed on an official page.

### 3.4 Gmail / Google Workspace — "the hardest consumer-data gate"
- **Console:** https://console.cloud.google.com → Google Auth Platform (Branding, Audience, Data Access, Clients, Verification Center).
- **Steps:**
  1. Create a project (Google recommends separate test and production projects [S] https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).
  2. Configure branding: app name, support email, logo, homepage, privacy policy, authorized domains.
  3. Set Audience: External, Testing.
  4. Create an OAuth client (Web) with redirect URIs.
  5. Enable the Gmail API.
  6. Declare scopes in Data Access.
- **Scope tiers** [S] https://developers.google.com/workspace/gmail/api/auth/scopes:
  - Sensitive: `gmail.send` (verification only, **no CASA**).
  - **Restricted:** `mail.google.com/`, `gmail.readonly`, `gmail.compose`, `gmail.insert`, `gmail.modify`, `gmail.metadata`, `gmail.settings.*` (verification **plus CASA**).
  - **Product decision insight:** the guide should push "narrowest scope." An agent that only *sends* mail avoids CASA entirely.
- **M1 (Testing mode)** [S] https://support.google.com/cloud/answer/15549945:
  - ≤100 test users, and they see a warning screen.
  - **Authorizations and refresh tokens expire after 7 days.**
  - Exemption: openid/email/profile only.
- **Brand verification** [S] https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification:
  - Requirements:
    - a homepage on a verified domain (Search Console, by a project Owner or Editor), not just a login page
    - a privacy policy on the same domain, linked from the homepage and matching the consent screen
    - compliance with branding guidelines
  - Timing: the automated check "usually completes in a few minutes." Otherwise "typically takes 2–3 business days."
  - Results stay valid for 7 days before you must publish.
- **Scope verification** (sensitive/restricted) [S] https://support.google.com/cloud/answer/13464321:
  - An unlisted YouTube demo video showing the full OAuth flow in English, the client ID in the address bar, and each scope's use.
  - Written justification for why narrower scopes won't work.
  - A permitted app type, and Limited Use compliance.
  - Task-automation platforms must show workflows and data flow direction [S].
- **CASA (restricted scopes only)** [S] https://support.google.com/cloud/answer/13465431:
  - Annual; run by App Defense Alliance-authorized assessors.
  - Google assigns AL1 (formerly "Tier 2") or AL2 (formerly "Tier 3"). It is the final step, and Google T&S tells you when to start.
  - Google says restricted verification "can potentially take several weeks" [S]. Its unverified-apps page says "several months" depending on sensitivity [S] https://support.google.com/cloud/answer/7454865.
  - **Cost [S2, vendor price lists]:** AL1 about $499–$3,000 (Secusy $499/$599/$3,000; TAC $540–$1,800; Eydle $1,000–$3,000). AL2 about $3,000–$9,000 (Secusy $5,400). Prices are per app/client ID, per year.
- **Unverified in production:** a hard **100-user lifetime cap** that can't be reset, plus "unverified app" danger UI [S].
- **Exceptions [S]:** personal use; dev/test; Internal (Workspace org-owned project); domain-wide install (skips brand verification but still needs scope verification for sensitive/restricted).
  - **Practical path for B2B:** customers' Workspace admins can mark the app "Trusted," which overrides the test-user cap and the 7-day expiry for that org [S] https://developers.google.com/identity/protocols/oauth2/production-readiness/overview.
- **Tokens:** see the §2 table (6 months unused; 100 per account per client).
- **What an agent can do:**
  - classify the requested scopes
  - draft scope justifications and the demo-video shot list
  - audit the homepage and privacy policy for the required disclosures
  - prepare the CASA self-assessment questionnaire answers and run OWASP ZAP scans (AL1 accepts scanner evidence [S2])
- **Human-only:** Google login, Search Console DNS verification, recording the video, contracting and paying the assessor, replying to T&S emails.
- **Probe [P]:** a fake client ID at the authorize endpoint returns `authError` = base64 of "invalid_client: The OAuth client was not found." The discovery doc shows PKCE `S256` and `plain`.

### 3.5 Microsoft Graph (Outlook/Teams/OneDrive) — "easy to register; the gate is the customer's tenant"
- **Console:** https://entra.microsoft.com → App registrations (or the Azure portal).
- **Steps:**
  1. New registration.
  2. Choose supported account types (single tenant / multitenant / + personal accounts).
  3. Add a redirect URI (Web).
  4. Create a client secret or certificate.
  5. Add Graph delegated permissions.
  6. Set the publisher domain (requires a DNS-verified custom domain to be publisher-verified).
- **Gates:**
  - **Publisher verification** [S] https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview:
    - Needs a verified Microsoft AI Cloud Partner Program (Partner One) **PGA** account.
    - The app must be registered with a work/school account, not a personal MSA.
    - The publisher domain must not be `*.onmicrosoft.com` and must match the email domain used for Partner Center verification.
    - Needs MFA, plus App Admin and Partner Admin roles.
    - "Can be verified in minutes" once prerequisites exist. Free.
    - Without it, since Nov 2020 under risk-based step-up consent, users can't consent to newer multitenant apps that request more than basic profile.
  - **Admin consent:** admins can restrict user consent to verified publishers and low-impact permissions (`microsoft-user-default-low`). An admin consent workflow exists [S] https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent.
    - [S2] Since mid-July 2025, the Microsoft-managed policy blocks user consent to third-party apps requesting `Files.Read(Write).All` and `Sites.Read(Write).All`. **Very relevant for agents reading SharePoint/OneDrive.**
  - Optional extras: Microsoft 365 Publisher Attestation and App Certification [S].
- **Tokens:** refresh tokens last 90 days, or 24 h for SPA redirects [S].
- **Time:**
  - M1: minutes [I].
  - Partner Center verification of the org when you have no Partner account: **[?]** typically days, not verified.
  - Then each enterprise customer's admin consent cycle: days to weeks, depending on their security review [I].
- **Cost:** free [S].
- **What an agent can do:** generate the app manifest or permission list, produce the admin-consent URL (`/adminconsent`), and draft a security questionnaire answer pack for customers. **Human-only:** Partner Center legal-entity verification, DNS verification, tenant admin actions.
- **Probe [P]:** the `common` v2.0 discovery doc returns the authorize and token endpoints.

### 3.6 Instagram (Meta) — "business verification + per-permission App Review"
- **Console:** https://developers.facebook.com/apps → create an app → pick a use case (Instagram API with Instagram Login, or with Facebook Login).
- **Basics:**
  - The Instagram Basic Display API ended 2024-12-04.
  - The current API supports **Business or Creator (professional) accounts only**; personal accounts can't connect [S2].
- **Access model** [S] https://developers.facebook.com/docs/graph-api/overview/access-levels:
  - Standard Access means only users with a role on the app (admins, developers, testers).
  - Advanced Access means any user. It requires **Business Verification** plus **App Review** per permission.
  - Apps with Advanced Access must complete the annual **Data Use Checkup**.
- **Business Verification** [S] https://developers.facebook.com/docs/development/release/business-verification:
  - Connect the app to a Business portfolio, then verify in Business Manager with legal-entity documents.
  - Only a Business admin can complete it.
  - Timing: [S2] "up to 14 business days" per the Meta Business Help Center (via secondary sources).
- **App Review** [S] https://developers.facebook.com/docs/app-review:
  - Meta tests your app; if reviewers can't access it, the whole submission is rejected.
  - Each permission must be demonstrable (screencast plus test credentials).
  - **Timing:**
    - [S2] older guidance said about 2–5 business days.
    - [A] a June 2026 Reddit report says the dashboard now reads "Most submissions are reviewed within 20 days," with commenters reporting 9–29 days.
    - **Must be shown as anecdotal. Ideally, verify by looking at the dashboard text during an attempt.**
- **Other required items [I/S2]:** privacy policy URL, app icon, data deletion callback or instructions URL, category, and app mode Live.
- **Cost:** free.
- **What an agent can do:** draft per-permission use-case descriptions, the screencast script, and reviewer test instructions, and check that the privacy policy and data-deletion URL are reachable. **Human-only:** Facebook account and 2FA, business documents, recording the screencast, keeping test credentials working during review.
- **Uncertain:** [?] the exact current renamed tier labels for non-Ads permissions. [S2] reports Meta renamed Ads Management Standard/Advanced to Limited/Full Access in May 2026.

### 3.7 Xero — "BYO on Composio; the gates are commercial and policy"
- **Console:** https://developer.xero.com/app/manage → New app: name, company URL, redirect URI, Web app (auth code) or PKCE.
- **Plans** [S] https://developer.xero.com/pricing (effective 2026-03-02):

| Plan | Max connections | Monthly fee (AUD) | Rate limit | Prereqs |
|---|---|---|---|---|
| Starter | 5 | Free | 1,000/day/org | — |
| Core | 50 | A$35 | 5,000 | Card |
| Plus | 1,000 | A$245 | 5,000 | **App Certification** |
| Advanced | 10,000 | A$1,445 | 5,000 | Certification + **initial and annual security assessment** |
| Enterprise | Unlimited | POA | 5,000 | Same as Advanced, plus App Store listing required |

  - Egress allowances apply (10, 50, or 250 GB) with A$2.40/GB overage.
  - Journals, the XPM API, and bulk connections require a security assessment plus use-case approval.
- **Policy [S]:**
  - **"Data obtained from Xero's APIs may not be used to train AI/ML models."**
  - Apps "must not use bots or browser extensions to … simulate user actions."
  - **This directly constrains AI agents. It's a great example of nuance a generic guide misses.**
- **Probe [P]:** the discovery doc shows PKCE S256 and grants `authorization_code`, `client_credentials`, `refresh_token`.
- **Timing:** M1 takes minutes with the Demo Company [I]. Certification timeline **[?] not found**.
- **What an agent can do:** compute the expected connection count, recommend a plan, and draft the certification checklist. **Human-only:** payment method, the certification process, the security assessment.

### Stretch fact sheets (short)

- **LinkedIn**
  - Creating an app requires associating a **LinkedIn Page**, which the Page super admin must verify via a link within 30 days. The association is permanent [S2] https://www.linkedin.com/help/linkedin/answer/a1665329.
  - Open scopes: `openid profile email w_member_social`. Everything else (Ads, SNAP, Talent) needs partner approval; Compliance is closed [S].
  - Tokens: 60-day access tokens; refresh tokens only for approved Marketing partners [S].
  - Redirect: HTTPS, absolute, no fragment [S].
  - Partner approval timeline: **[?] discretionary, not published.**
- **Zoom**
  - Private apps only work within your account.
  - Beta sharing outside your account needs a "Request to Share." Zoom responds within **3–4 business days**, and you must supply the technical design plus **security evidence** (SSDLC, SAST/DAST, ideally a third-party pentest).
  - Approved URLs last 4 weeks, plus two 4-week extensions. Caps: 10 account-level or 100 user-level additions [S] https://developers.zoom.us/docs/distribute/sharing-private-and-beta-apps/.
  - Public or unlisted apps need the full Marketplace review (completeness, branding, compliance, security testing) [S] https://developers.zoom.us/docs/distribute/app-review-process/. No published SLA [?].
- **QuickBooks**
  - Development keys work with sandbox companies.
  - Production keys require app details (host domain, launch and disconnect URLs, EULA, privacy policy) plus the **App Assessment Questionnaire** [S2].
  - Turnaround has no published SLA. Reports range from same-day to about 5–10 business days [A].
  - Refresh token: 100-day rolling plus a 5-year hard cap (`x_refresh_token_hard_expires_in`) [S2].
- **X**
  - Pay-per-use credits: $0.005 per post read, $0.015 per post created, $0.20 per post with a URL.
  - Capped at 3M post reads per month before Enterprise. No free tier except Public Utility apps [S] https://docs.x.com/x-api/getting-started/pricing (via curl; WebFetch was 403).
  - OAuth 2.0 with PKCE. Use `offline.access` to get a refresh token.
- **HubSpot**
  - Install caps: private OAuth apps 10 allowlisted accounts; Marketplace apps 25 before listing, unlimited after [S].
  - Listing requires OAuth-only auth, ≥3 active unaffiliated installs, and a review (initial ≤10 business days, ≤60 days total) [S] https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements.
- **Salesforce**
  - New integrations use **External Client Apps**; new Connected Apps are blocked from Spring '26 [S2].
  - Uninstalled connected apps can't be self-authorized by new users since Sept 2025, so the customer admin must install the app or package first [S2].
  - AppExchange security review: free for free apps, $999 per attempt for paid apps, about 4–6+ weeks [S2].
  - Probe [P]: PKCE S256.
- **Atlassian**
  - Enable sharing to distribute. Users see an "unreviewed app" warning until review.
  - Apps storing personal data must call the **personal data reporting API** periodically [S2] https://developer.atlassian.com/cloud/jira/platform/user-privacy-developer-guide/.
  - Rotating refresh tokens via `offline_access` [S].
  - Call `accessible-resources` to get the `cloudid` [S].

---

## 4. Guide schema and evidence model

### 4.1 Design principles
- **Every factual field is a `Claim`,** with an evidence level, sources, and a last-checked date. The UI renders badges from this, and the agent's validator rejects uncited "sourced" claims.
- **Time is modeled per milestone,** as a range with an explicit basis (official SLA / anecdotal / estimate). Never a single number.
- **Gates are typed** (taxonomy P1–P13) so the library can be filtered ("show me apps with no review") and difficulty can be computed instead of hand-waved.
- **Steps carry an `actor`** (`agent` | `human` | `either`) and a `why_human` reason (login/2FA, legal entity, payment, DNS, recording, or a judgment call).

### 4.2 JSON schema (draft, TypeScript-ish)

```ts
type EvidenceLevel = "verified_by_attempt" | "probed" | "sourced_official" | "sourced_secondary" | "anecdotal" | "inferred" | "unknown";

interface Source { url: string; title?: string; publisher: "official" | "secondary" | "community"; fetched_at: string /* ISO */; quote?: string /* ≤300 chars supporting excerpt */; }

interface Claim<T = string> {
  value: T;
  evidence: EvidenceLevel;
  sources: Source[];            // required unless evidence ∈ {inferred, unknown}
  last_checked: string;         // ISO date
  note?: string;                // e.g. "Dashboard text, not a commitment"
}

interface Guide {
  slug: string;                         // "gmail"
  app: { name: string; website: string; logo_url?: string; category: string };
  provider_family?: string;             // "google" (shared console for Gmail/Drive/...)
  generated_by: "curated" | "agent";
  generated_at: string; schema_version: "1.0";
  composio: { toolkit_slug?: string; managed_oauth: Claim<boolean | "unknown">; when_to_byo: string[] };

  summary: {
    one_liner: Claim;                   // "Easy to start, weeks to months for restricted Gmail scopes"
    difficulty: { score: 1|2|3|4|5; label: "Instant"|"Easy"|"Moderate"|"Hard"|"Very hard"; rationale: string; computed_from_gates: string[] };
    headline_blockers: Claim[];
  };

  milestones: Array<{
    id: "dev_ready" | "pilot_ready" | "production_ready";
    definition: string;                 // "Any Google user, no warning screen"
    hands_on_effort: Claim<{ min_hours: number; max_hours: number }>;
    calendar_wait: Claim<{ min_days: number; max_days: number | null; basis: "official_sla"|"official_estimate"|"anecdotal"|"estimate"|"unknown" }>;
    limits_until_next: Claim[];         // "100 test users; tokens expire in 7 days"
  }>;

  gates: Array<{
    type: "self_serve"|"testing_mode"|"scope_review"|"security_assessment"|"business_verification"|"app_review"|"partner_program"|"paid_access"|"listing_throttle"|"marketplace_review"|"tenant_admin_consent"|"publisher_verification"|"sandbox_to_production"|"deprecation"|"data_use_policy"|"no_self_serve";
    name: string; applies_when: string; // "Only if you request restricted Gmail scopes"
    required_for: ("pilot_ready"|"production_ready")[];
    cost: Claim<{ amount_min?: number; amount_max?: number; currency?: string; recurring?: "one_time"|"monthly"|"annual"; notes?: string }>;
    duration: Claim<{ min_days?: number; max_days?: number; basis: string }>;
    recurring?: Claim;                  // "Annual CASA re-assessment"
  }>;

  prerequisites: Claim[];               // "Verified domain in Search Console", "Business portfolio", "LinkedIn Page"
  console: { url: Claim; app_type_to_create: Claim; alternatives?: Claim[] }; // "GitHub App (recommended) vs OAuth App"

  setup_steps: Array<{
    n: number; title: string; detail_md: string;
    actor: "agent"|"human"|"either"; why_human?: "login_2fa"|"legal_entity"|"payment"|"dns_or_domain"|"record_video"|"org_admin"|"judgement"|"provider_side";
    agent_assist?: string;              // "Agent drafts manifest; you paste it"
    fields?: Array<{ name: string; value_hint: string; required: boolean }>; // redirect URI, privacy policy URL...
    evidence: Claim;
  }>;

  configuration: {
    redirect_uri_rules: Claim[];        // exact match, https, max count, Composio callback / proxy
    scopes: Array<{ scope: string; purpose: string; tier?: "basic"|"sensitive"|"restricted"|"partner_only"|"closed"; triggers_gate?: string; evidence: Claim }>;
    tokens: { access_ttl?: Claim; refresh_behavior: Claim; gotchas: Claim[] };
    rate_limits: Claim[];
    required_urls: Claim[];             // homepage, privacy policy, ToS, data deletion, EULA, disconnect URL
  };

  blockers_and_fixes: Array<{ symptom: string; cause: Claim; fix: string; escalation?: string /* contact/forum/form URL */ }>;
  agent_vs_human: { agent_can: string[]; human_must: string[] };
  evidence_report: {
    tested: Array<{ what: string; result: string; date: string; artifact?: string }>;   // probes + attempts
    corrections: Array<{ was: string; now: string; source: Source }>;                    // "GitHub OAuth apps: 1 callback → up to 10"
    open_questions: string[];
  };
  share: { url: string; markdown_export: boolean };
}
```

### 4.3 Evidence model rules (enforce them in code)
1. **`sourced_official`** needs ≥1 source on the provider's own domain or docs host, actually fetched in this run, with a supporting quote. The validator string-matches the quote against fetched text; if it doesn't match, the claim is downgraded.
2. **`anecdotal`** timelines must render with an "Reported by developers, not a commitment" badge.
3. **`probed`** means a no-credential HTTP check: an OIDC/OAuth discovery doc, an authorize-URL error with a fake client, or a console URL resolving. It's cheap and automatable, and it verifies endpoints and PKCE support, not policy.
4. **`verified_by_attempt`** means a human or agent actually created the app or ran the flow. Store the date, account type, and a screenshot reference. Reserve this for curated guides.
5. **Freshness:** show `last_checked` per section. Mark stale after 90 days [I: policies changed repeatedly in 2025–26 (Slack, X, Xero, Salesforce, Intuit, Meta), so staleness is a real risk].
6. **Difficulty is derived from gates,** not chosen by the LLM. For example:
   - `max(gate_weight)`, plus adjustments for cost and wait
   - security_assessment / partner_program / no_self_serve → 5
   - business_verification + app_review → 4
   - marketplace_review required for scale → 3
   - testing_mode only → 2
   - self_serve → 1

   This makes scores consistent across curated and generated guides.

---

## 5. Product recommendations

### 5.1 Focused scope (6–8 h)
**Core decision:** the guide answers *"How far am I from my first external user, and from unrestricted production, if I bring my own OAuth app?"* Composio managed auth covers the dev path. The pain starts at BYO, so lead every guide with **"Can I just use Composio's managed app?"** (live from the managed-auth list), then the three milestones.

Build:
1. **Library page.** 7 curated guides as JSON files in the repo, with filters by difficulty, gate type, and managed/BYO, plus "time to production" chips.
2. **Guide page.** Sections:
   - verdict card: difficulty, M1/M2/M3 time and effort, cost, Composio managed status
   - gate timeline
   - step checklist with agent/human badges
   - config cheatsheet: redirect, scopes, tokens, limits
   - blockers → fixes
   - evidence panel: tested, sources, corrections, unknowns

   Shareable via a static URL, plus a "Copy as Markdown" export so it can be pasted into Slack, Notion, or a PRD.
3. **Live generation.** Input an app name or URL. A streaming progress log shows each search, fetch, and probe, and each claim as it's extracted. The output is a guide in the same schema at `/guides/[slug]`, labelled "Agent-generated · evidence levels shown."
4. **Evidence pass on 2–3 apps:** real attempts by Aryan (see §6.3) recorded in `evidence_report.tested`, plus a "corrections" list.

Explicitly out of scope: an auth or user system, editing guides, all 100 apps, a scheduler for re-checks (mention as future work), and actually completing provider approvals.

### 5.2 Live agent architecture
- **Stack:** Next.js (App Router) on Vercel, TypeScript, a Route Handler streaming SSE (or the Vercel AI SDK `streamText` with tools), Tailwind/shadcn UI. Persist generated guides in Upstash Redis / Vercel KV, Neon Postgres, or Vercel Blob as JSON.
  - **[?]** Check the current Vercel function max duration for your plan. A run may take 60–180 s.
- **Agent loop (tools):**
  1. `resolve_app(name|url)`: canonical name, website, and likely developer-docs domain.
  2. `composio_status(slug)`: parse the public `docs.composio.dev/toolkits/managed-auth.md` (no key needed), or call the toolkit API with a Composio key.
  3. `web_search(q)`: targeted queries such as "{app} OAuth app create", "{app} app review", "{app} marketplace listing requirements", "{app} partner program API access", "{app} refresh token expiry", "{app} rate limits", "{app} pricing API".
  4. `fetch(url)`: fetch to markdown. **Fall back to curl with a browser User-Agent,** because Meta and X docs returned 403 to a fetch service but worked via curl (observed today).
  5. `probe_oauth(domain)`: try `/.well-known/openid-configuration` and `/.well-known/oauth-authorization-server`, and send a fake-client authorize request. Record the endpoints, PKCE support, and the error shape.
  6. `extract(schema)`: the LLM fills the schema with per-claim `sources[].quote`.
  7. `validate()`: verify quotes against fetched text, downgrade unmatched claims, compute difficulty from gates, and list unknowns.
  8. `save()` and return the URL.
  - Budget: about 8–15 fetches and 1–3 LLM extraction calls. Use a cheaper model for page triage and a strong model for extraction.
- **Prompting rules:** prefer the provider's official domains; never state a timeline without a source; if only forum evidence exists, mark it `anecdotal`; if no self-serve path is found, say so.
- **Keys needed** (none should be in the repo; use `.env.local` and Vercel env vars):
  - **LLM:** one of Anthropic, OpenAI, or xAI (Grok). Some LLM APIs have built-in web search/fetch tools, which could replace a separate search key. **[?]** Verify current availability and pricing for whichever you pick.
  - **Search** (if not LLM-native): Tavily, Exa, Brave Search API, or Serper. Each has a free tier [?].
  - **Fetch/clean** (optional): Firecrawl or Jina Reader. A plain server fetch plus readability is fine for most docs. Some docs are JS-rendered (Xero pricing came back empty via raw HTML but fine via a rendering fetcher), so a renderer helps.
  - **Storage:** Upstash/Vercel KV token, or a Neon `DATABASE_URL`.
  - **Optional:** a Composio API key for `GET /api/v3.1/toolkits/{slug}`.

### 5.3 Product decisions to highlight in the README
- **Milestones over a single estimate.** "10 minutes to dev, 6–12 weeks to production" is the honest answer for Slack and Google.
- **Gates as data,** which gives consistent difficulty, filterable libraries, and comparable guides.
- **Evidence is visible** (badges per claim, corrections, unknowns), so a shared guide can be trusted without the author present.
- **Agent/human split per step,** with concrete agent artifacts: Slack manifest, Google scope justification, demo-video shot list, Meta reviewer instructions, Microsoft admin-consent URL, CASA SAQ prep.
- **AI-agent-specific nuance** gets a dedicated callout: Xero's AI-training ban and anti-bot clause, Slack's history throttle, Google's Limited Use and AI-training consent rule, and Microsoft's Files/Sites consent block.

---

## 6. What I tested, what's sourced, and what's uncertain

### 6.1 Probes I ran (2026-10-20, from the box, no credentials)
| Provider | Discovery doc | Notable |
|---|---|---|
| Google | 200 `accounts.google.com/.well-known/openid-configuration` | PKCE plain+S256; grants include device_code, jwt-bearer. A fake client at authorize → 302 to an error page with authError = "invalid_client: The OAuth client was not found." |
| Microsoft | 200 `login.microsoftonline.com/common/v2.0/...` | Endpoints confirmed |
| Slack | 200 `slack.com/.well-known/openid-configuration` | OIDC (Sign in with Slack) endpoints; the main OAuth v2 is `slack.com/oauth/v2/authorize` |
| LinkedIn | 200 | A fake client renders `invalid "fake"` |
| Atlassian | 200 | PKCE S256 |
| Zoom | 200 | PKCE plain+S256, device_code |
| Intuit | 200 (note: `openid_configuration`, underscore) | — |
| Xero | 200 | PKCE S256; client_credentials grant |
| Salesforce | 200 | PKCE S256 |
| Notion | 400 for the RFC 8414 path | The authorize endpoint redirects to `app.notion.com/install-integration` |
| GitHub | 404 (no OIDC discovery for user OAuth) | The authorize endpoint redirects unauthenticated users to login |

**Lesson for the agent:** discovery paths vary (Intuit uses an underscore; Notion and GitHub have none). The probe tool should try several and treat a miss as "unknown," not "unsupported."

### 6.2 Corrections and surprises found during research
- **GitHub OAuth apps:** now up to **10 callback URLs** and **expiring tokens on by default** [S]. Older knowledge said 1 URL and non-expiring tokens.
- **Slack:** the barrier is no longer "can I distribute?" It's the **1 req/min throttle** without Marketplace approval, and the Marketplace now needs **≥10 active installs** and up to 10 weeks [S].
- **X:** subscription tiers (Free/Basic/Pro at $200/mo, etc.) are gone for new developers. It's **pay-per-use** now [S].
- **Xero:** the revenue-share model was replaced by **connection-based plans** (2026-03-02), plus an **AI/ML training ban** [S].
- **Salesforce:** Connected Apps are being replaced by **External Client Apps**, and the uninstalled-app restriction applies [S2].
- **Intuit:** refresh tokens now have a **5-year hard cap** [S2].
- **Google CASA:** tiers have been renamed **AL1/AL2** (formerly Tier 2/3) [S].
- **Meta App Review time:** the dashboard estimate reportedly went from about 10 to **about 20 days** in 2026 [A]. Needs confirmation.

### 6.3 Recommended "verified-by-attempt" tests for Aryan (about 60–90 min total, free accounts)
1. **GitHub:** create an OAuth app and confirm the field list, the 10-callback limit, and the token-expiry default (5 min).
2. **Notion:** create a public connection and note the required fields (5 min).
3. **Slack:** create the app from a manifest, enable distribution, and screenshot the Marketplace submission page's "estimated review time" (10 min).
4. **Google:** create a project, set the consent screen to Testing, add `gmail.readonly`, and screenshot the "restricted" classification plus the verification-center requirements. Run one consent as a test user and confirm the warning screen (20–30 min).
5. **Meta:** create an app and screenshot the App Review page's quoted review time, plus the Business Verification requirement (15 min). **This resolves the biggest anecdotal claim.**
6. Optionally **Microsoft:** register a multitenant app and screenshot the "unverified" publisher state and the publisher-verification prerequisites.

Record each in `evidence_report.tested` with date and screenshot. Keep client secrets out of screenshots and the repo.

### 6.4 Open questions / not verified
- Composio's exact BYO callback URL (dashboard-only).
- Meta's official App Review SLA text, and Business Verification's 14-business-day figure (seen only via secondary sources).
- Partner Center (Microsoft) org verification duration.
- LinkedIn partner program approval timelines (not published).
- Zoom Marketplace review duration; Xero certification duration.
- Whether Slack's throttle now also applies to *existing* installs (reported for 2026-03-03).
- Salesforce help articles (JS-rendered, not fetched directly). AppExchange fee and duration are from secondary sources.
- Intuit pages returned 403 to my fetchers. Refresh-token and production-key details are from secondary sources and search synthesis.
- The candidates for "no self-serve OAuth" (Workday, NetSuite, ServiceNow, Gong, ZoomInfo) are unverified.

---

## 7. Source index (primary)
- Composio: https://docs.composio.dev/toolkits/managed-auth · https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app · https://docs.composio.dev/docs/authentication/white-labeling-authentication · https://docs.composio.dev/kb/guide/platform-google-oauth · https://docs.composio.dev/llms-index.txt
- Google: https://support.google.com/cloud/answer/13464321 · https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification · https://support.google.com/cloud/answer/7454865 · https://support.google.com/cloud/answer/15549945 · https://developers.google.com/identity/protocols/oauth2/production-readiness/overview · https://developers.google.com/identity/protocols/oauth2 · https://support.google.com/cloud/answer/13465431 · https://developers.google.com/workspace/gmail/api/auth/scopes
- Meta: https://developers.facebook.com/docs/app-review · https://developers.facebook.com/docs/development/release/business-verification · https://developers.facebook.com/docs/graph-api/overview/access-levels
- Microsoft: https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview · https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-user-consent · https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens
- LinkedIn: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access · https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow · https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens
- Slack: https://docs.slack.dev/distribution/ · https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps · https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide · https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement
- GitHub: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app · https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps · https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps · https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions
- Notion: https://developers.notion.com/guides/get-started/public-connections · https://developers.notion.com/docs/authorization
- X: https://docs.x.com/x-api/getting-started/pricing
- Xero: https://developer.xero.com/pricing
- HubSpot: https://developers.hubspot.com/docs/apps/developer-platform/build-apps/manage-apps-in-hubspot · https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements
- Zoom: https://developers.zoom.us/docs/distribute/sharing-private-and-beta-apps/ · https://developers.zoom.us/docs/distribute/app-review-process/
- Atlassian: https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/ · https://developer.atlassian.com/cloud/oauth/getting-started/refresh-tokens/
- Secondary (flagged): Secusy CASA pricing https://www.secusy.ai/blog/google-casa-assessment-cost · Eydle https://www.eydle.com/ada/ · Codat QBO questionnaire https://docs.codat.io/integrations/accounting/quickbooksonline/qbo-app-assessment-questionnaire · Intuit blog https://blogs.intuit.com/2025/11/12/important-changes-to-refresh-token-policy · Salesforce help 005228017 / 005132365 · Reddit Meta review time https://www.reddit.com/r/facebook/comments/1u1h6rl/ · Outstand X pricing https://www.outstand.so/blog/x-api-pricing
