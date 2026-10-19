import { describe, expect, it } from "vitest";

import { serveFromCache } from "@/lib/agent/cache";
import { cacheGuide } from "@/lib/agent/cacheGuide";
import { fallbackGuide } from "@/lib/agent/extract";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { createMemoryStore } from "@/lib/store";

function miroGuide() {
  const g = fallbackGuide(
    {
      resolved: { slug: "miro", name: "Miro", website: "https://miro.com", category: "Collaboration", alternatives: [] },
      composio: { managed: "yes", toolkitSlug: "miro", checkedAt: "2026-10-20" },
      probes: [],
      runId: "seed",
      now: new Date("2026-10-20T00:00:00Z"),
      unknowns: [],
    },
    "seeded",
  );
  return JSON.parse(JSON.stringify({ ...g, partial: false }));
}

describe("cacheGuide", () => {
  it("stores a valid guide that the demo cache then serves", async () => {
    const store = createMemoryStore();
    await cacheGuide(miroGuide(), store);
    const run = await serveFromCache(
      { query: "Miro", runId: "c" },
      { store, fetch: createMockFetch(), llm: createMockLlm(), now: () => new Date(), emit: () => {} },
    );
    expect(run?.guide?.slug).toBe("miro");
  });

  it("rejects hand-written guides", async () => {
    const store = createMemoryStore();
    const g = miroGuide();
    g.generatedBy = "human";
    g.app.tier = "verified";
    await expect(cacheGuide(g, store)).rejects.toThrow(/Refusing to cache/);
    expect(await store.getGuide("miro")).toBeNull();
  });

  it("rejects schema errors and a wrong difficulty", async () => {
    const store = createMemoryStore();
    await expect(cacheGuide({ slug: "x" }, store)).rejects.toThrow(/Invalid guide/);
    const g = miroGuide();
    g.verdict.difficulty = 4;
    await expect(cacheGuide(g, store)).rejects.toThrow(/!= computed 1/);
    expect(await store.getGuide("miro")).toBeNull();
  });
});
