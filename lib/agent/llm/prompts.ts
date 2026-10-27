import type { ExtractInput, ResearchResult } from "@/lib/agent/types";
import { gateTypeSchema } from "@/lib/schema";

// Shared prompts for every provider adapter. The extraction output is validated by guideSchema; fields the
// pipeline owns (slug, app, version, probes, runId, generatedBy, verdict.difficulty) are overwritten anyway.

export function researchPrompt(input: { query: string; hints?: string[] }): string {
  return [
    `Find the official developer documentation for building an OAuth 2.0 integration with ${input.query}.`,
    "I need the provider's own pages (not blogs) covering:",
    "1. how to register an OAuth app / client and where the developer console is;",
    "2. scopes and which scopes need review or verification;",
    "3. app review, marketplace listing, partner program, security assessment, or verification requirements and published timelines;",
    "4. limits before approval (user caps, test users, rate limits, token lifetime, refresh tokens, PKCE, redirect URI rules).",
    "If the provider has no public OAuth program, say so and cite the page that shows it.",
    input.hints?.length ? `Known starting points: ${input.hints.join(", ")}` : "",
    "Reply with a short summary, then a list of the most relevant official URLs, one per line, prefixed with 'URL: '. At most 8 URLs.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function urlsFromText(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s)<>\]"'`]+/g) ?? [];
  return [...new Set(urls.map((u) => u.replace(/[.,;:]+$/, "")))];
}

export function researchFromText(text: string, groundingUrls: string[] = []): ResearchResult {
  return { docs: [], citedUrls: [...new Set([...urlsFromText(text), ...groundingUrls])].slice(0, 12) };
}

const DOC_CHARS = 14_000;
const TOTAL_CHARS = 70_000;

export const EXTRACT_SYSTEM = `You write decision-grade OAuth setup guides for developers building AI agents.
Output ONE JSON object and nothing else. Rules:
- Use only the SOURCE DOCUMENTS and PROBE RESULTS given. Do not use memory for facts.
- A claim or evidence item may have status "primary" only if it carries a "quote" copied VERBATIM (exact characters, 8-300 chars) from a source document's text. Otherwise use "inferred" and say so in "note".
- Never use status "tested"; the pipeline adds tested claims from probes and attempts itself.
- ATTEMPT lines are setup steps the agent tried itself without credentials. Let them shape the steps, agentTasks and humanTasks. If an attempt found a remote MCP server whose client registration looks open, say in "ownApp.notes" that an agent connecting through MCP can register its own client instead of creating an OAuth app.
- Never invent review times, costs, or approvals. If a timeline is not stated in the sources, set basis "unknown", wait.maxDays null, and add it to "unknowns".
- Community or third-party sources are "secondary".
- If the sources show no public OAuth program, add a gate {"type":"no-self-serve", "requiredFor":["pilot-ready","production-ready"]}.
- Gates that only apply in some setups get "requiredFor": [] and an "appliesWhen" explanation.
- Do not output a difficulty number; it is computed from gates.`;

export const EXTRACT_SHAPE = `{
  "confidence": "high"|"medium"|"low",
  "ownApp": { "triggers": string[], "notes"?: string },
  "verdict": { "approvalModel": "none"|"listing-review"|"scope-verification"|"app-review"|"partner-program"|"admin-consent"|"unknown",
               "summary": string (one line), "canTestBeforeApproval": true|false|"unknown", "profile"?: string },
  "milestones": [ exactly 3, in order, ids "dev-ready","pilot-ready","production-ready":
    { "id", "definition": string, "handsOnHours": {"min": number, "max": number},
      "wait": {"minDays": number, "maxDays": number|null},
      "basis": "official-sla"|"official-estimate"|"community"|"estimate"|"unknown",
      "limitsUntilNext": Claim[] } ],
  "gates": [ { "type": ${gateTypeSchema.options.map((t) => `"${t}"`).join("|")},
               "name": string, "appliesWhen": string, "requiredFor": ("pilot-ready"|"production-ready")[],
               "cost"?: Claim, "duration"?: Claim, "recurring"?: Claim } ],
  "requirements": [ { "id", "label", "detail", "requiredFor": milestone id, "owner": "agent"|"human"|"both", "evidenceIds": string[] } ],
  "scopes": [ { "name", "sensitivity": "basic"|"sensitive"|"restricted"|"unknown", "whyNeeded", "reviewTrigger", "justificationDraft"?, "evidenceIds": string[] } ],
  "steps": [ { "id", "phase": "decide"|"create"|"configure"|"test"|"submit"|"launch", "title", "actions": string[] (>=1),
               "owner": "agent"|"human"|"both", "timeMinutes"?: number, "doneWhen": string, "artifacts": string[], "evidenceIds": string[] } ],
  "oauthConfig": { "redirectUris": Claim[], "pkce"?: Claim, "tokenLifetime"?: Claim, "refresh"?: Claim, "rateLimits": Claim[] },
  "blockers": [ { "id", "severity": "low"|"medium"|"high"|"critical", "description", "affects": milestone id, "workaround"?, "agentCanHelp": boolean, "evidenceIds": string[] } ],
  "agentTasks": string[], "humanTasks": string[], "unknowns": string[],
  "evidence": [ { "id", "claim", "sourceUrl", "sourceType": "official-doc"|"console"|"policy"|"pricing"|"community"|"other",
                  "quote"?: string, "retrievedAt": ISO string, "status": "primary"|"secondary"|"inferred"|"conflicting", "confidence": "high"|"medium"|"low" } ]
}
Claim = { "value": string, "status": "primary"|"secondary"|"inferred"|"conflicting",
          "sources": [ { "url", "title"?, "quote"?, "fetchedAt": ISO string } ], "lastChecked": ISO date, "note"?: string }`;

export function extractPrompt(input: ExtractInput): string {
  let budget = TOTAL_CHARS;
  const docs = input.docs
    .map((d, i) => {
      const text = d.text.slice(0, Math.min(DOC_CHARS, Math.max(0, budget)));
      budget -= text.length;
      return text ? `--- SOURCE ${i + 1}: ${d.url} (fetched ${d.fetchedAt})${d.title ? ` "${d.title}"` : ""}\n${text}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  const probes = input.probes
    .map((p) => `- ${p.kind === "attempt" ? "ATTEMPT " : ""}${p.method} ${p.url} → ${p.status}${p.redirect ? ` → ${p.redirect}` : ""}: ${p.observed}`)
    .join("\n");
  return [
    `APP: ${input.query}`,
    `COMPOSIO MANAGED OAUTH: ${input.composio.managed} (toolkit ${input.composio.toolkitSlug ?? "unknown"})`,
    `PROBE AND ATTEMPT RESULTS (endpoint behaviour only, never policy):\n${probes || "(none)"}`,
    `SOURCE DOCUMENTS:\n${docs || "(none)"}`,
    `Return JSON with this shape:\n${EXTRACT_SHAPE}`,
  ].join("\n\n");
}

// Tolerates code fences or prose around the JSON object.
export function parseJsonLoose(text: string): unknown {
  const t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try {
    return JSON.parse(t);
  } catch {
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("LLM did not return JSON");
  }
}
