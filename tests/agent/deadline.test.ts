import { describe, expect, it } from "vitest";

import { LlmError } from "@/lib/agent/llm/errors";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import type { LlmAdapter, PipelineDeps } from "@/lib/agent/types";
import { createMemoryStore } from "@/lib/store";

const fast = { probeStepMs: 100, probeRequestMs: 50, fetchTimeoutMs: 100 };
const EPSILON_MS = 150;

function deps(extract: LlmAdapter["extract"]): PipelineDeps {
  return {
    fetch: createMockFetch(),
    llm: { research: createMockLlm().research, extract },
    store: createMemoryStore(),
    now: () => new Date(),
    emit: () => {},
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("extract respects the hard deadline", () => {
  it("verifier repro: a retryable failure near the deadline finishes in time, partial, and persisted", async () => {
    let calls = 0;
    const d = deps(async () => {
      calls += 1;
      await sleep(250);
      throw new LlmError("max_tokens", "Extraction hit max_tokens; JSON is truncated", true);
    });
    const t0 = Date.now();
    const run = await runPipeline({ query: "Miro", runId: "hd1" }, d, { ...fast, hardDeadlineMs: 300 });
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThanOrEqual(300 + EPSILON_MS);
    expect(calls).toBe(1);
    expect(run.status).toBe("partial");
    expect(run.guide?.partial).toBe(true);
    // Depending on load, attempt 1 either fails just before the deadline (retry skipped) or is cut by it.
    expect(run.guide?.unknowns[0]).toMatch(/retry skipped|extract timed out/);
    const stored = await d.store.getRun("hd1");
    expect(stored?.status).toBe("partial");
    expect(stored?.finishedAt).toBeTruthy();
    expect(stored?.guide?.partial).toBe(true);
  });

  it("a hung extract call is cut at the hard deadline, not at a fixed per-attempt budget", async () => {
    const d = deps(() => new Promise(() => {}));
    const t0 = Date.now();
    const run = await runPipeline({ query: "Miro", runId: "hd2" }, d, { ...fast, hardDeadlineMs: 300 });
    expect(Date.now() - t0).toBeLessThanOrEqual(300 + EPSILON_MS);
    expect(run.status).toBe("partial");
    expect((await d.store.getRun("hd2"))?.status).toBe("partial");
  });

  it("skips the retry when under 20 s remain", async () => {
    let calls = 0;
    const d = deps(async () => {
      calls += 1;
      throw new LlmError("api", "Anthropic API error 500", true);
    });
    const run = await runPipeline({ query: "Miro", runId: "hd3" }, d, { ...fast, hardDeadlineMs: 15_000 });
    expect(calls).toBe(1);
    expect(run.guide?.unknowns[0]).toMatch(/retry skipped: \d+s left/);
  });

  it("still retries once when there is time", async () => {
    let calls = 0;
    const d = deps(async () => {
      calls += 1;
      throw new LlmError("api", "Anthropic API error 500", true);
    });
    await runPipeline({ query: "Miro", runId: "hd4" }, d, { ...fast, hardDeadlineMs: 60_000 });
    expect(calls).toBe(2);
  });
});
