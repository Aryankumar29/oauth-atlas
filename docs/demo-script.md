# 5-Minute Demo Script

## 0:00–0:30 — The problem

“A developer building an agent can write the OAuth code. What they can’t easily learn is whether the provider will let them ship, how long approval will take, and what will block them. So they guess, over-scope, or discover a weeks-long gate late.”

## 0:30–1:30 — Library

- Open `/apps`.
- Filter to “no approval” and “under 1 hour.”
- Show cards with a one-line verdict and “can I test before approval?”
- Point out the tier badges: tested / verified / indexed.

## 1:30–2:30 — One easy guide

- Open GitHub.
- Show verdict, fastest path, next 3 actions, top blockers.
- Show the actual test evidence: created OAuth app, callback, authorization flow.
- “No review. The guide says so, and we tested it.”

## 2:30–3:30 — One hard guide

- Open Google.
- Show scope-dependent review: basic vs. sensitive vs. restricted.
- Show hands-on time vs. approval wait vs. time to first test user.
- Show what the agent can prepare and what the human must own.

## 3:30–4:30 — Live generation

- Open `/generate`.
- Submit an app outside the library, e.g., `miro.com`.
- Narrate the stream: resolving, finding docs, extracting claims, verifying, planning, critiquing.
- Open the generated guide.
- Point out sources, confidence, and “what we couldn’t verify.”

## 4:30–5:00 — Evidence and limitations

- Open the evidence panel.
- Show one correction: “The first draft said X; verification found Y; here is the source.”
- State limitations: no completed approvals, no paid accounts, time estimates are ranges, live guides are drafts.
- Close: “This is the decision layer above docs and managed OAuth directories.”

## Backup plan

- If live generation fails, use a recorded run or a cached guide and explain the failure mode.
- If a source is login-walled, show the “could not verify” note instead of guessing.
- Never improvise an approval claim.
