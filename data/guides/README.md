# Guides

One JSON file per app, named `<slug>.json` (for example, `github.json`). Validate every file with `guideSchema` from `lib/schema.ts`.

## Minimum bar for a published guide

- A verdict with difficulty and approval model
- A fastest-path recommendation (managed vs. own app)
- Hands-on time, time to first test user, time to public launch, and a basis
- At least 3 primary sources for factual claims
- At least one blocker or an explicit “no blockers”
- An owner for every step (`agent`, `human`, or `both`)
- Unknowns listed
- `lastVerified` date

## Quality tiers

- `tested` — we attempted setup and captured dated evidence.
- `verified` — 3+ primary sources and claim-level citations, but no setup attempt.
- `indexed` — official docs and metadata only; lower confidence.

## Skeleton

```json
{
  "slug": "example",
  "app": {
    "slug": "example",
    "name": "Example",
    "website": "https://example.com",
    "category": "Productivity",
    "archetype": "self-serve",
    "docsUrl": "https://example.com/docs",
    "consoleUrl": "https://example.com/console",
    "managedOAuth": "unknown",
    "tier": "verified"
  },
  "version": "0.1.0",
  "lastVerified": "2026-10-20",
  "confidence": "medium",
  "verdict": {
    "difficulty": 2,
    "approvalModel": "none",
    "summary": "One-line verdict.",
    "canTestBeforeApproval": true
  },
  "fastestPath": {
    "managedPath": "Use the managed app if scopes fit.",
    "ownAppPath": "Create your own OAuth app for full scope control.",
    "recommendation": "Start with the own-app path."
  },
  "time": {
    "handsOnHours": { "min": 1, "max": 2 },
    "timeToFirstTestUser": "Same day",
    "timeToPublicLaunch": "Same day",
    "confidence": "medium",
    "basis": "Official docs plus a dated test attempt."
  },
  "requirements": [],
  "scopes": [],
  "steps": [],
  "blockers": [],
  "agentTasks": [],
  "humanTasks": [],
  "unknowns": [],
  "evidence": [],
  "corrections": [],
  "generatedBy": "human"
}
```

## Rules

- Do not invent review times, approvals, or fees.
- Label inferred claims.
- Show conflicting sources instead of silently choosing one.
- Record corrections in `docs/corrections.md` and in the guide’s `corrections` array.
