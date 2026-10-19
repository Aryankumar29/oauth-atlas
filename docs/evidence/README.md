# Evidence Store

Screenshots, source snapshots, and test artifacts live here. Never commit secrets.

## Naming

```
YYYY-MM-DD-<app>-<step>-<short-description>.<ext>
```

Examples:

```
2026-10-20-github-create-oauth-app.png
2026-10-20-github-consent-screen.png
2026-10-20-slack-scopes.png
2026-10-20-google-verification-page.md
```

## Source snapshots

For pages that may change, save a Markdown or text snapshot with:

- URL
- retrieved date
- short quote used in the guide
- whether the page required login

Do not copy entire pages when a short quote is enough.

## Redaction checklist

- [ ] Client IDs removed or masked
- [ ] Client secrets removed
- [ ] Account emails / IDs removed
- [ ] Workspace names masked if sensitive
- [ ] Browser tabs/bookmarks hidden
- [ ] No personal data

## Test artifacts

- Keep the exact redirect URIs and scopes used in the test.
- Record the date and environment (local/staging).
- Do not store access tokens or authorization codes.
- Delete or revoke test apps after capturing evidence.

## Rule

If it is not in this folder or linked from the verification log, do not call it “tested.”
