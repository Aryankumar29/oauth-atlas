import { resolveApp } from "@/lib/agent/resolve";
import type { PipelineDeps, PipelineInput, RunEvent, RunRecord } from "@/lib/agent/types";

// SPEC §9.14: pre-generated demo guides are served from guide:{slug} unless the user asks to regenerate.
export const DEMO_CACHE_SLUGS = ["miro", "calendly"];

export const RATE_LIMIT = { max: 5, windowSeconds: 60 * 60 };

export function demoCacheSlugs(): string[] {
  const env = process.env.DEMO_CACHE_SLUGS;
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEMO_CACHE_SLUGS;
}

export async function serveFromCache(input: PipelineInput, deps: PipelineDeps): Promise<RunRecord | null> {
  if (input.force) return null;
  const resolved = resolveApp(input.query, input.slug);
  if ("error" in resolved || !demoCacheSlugs().includes(resolved.slug)) return null;
  const guide = await deps.store.getGuide(resolved.slug);
  // A partial guide is not worth pinning as the demo answer.
  if (!guide || guide.partial) return null;

  const at = deps.now().toISOString();
  const events: RunEvent[] = [
    { step: "resolve", status: "done", message: `${resolved.name} (${resolved.website})`, at },
    {
      step: "render",
      status: "done",
      message: `Served the cached guide generated ${guide.lastVerified}${guide.runId ? ` (run ${guide.runId})` : ""}. Regenerate to run live.`,
      data: { cached: true, sourceRunId: guide.runId, generatedAt: guide.lastVerified } satisfies CachedInfo,
      at,
    },
  ];
  events.forEach((e) => deps.emit(e));
  const run: RunRecord = {
    runId: input.runId,
    input,
    status: guide.partial ? "partial" : "done",
    events,
    guideSlug: guide.slug,
    guide,
    startedAt: at,
    finishedAt: at,
  };
  await deps.store.putRun(run);
  return run;
}

export type CachedInfo = { cached: true; sourceRunId?: string; generatedAt: string };

// Cache hits are marked on their render event, not in the RunRecord shape.
export function cachedInfo(run: RunRecord): CachedInfo | null {
  const d = run.events.find((e) => e.step === "render" && e.status === "done")?.data as Partial<CachedInfo> | undefined;
  return d?.cached ? (d as CachedInfo) : null;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
}
