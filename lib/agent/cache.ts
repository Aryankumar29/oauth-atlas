import type { StoredRun } from "@/lib/agent/pipeline";
import { resolveApp } from "@/lib/agent/resolve";
import type { PipelineDeps, PipelineInput, RunEvent } from "@/lib/agent/types";

// SPEC §9.14: pre-generated demo guides are served from guide:{slug} unless the user asks to regenerate.
export const DEMO_CACHE_SLUGS = ["miro", "calendly"];

export const RATE_LIMIT = { max: 5, windowSeconds: 60 * 60 };

export function demoCacheSlugs(): string[] {
  const env = process.env.DEMO_CACHE_SLUGS;
  return env ? env.split(",").map((s) => s.trim()).filter(Boolean) : DEMO_CACHE_SLUGS;
}

export async function serveFromCache(input: PipelineInput, deps: PipelineDeps): Promise<StoredRun | null> {
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
      data: { cached: true, sourceRunId: guide.runId },
      at,
    },
  ];
  events.forEach((e) => deps.emit(e));
  const run: StoredRun = {
    runId: input.runId,
    input,
    status: guide.partial ? "partial" : "done",
    events,
    guideSlug: guide.slug,
    guide,
    cachedFrom: { runId: guide.runId, generatedAt: guide.lastVerified },
    startedAt: at,
    finishedAt: at,
  };
  await deps.store.putRun(run);
  return run;
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
}
