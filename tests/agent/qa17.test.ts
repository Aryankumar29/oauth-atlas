import { describe, expect, it } from "vitest";

import { LlmError } from "@/lib/agent/llm/errors";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import type { LlmAdapter, LlmCallOptions, PipelineDeps } from "@/lib/agent/types";
import { createMemoryStore } from "@/lib/store";

const fast = { probeStepMs: 100, probeRequestMs: 50, fetchTimeoutMs: 100 };
const SOFT = "Generation hit the soft deadline; discovery stopped early.";

function deps(research: LlmAdapter["research"], now = () => new Date()): PipelineDeps {
  return {
    fetch: createMockFetch(),
    llm: { research, extract: createMockLlm().extract },
    store: createMemoryStore(),
    now,
    emit: () => {},
  };
}

describe("QA-17: research cancelled at the soft deadline", () => {
  it.each([
    ["adapter cancellation (LlmError timeout)", new LlmError("timeout", "Anthropic request cancelled at the pipeline deadline", false)],
    ["plain 'timed out' error from another adapter", new Error("research timed out after 150s")],
  ])("%s is labeled as the soft deadline", async (_label, err) => {
    const run = await runPipeline({ query: "Miro", runId: "q17" }, deps(async () => Promise.reject(err)), fast);
    expect(run.guide?.unknowns).toContain(SOFT);
    expect(run.guide?.partial).toBe(true);
  });

  it("a non-timeout failure is not labeled as the soft deadline", async () => {
    const run = await runPipeline(
      { query: "Miro", runId: "q17b" },
      deps(async () => Promise.reject(new LlmError("auth", "Anthropic API key was rejected", false))),
      fast,
    );
    expect(run.guide?.unknowns).not.toContain(SOFT);
    expect(run.guide?.unknowns.join(" ")).toMatch(/Research call failed: Anthropic API key was rejected/);
  });

  it("deadlineAt is computed from deps.now()", async () => {
    const fixed = new Date("2026-10-20T00:00:00Z");
    let seen: LlmCallOptions | undefined;
    await runPipeline(
      { query: "Miro", runId: "q17c" },
      deps(async (i, o) => {
        seen = o;
        return createMockLlm().research(i);
      }, () => fixed),
      { ...fast, softDeadlineMs: 150_000 },
    );
    expect(seen?.deadlineAt).toBe(fixed.getTime() + 150_000);
  });
});
