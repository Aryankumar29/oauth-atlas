import { LlmError } from "@/lib/agent/llm/errors";
import type { ResolvedApp } from "@/lib/agent/resolve";
import type { ExtractInput, LlmAdapter, LlmCallOptions } from "@/lib/agent/types";
import { difficulty } from "@/lib/difficulty";
import { guideSchema, type App, type ComposioInfo, type Guide, type Probe } from "@/lib/schema";

export const GENERATED_VERSION = "0.1.0-generated";

export type GuideContext = {
  resolved: ResolvedApp;
  composio: ComposioInfo;
  probes: Probe[];
  runId: string;
  now: Date;
  unknowns: string[];
};

function appFor(ctx: GuideContext): App {
  const r = ctx.resolved;
  return {
    slug: r.slug,
    name: r.name,
    website: r.website,
    category: r.category,
    approvalModel: r.seed?.approvalModel ?? "unknown",
    docsUrl: r.docsUrl,
    consoleUrl: r.consoleUrl,
    composio: ctx.composio,
    tier: "generated",
    lastVerified: undefined,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// Overwrites every field the LLM must not decide: identity, provenance, probes, difficulty.
export function normalizeDraft(draft: unknown, ctx: GuideContext, partial: boolean): unknown {
  if (!isObj(draft)) return draft;
  const d: Record<string, unknown> = { ...draft };
  const app = appFor(ctx);
  const verdict = isObj(d.verdict) ? { ...d.verdict } : {};
  if (typeof verdict.approvalModel === "string") app.approvalModel = verdict.approvalModel as App["approvalModel"];

  d.slug = ctx.resolved.slug;
  d.app = app;
  d.version = GENERATED_VERSION;
  d.lastVerified = ctx.now.toISOString().slice(0, 10);
  d.generatedBy = "agent";
  d.runId = ctx.runId;
  d.partial = partial || d.partial === true;
  d.probes = ctx.probes;
  d.corrections = [];
  d.unknowns = [...(Array.isArray(d.unknowns) ? d.unknowns.filter((u) => typeof u === "string") : []), ...ctx.unknowns];

  const gates = Array.isArray(d.gates) ? d.gates : [];
  try {
    verdict.difficulty = difficulty(gates as Guide["gates"], {
      profile: typeof verdict.profile === "string" ? verdict.profile : undefined,
    }).score;
  } catch {
    verdict.difficulty = 1;
  }
  d.verdict = verdict;
  return d;
}

export type ExtractOutcome =
  | { ok: true; guide: Guide; attempts: number; llmDifficulty?: unknown }
  | { ok: false; guide: Guide; attempts: number; error: string };

export async function extractGuide(
  llm: LlmAdapter,
  input: ExtractInput,
  ctx: GuideContext,
  opts: {
    partial: boolean;
    attempts?: number;
    // Time left before the pipeline's hard deadline; every attempt is bounded by it.
    remainingMs: () => number;
    // Don't start a retry with less than this left (default 20 s).
    minRetryMs?: number;
    llmOpts?: LlmCallOptions;
  },
): Promise<ExtractOutcome> {
  const errors: string[] = [];
  const max = opts.attempts ?? 2;
  const minRetryMs = opts.minRetryMs ?? 20_000;
  for (let attempt = 1; attempt <= max; attempt++) {
    if (attempt > 1 && opts.remainingMs() < minRetryMs) {
      errors.push(`retry skipped: ${Math.max(0, Math.round(opts.remainingMs() / 1000))}s left before the hard deadline`);
      break;
    }
    // Don't start a call there is no time for.
    const ms = opts.remainingMs();
    if (ms <= 0) {
      errors.push(`attempt ${attempt}: ${new TimeoutError("extract", 0).message}`);
      break;
    }
    try {
      const raw = await withTimeout(llm.extract(input, opts.llmOpts), ms, "extract");
      const llmDifficulty = isObj(raw) && isObj(raw.verdict) ? raw.verdict.difficulty : undefined;
      const parsed = guideSchema.safeParse(normalizeDraft(raw, ctx, opts.partial));
      if (parsed.success) return { ok: true, guide: parsed.data, attempts: attempt, llmDifficulty };
      errors.push(
        `attempt ${attempt}: ${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`,
      );
    } catch (e) {
      errors.push(`attempt ${attempt}: ${e instanceof Error ? e.message : String(e)}`);
      // Refusals, auth and rate-limit failures won't change on an immediate retry.
      if (e instanceof TimeoutError || (e instanceof LlmError && !e.retryable)) break;
    }
  }
  const error = errors.join(" | ");
  return { ok: false, guide: fallbackGuide(ctx, `Extraction failed: ${error}`.slice(0, 500)), attempts: max, error };
}

// Labeled partial guide: what we know for sure (identity, Composio status, probes) and nothing invented.
export function fallbackGuide(ctx: GuideContext, reason: string): Guide {
  const app = appFor(ctx);
  const unknownMilestone = (id: "dev-ready" | "pilot-ready" | "production-ready", definition: string) => ({
    id,
    definition,
    handsOnHours: { min: 0, max: 0 },
    wait: { minDays: 0, maxDays: null },
    basis: "unknown" as const,
    limitsUntilNext: [],
  });
  return guideSchema.parse({
    slug: app.slug,
    app,
    version: GENERATED_VERSION,
    lastVerified: ctx.now.toISOString().slice(0, 10),
    confidence: "low",
    partial: true,
    verdict: {
      difficulty: difficulty([]).score,
      approvalModel: app.approvalModel,
      summary: `Generation did not finish for ${app.name}. Approval requirements are unknown; only the Composio status and probe results below were checked.`,
      canTestBeforeApproval: "unknown",
    },
    milestones: [
      unknownMilestone("dev-ready", "OAuth works for your own account in development."),
      unknownMilestone("pilot-ready", "A small set of external users can connect."),
      unknownMilestone("production-ready", "Any user can connect without caps or warnings."),
    ],
    probes: ctx.probes,
    unknowns: [reason, ...ctx.unknowns, "Approval model, gates, scopes, and timelines were not determined."],
    generatedBy: "agent",
    runId: ctx.runId,
  });
}

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${Math.round(ms / 1000)}s`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  if (ms <= 0) {
    // The call was already started: observe its eventual rejection so it can't surface as unhandled.
    p.catch(() => {});
    return Promise.reject(new TimeoutError(label, 0));
  }
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}
