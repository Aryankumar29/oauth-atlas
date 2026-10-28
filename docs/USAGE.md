# Using OAuth Atlas for your own app

This guide is for a developer who wants to connect their users' accounts in a third-party app (Slack, Gmail, Linear, …) and needs to know what it will take. There are three ways to use OAuth Atlas, from quickest to most hands-on.

## 1. Look the app up (2 minutes)

1. Open **https://oauth-atlas.vercel.app/apps** and search for the app.
2. If it has a guide, open it. If it is queued, click **Generate now**.
3. Read the guide top to bottom. It is ordered the way you should decide:
   - **Do you need your own OAuth app?** If Composio already manages OAuth for this app, you can start without creating anything. The guide lists the triggers that force you onto your own app (your brand on the consent screen, custom scopes, your own quota).
   - **Verdict and difficulty (1–5).** Difficulty is computed from the gates the provider puts between "works for me" and "works for anyone", never guessed by a model. "Why this score" names the gate that sets it.
   - **Three milestones.** *Dev-ready* (works for your own account), *pilot-ready* (a few real users), *production-ready* (anyone can connect). Each has hands-on hours, the wait you can't speed up, and the limits until the next milestone.
   - **Gates, scopes, requirements, steps.** What to do, in order, and who does it: the agent, you, or both.
   - **Setup attempts** (live guides). What the agent tried itself without an account, and what that showed (for example: PKCE is required, or the app's MCP server lets an agent register its own client).
   - **Evidence and unknowns.** Every claim has a source and a status: `tested`, `primary`, `secondary` (community), or `inferred`. Unknowns are listed instead of guessed.
4. Share it: **Copy link**, or **Copy as Markdown** for a ticket or a design doc.

## 2. Generate a guide for any app (about 1–2 minutes)

Open **https://oauth-atlas.vercel.app/generate**, type the app's name or website, and click **Generate**. You can watch each step:

| Step | What happens |
|---|---|
| Resolve | Matches the name or URL to an app |
| Composio | Checks whether Composio manages OAuth for it |
| Discover | An agent searches for and fetches the official developer docs |
| Probe | Credential-free requests to the OAuth discovery, authorize, and console endpoints |
| Attempt | The agent tries setup steps itself: a code exchange with a fake client, a remote MCP server lookup, and a client registration request that cannot register anything |
| Extract | A model drafts the guide from the fetched docs |
| Verify | Code checks every quote against the fetched page and computes the difficulty |
| Render | Saves a shareable guide at `/generate/<runId>` |

A live guide is labeled **Live-generated — verify** until a person checks its sources. If the run hits its time limit, it saves a guide labeled **partial** rather than a blank page. Public use is limited to 5 live runs per hour per IP.

## Use it from your agent (API)

The same guides are available as a read-only JSON API, open to any origin, so an agent can check an app's OAuth path before it asks a user to connect it. `{app}` can be a slug (`gmail`), a name (`Notion`) or a URL (`slack.com`).

| Request | Returns |
|---|---|
| `GET /api/guides` | All 100 tracked apps: name, website, approval model, Composio-managed status, tier, and the guide's difficulty and summary where one exists |
| `GET /api/guides/{app}` | `{ source, url, difficulty, guide }`, where `source` is `curated` or `generated` and `guide` follows `lib/schema.ts` |
| `GET /api/guides/{app}?format=md` | The same guide as Markdown, ready to drop into a prompt |
| `POST /api/generate` with `{"query": "<name or URL>"}` | Server-Sent Events: `run`, then `step` per pipeline step, then `done` with `guideSlug`. Rate-limited to 5 runs per IP per hour on the public site |

A missing guide answers `404` with a `generateUrl`. Useful fields for an agent: `guide.app.composio.managed` and `guide.ownApp.triggers` (can you use managed auth?), `difficulty.score` and `difficulty.rationale`, `guide.milestones` (hours and waits), `guide.humanTasks` (what to hand to the user), and `guide.unknowns`.

## 3. Run the setup checks yourself

The repo includes the scripts used to verify the guides. They run from a clone (see [Self-hosting](#4-self-hosting) for setup) and need no API keys.

### Probe an app's OAuth endpoints

```bash
npx tsx scripts/probe.ts linear.app
```

Prints timestamped probe records: discovery documents, how the authorize endpoint answers an unknown client, and whether the developer console is reachable.

### Do a real setup through an app's MCP server

If an app runs a remote MCP server with Dynamic Client Registration (in our checks: Linear, Notion, Asana, Atlassian), an agent can connect with **no developer console and no OAuth app**:

```bash
npx tsx scripts/verify-mcp-setup.ts https://mcp.linear.app --out record.json --scope read
```

The script registers a client, prints a consent link, and waits on `http://localhost:8976/callback`. Open the link **in a browser on the same computer**, sign in, and approve. The script then exchanges the code with PKCE, lists the server's MCP tools, revokes the token, and checks it no longer works. `record.json` holds statuses and observations only; tokens are never written. Flags: `--port`, `--wait-minutes`, and `--client-id` to reuse a client the script registered before.

### Do a real GitHub sign-in with no client secret

1. Create an OAuth app at https://github.com/settings/applications/new and tick **Enable Device Flow** (the callback URL is required by the form but unused).
2. Run:
   ```bash
   npx tsx scripts/verify-github-device-flow.ts --client-id <your client ID> --out record.json
   ```
3. Enter the printed code at https://github.com/login/device and authorize.
4. The script makes one read-only API call, then waits while you delete the OAuth app, and confirms GitHub rejects the token afterwards.

## 4. Self-hosting

**Requirements:** Node.js 20+ and npm.

```bash
git clone https://github.com/Aryankumar29/oauth-atlas.git
cd oauth-atlas
npm ci
cp .env.example .env.local
```

**Offline (no keys):** set `MOCK_LLM=1` in `.env.local`, then `npm run dev` and open http://localhost:3000. A mock model and recorded HTTP fixtures stand in for the network, and a **MOCK MODE** banner says so.

**Real generation:** pick one model provider and set its key in `.env.local`. Never commit this file.

| Provider | Settings |
|---|---|
| Anthropic (code default) | `ANTHROPIC_API_KEY` |
| OpenAI | `LLM_PROVIDER=openai`, `OPENAI_API_KEY` |
| Azure OpenAI (used in production) | `LLM_PROVIDER=openai`, `OPENAI_API_KEY` = the Azure key, `OPENAI_BASE_URL=https://<resource>.openai.azure.com/openai/v1`, `LLM_MODEL=<deployment name>` |
| Google Gemini | `LLM_PROVIDER=gemini`, `GEMINI_API_KEY` |

Optional: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to persist runs (otherwise they live in memory), `COMPOSIO_API_KEY`, `JINA_API_KEY`.

**Check and deploy:**

```bash
npm run check      # typecheck, lint, unit tests, guide validation, production build
npm run test:e2e   # browser smoke tests in mock mode
```

Deploying to Vercel, including environment variables and the 300 s function limit, is covered in [`deploy.md`](deploy.md).

## What OAuth Atlas does not do

- It does not create accounts, accept terms, or submit app reviews for you. Those gates stay with you, and each guide says which ones apply.
- It does not store tokens. The verification scripts revoke what they create.
- It is not legal or compliance advice. Review times come from providers where published; community figures are labeled as such.
