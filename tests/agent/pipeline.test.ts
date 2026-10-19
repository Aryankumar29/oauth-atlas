import { describe, expect, it } from "vitest";

import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import type { LlmAdapter, PipelineDeps, RunEvent } from "@/lib/agent/types";
import { guideSchema } from "@/lib/schema";
import { createMemoryStore } from "@/lib/store";

function makeDeps(overrides: Partial<PipelineDeps> = {}) {
  const events: RunEvent[] = [];
  const deps: PipelineDeps = {
    fetch: createMockFetch(),
    llm: createMockLlm(),
    store: createMemoryStore(),
    now: () => new Date(),
    emit: (e) => events.push(e),
    ...overrides,
  };
  return { deps, events };
}

const fast = { probeStepMs: 2000, probeRequestMs: 500, fetchTimeoutMs: 1000 };

describe("runPipeline", () => {
  it("happy path: streams every step, validates, and persists the run and guide", async () => {
    const { deps, events } = makeDeps();
    const run = await runPipeline({ query: "Miro", runId: "r1" }, deps, fast);

    expect(run.status).toBe("done");
    const steps = [...new Set(events.map((e) => e.step))];
    expect(steps).toEqual(expect.arrayContaining(["resolve", "composio", "discover", "probe", "extract", "verify", "render"]));
    expect(events.filter((e) => e.status === "error")).toEqual([]);

    const guide = guideSchema.parse(run.guide);
    expect(guide.slug).toBe("miro");
    expect(guide.generatedBy).toBe("agent");
    expect(guide.app.tier).toBe("generated");
    expect(guide.app.composio.managed).toBe("yes");
    expect(guide.runId).toBe("r1");
    // LLM said 4; gates say 1 (marketplace review is conditional).
    expect(guide.verdict.difficulty).toBe(1);
    expect(guide.confidence).not.toBe("high");
    expect(guide.probes.length).toBeGreaterThan(0);

    // The fabricated review-time quote is downgraded; the matching quote stays primary.
    const ev = Object.fromEntries(guide.evidence.map((e) => [e.id, e.status]));
    expect(ev["ev-install-own-team"]).toBe("primary");
    expect(ev["ev-review-time"]).toBe("inferred");

    const stored = await deps.store.getRun("r1");
    expect(stored?.status).toBe("done");
    expect(stored?.guide?.slug).toBe("miro");
    expect(await deps.store.getGuide("miro")).not.toBeNull();
  });

  it("timeout: a hung research call yields a labeled partial guide", async () => {
    const hung: LlmAdapter = {
      research: () => new Promise(() => {}),
      extract: createMockLlm().extract,
    };
    const { deps } = makeDeps({ llm: hung });
    const run = await runPipeline({ query: "Miro", runId: "r2" }, deps, { ...fast, softDeadlineMs: 50 });

    expect(run.status).toBe("partial");
    expect(run.guide?.partial).toBe(true);
    expect(run.guide?.confidence).toBe("low");
    expect(run.guide?.unknowns.join(" ")).toMatch(/soft deadline/);
  });

  it("extraction that never validates is retried once, then saved as partial", async () => {
    let calls = 0;
    const bad: LlmAdapter = {
      research: createMockLlm().research,
      extract: async () => {
        calls += 1;
        return { verdict: { summary: "missing milestones" } };
      },
    };
    const { deps } = makeDeps({ llm: bad });
    const run = await runPipeline({ query: "Miro", runId: "r3" }, deps, fast);
    expect(calls).toBe(2);
    expect(run.status).toBe("partial");
    expect(run.guide?.unknowns[0]).toMatch(/Extraction failed/);
  });

  it("no docs: unreachable sources produce a labeled partial guide, not a blank page", async () => {
    const { deps } = makeDeps();
    const run = await runPipeline({ query: "https://totally-unknown-app.example", runId: "r4" }, deps, fast);
    expect(run.status).toBe("partial");
    expect(run.guide?.app.name).toBe("Totally-unknown-app");
    expect(run.guide?.unknowns.join(" ")).toMatch(/No official docs/);
  });

  it("no public OAuth program scores 5 via a no-self-serve gate", async () => {
    const base = createMockLlm();
    const llm: LlmAdapter = {
      research: base.research,
      extract: async (input) => {
        const draft = (await base.extract(input)) as Record<string, unknown>;
        return {
          ...draft,
          gates: [{ type: "no-self-serve", name: "No public OAuth program", appliesWhen: "always", requiredFor: ["pilot-ready", "production-ready"] }],
        };
      },
    };
    const { deps } = makeDeps({ llm });
    const run = await runPipeline({ query: "Miro", runId: "r5" }, deps, fast);
    expect(run.guide?.verdict.difficulty).toBe(5);
  });

  it("ambiguous query is labeled in unknowns", async () => {
    const { deps } = makeDeps();
    const run = await runPipeline({ query: "google", runId: "r6" }, deps, fast);
    expect(run.guide).toBeDefined();
    const amb = run.events.find((e) => e.step === "resolve" && e.status === "done")?.data as { alternatives: unknown[] };
    if (amb.alternatives.length) expect(run.guide?.unknowns.join(" ")).toMatch(/also matched/);
  });

  it("empty query fails cleanly", async () => {
    const { deps } = makeDeps();
    const run = await runPipeline({ query: "  ", runId: "r7" }, deps, fast);
    expect(run.status).toBe("failed");
    expect(run.error).toBeTruthy();
  });
});
