import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { extractGuide, TimeoutError, withTimeout } from "@/lib/agent/extract";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import type { LlmAdapter } from "@/lib/agent/types";
import { isSafeFetchUrl } from "@/lib/agent/urlGuard";
import { createMemoryStore } from "@/lib/store";

const fast = { probeStepMs: 100, probeRequestMs: 50, fetchTimeoutMs: 100 };
const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe("QA-21: no call without time, no unhandled rejections", () => {
  let unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  beforeEach(() => {
    unhandled = [];
    process.on("unhandledRejection", onUnhandled);
  });
  afterEach(() => {
    process.off("unhandledRejection", onUnhandled);
  });

  it("withTimeout(p, 0) rejects with TimeoutError and still observes p's later rejection", async () => {
    const p = new Promise((_, reject) => setTimeout(() => reject(new Error("late failure")), 10));
    await expect(withTimeout(p, 0, "x")).rejects.toBeInstanceOf(TimeoutError);
    await tick();
    expect(unhandled).toEqual([]);
  });

  it("extractGuide does not start a call when no time is left", async () => {
    let calls = 0;
    const llm: LlmAdapter = {
      research: createMockLlm().research,
      extract: async () => {
        calls += 1;
        throw new Error("should not be called");
      },
    };
    const ctx = {
      resolved: { slug: "x", name: "X", website: "https://x.example", category: "t", alternatives: [] },
      composio: { managed: "unknown" as const, checkedAt: "2026-10-20" },
      probes: [],
      runId: "t",
      now: new Date(),
      unknowns: [],
    };
    const r = await extractGuide(llm, { query: "X", docs: [], probes: [], composio: ctx.composio }, ctx, {
      partial: false,
      remainingMs: () => 0,
    });
    expect(calls).toBe(0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/extract timed out/);
    await tick();
    expect(unhandled).toEqual([]);
  });

  it("the pipeline skips research and extraction once their deadlines have passed", async () => {
    let research = 0;
    let extract = 0;
    const llm: LlmAdapter = {
      research: async () => {
        research += 1;
        throw new Error("late");
      },
      extract: async () => {
        extract += 1;
        throw new Error("late");
      },
    };
    const run = await runPipeline(
      { query: "Miro", runId: "qa21" },
      { fetch: createMockFetch(), llm, store: createMemoryStore(), now: () => new Date(), emit: () => {} },
      { ...fast, softDeadlineMs: 0, hardDeadlineMs: 0 },
    );
    expect(research).toBe(0);
    expect(extract).toBe(0);
    expect(run.status).toBe("partial");
    expect(run.guide?.unknowns).toContain("Generation hit the soft deadline; discovery stopped early.");
    await tick();
    expect(unhandled).toEqual([]);
  });

  it("repeated near-deadline runs stay free of unhandled rejections", async () => {
    const slow: LlmAdapter["extract"] = () => new Promise((_, reject) => setTimeout(() => reject(new Error("late")), 30));
    for (let i = 0; i < 10; i++) {
      await runPipeline(
        { query: "Miro", runId: `qa21-${i}` },
        {
          fetch: createMockFetch(),
          llm: { research: createMockLlm().research, extract: slow },
          store: createMemoryStore(),
          now: () => new Date(),
          emit: () => {},
        },
        { ...fast, hardDeadlineMs: 5 + i * 3 },
      );
    }
    await tick(100);
    expect(unhandled).toEqual([]);
  });
});

describe("QA-18 residual: IPv6 transition prefixes", () => {
  it.each([
    ["NAT64 loopback", "https://[64:ff9b::7f00:1]/"],
    ["NAT64 metadata", "https://[64:ff9b::169.254.169.254]/"],
    ["NAT64 private", "https://[64:ff9b::a00:1]/"],
    ["6to4 loopback", "https://[2002:7f00:1::]/"],
    ["6to4 private", "https://[2002:c0a8:101::1]/"],
    ["Teredo", "https://[2001:0:4136:e378:8000:63bf:3fff:fdd2]/"],
  ])("blocks %s", (_label, url) => {
    expect(isSafeFetchUrl(url)).toBe(false);
  });

  it.each([
    ["NAT64 public", "https://[64:ff9b::808:808]/"],
    ["6to4 public", "https://[2002:808:808::1]/"],
    ["ordinary 2001: global", "https://[2001:4860:4860::8888]/"],
  ])("allows %s", (_label, url) => {
    expect(isSafeFetchUrl(url)).toBe(true);
  });
});
