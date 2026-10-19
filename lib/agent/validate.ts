import type { FetchedDoc } from "@/lib/agent/types";
import { difficulty } from "@/lib/difficulty";
import type { Claim, Guide } from "@/lib/schema";

// SPEC §5 Evidence rules, applied to every generated guide before it is stored.

export type ValidationReport = {
  checkedClaims: number;
  downgraded: { where: string; value: string; from: string; reason: string }[];
  difficulty: { llm: number | null; computed: number; rationale: string[] };
  primaryEvidence: number;
};

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛`]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// A quote matches when every ellipsis-separated fragment (≥ 8 chars) appears in one fetched doc.
export function quoteMatches(quote: string | undefined, corpus: string[]): boolean {
  if (!quote) return false;
  const parts = normalizeForMatch(quote)
    .split(/\.\.\.|…/)
    .map((p) => p.trim().replace(/^["']|["']$/g, "").trim())
    .filter((p) => p.length > 0);
  if (!parts.length || parts.some((p) => p.length < 8)) return false;
  return corpus.some((doc) => parts.every((p) => doc.includes(p)));
}

export function validateGuide(
  guide: Guide,
  ctx: { docs: FetchedDoc[]; llmDifficulty?: unknown },
): { guide: Guide; report: ValidationReport } {
  const g: Guide = structuredClone(guide);
  const corpus = ctx.docs.map((d) => normalizeForMatch(d.text));
  const probeUrls = new Set(g.probes.map((p) => p.url));
  const report: ValidationReport = {
    checkedClaims: 0,
    downgraded: [],
    difficulty: { llm: typeof ctx.llmDifficulty === "number" ? ctx.llmDifficulty : null, computed: 0, rationale: [] },
    primaryEvidence: 0,
  };

  const checkClaim = (c: Claim | undefined, where: string) => {
    if (!c) return;
    report.checkedClaims += 1;
    if (c.status === "primary" && !c.sources.some((s) => quoteMatches(s.quote, corpus))) {
      report.downgraded.push({ where, value: c.value, from: "primary", reason: "quote not found in fetched docs" });
      c.status = "inferred";
      c.note = [c.note, "Downgraded: quote not found in docs fetched this run."].filter(Boolean).join(" ");
    } else if (c.status === "tested" && !(c.testKind === "probe" && c.sources.some((s) => probeUrls.has(s.url)))) {
      report.downgraded.push({ where, value: c.value, from: "tested", reason: "no matching probe record" });
      c.status = "inferred";
      c.testKind = undefined;
      c.note = [c.note, "Downgraded: no probe record backs this claim."].filter(Boolean).join(" ");
    }
  };

  g.milestones.forEach((m) => m.limitsUntilNext.forEach((c, i) => checkClaim(c, `milestones.${m.id}.limitsUntilNext[${i}]`)));
  g.gates.forEach((gate, i) => {
    checkClaim(gate.cost, `gates[${i}].cost`);
    checkClaim(gate.duration, `gates[${i}].duration`);
    checkClaim(gate.recurring, `gates[${i}].recurring`);
  });
  g.oauthConfig.redirectUris.forEach((c, i) => checkClaim(c, `oauthConfig.redirectUris[${i}]`));
  checkClaim(g.oauthConfig.pkce, "oauthConfig.pkce");
  checkClaim(g.oauthConfig.tokenLifetime, "oauthConfig.tokenLifetime");
  checkClaim(g.oauthConfig.refresh, "oauthConfig.refresh");
  g.oauthConfig.rateLimits.forEach((c, i) => checkClaim(c, `oauthConfig.rateLimits[${i}]`));

  for (const e of g.evidence) {
    report.checkedClaims += 1;
    if (e.status === "primary" && !quoteMatches(e.quote, corpus)) {
      report.downgraded.push({ where: `evidence.${e.id}`, value: e.claim, from: "primary", reason: "quote not found in fetched docs" });
      e.status = "inferred";
      e.confidence = "low";
    } else if (e.status === "tested" && !probeUrls.has(e.sourceUrl)) {
      report.downgraded.push({ where: `evidence.${e.id}`, value: e.claim, from: "tested", reason: "no matching probe record" });
      e.status = "inferred";
      e.confidence = "low";
    }
    if (e.status === "primary") report.primaryEvidence += 1;
  }

  // Difficulty is computed, never generated (SPEC §5.2).
  const d = difficulty(g.gates, { profile: g.verdict.profile });
  g.verdict.difficulty = d.score;
  report.difficulty.computed = d.score;
  report.difficulty.rationale = d.rationale;

  // Generated guides never claim high confidence.
  g.confidence = !g.partial && report.primaryEvidence >= 3 ? "medium" : "low";

  return { guide: g, report };
}
