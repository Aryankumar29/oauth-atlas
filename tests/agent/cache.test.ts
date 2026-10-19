import { describe, expect, it } from "vitest";

import { cachedInfo, clientIp, serveFromCache } from "@/lib/agent/cache";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import type { PipelineDeps, RunEvent } from "@/lib/agent/types";
import { createMemoryStore } from "@/lib/store";

function deps(): PipelineDeps & { events: RunEvent[] } {
  const events: RunEvent[] = [];
  return {
    fetch: createMockFetch(),
    llm: createMockLlm(),
    store: createMemoryStore(),
    now: () => new Date(),
    emit: (e) => events.push(e),
    events,
  };
}

const fast = { probeStepMs: 1000, probeRequestMs: 300, fetchTimeoutMs: 500 };

describe("demo cache", () => {
  it("misses when nothing is cached, then serves the stored guide as a new run", async () => {
    const d = deps();
    expect(await serveFromCache({ query: "Miro", runId: "c0" }, d)).toBeNull();

    await runPipeline({ query: "Miro", runId: "live" }, d, fast);
    const hit = await serveFromCache({ query: "miro.com", runId: "c1" }, d);
    expect(hit && cachedInfo(hit)?.sourceRunId).toBe("live");
    expect(hit?.guide?.slug).toBe("miro");
    expect((await d.store.getRun("c1"))?.status).toBe("done");
    expect(d.events.at(-1)?.message).toMatch(/cached guide/);
  });

  it("is bypassed by force and ignores apps outside the demo set", async () => {
    const d = deps();
    await runPipeline({ query: "Miro", runId: "live" }, d, fast);
    expect(await serveFromCache({ query: "Miro", runId: "c2", force: true }, d)).toBeNull();
    await runPipeline({ query: "GitHub", runId: "gh" }, d, fast);
    expect(await serveFromCache({ query: "GitHub", runId: "c3" }, d)).toBeNull();
  });

  it("reads the client IP from x-forwarded-for", () => {
    const r = new Request("https://x.test", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    expect(clientIp(r)).toBe("1.2.3.4");
  });
});

describe("guide:{slug} protection", () => {
  it("a later partial run does not overwrite a complete cached guide", async () => {
    const d = deps();
    await runPipeline({ query: "Miro", runId: "good" }, d, fast);
    const hung = { ...d, llm: { research: () => new Promise<never>(() => {}), extract: d.llm.extract } };
    const bad = await runPipeline({ query: "Miro", runId: "bad" }, hung, { ...fast, softDeadlineMs: 30 });
    expect(bad.guide?.partial).toBe(true);
    expect((await d.store.getGuide("miro"))?.runId).toBe("good");
  });
});
