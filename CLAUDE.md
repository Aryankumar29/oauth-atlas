# OAuth Atlas — instructions for coding agents

@AGENTS.md

> AGENTS.md holds the Next.js 16 breaking-change notes. **Before editing framework code** (routing, route handlers, server/client components, caching, config), read the relevant file in `node_modules/next/dist/docs/`. Do not rely on memory of Next 13–15 APIs.

## What this is
Decision-grade OAuth setup and approval guides for developers building AI agents: a library (100 tracked apps, curated guides in `data/guides/`), a guide page, a read-only guide API (`/api/guides`), and live generation (`/api/generate`: resolve → composio → discover → probe → attempt → extract → verify → render, streamed over SSE, persisted in Upstash).

Sources of truth: `docs/SPEC.md` (product and schema), `docs/DECISIONS.md` (decisions), `docs/ARCHITECTURE.md` (pipeline), `docs/research.md` (facts). **Never invent provider facts or timelines.**

## Commands
```bash
npm run dev               # local; MOCK_LLM=1 in .env.local runs offline with no keys
npm run check             # typecheck && lint && test && validate:guides && build  ← definition of done
npm run test:e2e          # Playwright smoke, MOCK_LLM=1 via webServer.env
```

## Conventions
- TypeScript strict. Zod is the contract: parse every external input, guide JSON and model output.
- The pipeline uses dependency injection: `runPipeline(input, deps)`, with `deps = { fetch, llm, store, now, emit }`. No hidden globals, so it can be tested offline.
- Difficulty is **only** computed by `lib/difficulty.ts`. Never accept a model-provided score.
- Evidence statuses: `tested | primary | secondary | inferred | conflicting | stale`. Only probe and attempt records (code, never the model) produce `tested`.
- Every outbound URL goes through `lib/agent/urlGuard.ts`.
- Guides load through static imports in `data/guides/index.ts`. **No runtime `fs`**: Vercel's filesystem is read-only.
- Server-only code (model keys, Redis) never ships in client components.
- Keep the UI plain Tailwind. Don't write POSIX-only npm scripts (Windows is a supported dev OS).

## Definition of done
1. `npm run check` passes, and `npm run test:e2e` for UI changes.
2. New logic has tests; pipeline tests run offline with fixtures.
3. No secrets: never read or print `.env` / `.env.local`, never commit keys, mask client IDs in evidence.
4. Small commits with clear messages.
