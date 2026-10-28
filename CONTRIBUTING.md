# Contributing

Thanks for helping. The most useful contributions are new or corrected **guides** and fixes to provider facts.

## Set up

```bash
npm ci
cp .env.example .env.local    # set MOCK_LLM=1 to work offline, with no keys
npm run dev
```

## Before you open a pull request

```bash
npm run check      # typecheck, lint, unit tests, guide validation, production build
npm run test:e2e   # browser smoke tests (first time: npx playwright install chromium)
```

CI runs both on every pull request.

## Ground rules

- **Never invent provider facts or timelines.** Every claim in a guide needs a source URL and, for `primary`, a quote copied exactly from that official page. Community figures are `secondary`. If you don't know, put it in `unknowns`.
- **Difficulty is computed, never written by hand.** It comes from the gates in the guide (`lib/difficulty.ts`); `npm run validate:guides` rejects a guide whose stated difficulty doesn't match.
- **Correcting a guide?** Add an entry to `docs/corrections.md` saying what changed, why, and the source.
- **New logic needs tests**, and pipeline tests must run offline (fixtures in `tests/fixtures/`).
- **No secrets** in code, fixtures, screenshots or evidence records. Mask client IDs in evidence (see `docs/evidence/README.md`).
- Keep the UI plain Tailwind.

## Adding a curated guide

1. Write `data/guides/<slug>.json` against the schema in `lib/schema.ts` (see the existing five for the shape).
2. Register it in `data/guides/index.ts`.
3. Run `npm run validate:guides` and `npm run check`.

Design background: `docs/SPEC.md` (product spec) and `docs/DECISIONS.md` (decision log).
