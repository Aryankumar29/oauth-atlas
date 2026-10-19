# Verification Log

Record every setup attempt and source check here. Dates matter. Do not claim a test that did not happen.

## Status legend

- **Not started** — planned, no attempt yet
- **In progress** — account created or console opened
- **Completed** — step finished and evidence captured
- **Blocked** — stopped by a gate (identity, legal, payment, admin, login wall)

## Attempts

| App | Date | Account type | What we attempted | Status | Completed | Stopped at / blocker | Evidence | Docs vs. console | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| GitHub | TBD | Free personal/org test account | Create OAuth App, configure callback, run authorization code flow | Not started | — | — | `docs/evidence/` | TBD | — |
| Slack | TBD | Free workspace | Create app, install to test workspace, verify scopes/redirect | Not started | — | — | `docs/evidence/` | TBD | — |
| Google | TBD | Free Google Cloud project | Configure OAuth consent screen; inspect sensitive/restricted scopes; stop before verification submission | Not started | — | — | `docs/evidence/` | TBD | — |
| Notion | TBD | Free workspace | Create internal integration; document public integration review path | Not started | — | — | `docs/evidence/` | TBD | — |
| Salesforce | TBD | Free Developer Edition org | Create Connected App; document AppExchange review as a separate gate | Not started | — | — | `docs/evidence/` | TBD | — |

## Source checks

| Date | App | Claim | Source URL | Source type | Quote / note | Result |
|---|---|---|---|---|---|---|
| TBD | TBD | TBD | TBD | TBD | TBD | TBD |

## What we could not verify

- Actual review duration for a new public app with our scope mix.
- Approval likelihood for a specific use case.
- Fees for security assessments or marketplace listings.
- Behavior behind login-walled consoles.
- Regional or plan-specific differences.

## Rules

- Use test accounts only. Never use personal credentials.
- Redact account IDs, client IDs, secrets, and personal data from screenshots.
- Revoke or delete test apps after the attempt.
- Do not automate account creation, accept legal terms, or submit reviews on someone else's behalf.
- If a provider requires identity, legal, or payment verification, stop and record the exact gate.
