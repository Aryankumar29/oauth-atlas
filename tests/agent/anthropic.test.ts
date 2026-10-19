import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { afterEach, describe, expect, it } from "vitest";

import { llmProvider } from "@/lib/agent/deps";
import { ANTHROPIC_DEFAULT_MODEL, anthropicAdapter, mapAnthropicError, type RequestOptions } from "@/lib/agent/llm/anthropic";
import { LlmError, LlmRefusalError } from "@/lib/agent/llm/errors";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import { createMemoryStore } from "@/lib/store";

const msg = (stop_reason: string, content: unknown[], extra: Record<string, unknown> = {}) =>
  ({ id: "m", type: "message", role: "assistant", model: "x", content, stop_reason, stop_details: null, usage: {}, ...extra }) as unknown as BetaMessage;

const results = (...urls: string[]) => ({
  type: "web_search_tool_result",
  tool_use_id: "t",
  content: urls.map((url) => ({ type: "web_search_result", url, title: url, encrypted_content: "", page_age: null })),
});

function fakeClient(responses: BetaMessage[]) {
  const calls: MessageCreateParamsNonStreaming[] = [];
  const options: RequestOptions[] = [];
  const create = async (params: MessageCreateParamsNonStreaming, opts: RequestOptions) => {
    calls.push(structuredClone(params));
    options.push(opts);
    const r = responses.shift();
    if (!r) throw new Error("no more fake responses");
    return r;
  };
  return { calls, options, adapter: anthropicAdapter(ANTHROPIC_DEFAULT_MODEL, { create, errors: Anthropic }) };
}

const input = { query: "Miro (https://miro.com)" };

describe("anthropic adapter: research", () => {
  it("sends the agreed request shape (no thinking, no tool_choice, web_search_20260209, fallback beta)", async () => {
    const { calls, adapter } = fakeClient([msg("end_turn", [{ type: "text", text: "URL: https://developers.miro.com/docs" }])]);
    await adapter.research(input);
    const p = calls[0] as unknown as Record<string, unknown>;
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.max_tokens).toBe(16000);
    expect(p.output_config).toEqual({ effort: "medium" });
    expect(p.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(p.fallbacks).toBe("default");
    expect(p.tools).toEqual([{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]);
    expect(p).not.toHaveProperty("thinking");
    expect(p).not.toHaveProperty("tool_choice");
  });

  it("continues on pause_turn and collects search results from every response", async () => {
    const first = msg("pause_turn", [results("https://a.example/1"), { type: "text", text: "searching…" }]);
    const { calls, adapter } = fakeClient([
      first,
      msg("end_turn", [results("https://b.example/2"), { type: "text", text: "URL: https://developers.miro.com/docs" }]),
    ]);
    const r = await adapter.research(input);
    expect(calls).toHaveLength(2);
    expect(calls[1].messages.at(-1)).toEqual({ role: "assistant", content: first.content });
    expect(r.citedUrls).toEqual(expect.arrayContaining(["https://a.example/1", "https://b.example/2", "https://developers.miro.com/docs"]));
  });

  it("stops after 3 continuations", async () => {
    const { calls, adapter } = fakeClient(Array.from({ length: 6 }, () => msg("pause_turn", [])));
    await adapter.research(input);
    expect(calls).toHaveLength(4);
  });

  it("ignores an error-object web_search_tool_result", async () => {
    const { adapter } = fakeClient([
      msg("end_turn", [
        { type: "web_search_tool_result", tool_use_id: "t", content: { type: "web_search_tool_result_error", error_code: "max_uses_exceeded" } },
        results("https://ok.example/x"),
      ]),
    ]);
    const r = await adapter.research(input);
    expect(r.citedUrls).toEqual(["https://ok.example/x"]);
  });

  it("throws a typed refusal with the category", async () => {
    const { adapter } = fakeClient([msg("refusal", [], { stop_details: { type: "refusal", category: "cyber", explanation: null } })]);
    await expect(adapter.research(input)).rejects.toMatchObject({ name: "LlmRefusalError", category: "cyber" });
  });
});

describe("anthropic adapter: extract", () => {
  const ex = { query: "Miro", docs: [], probes: [], composio: { managed: "yes" as const, checkedAt: "2026-10-20" } };

  it("parses JSON text and sends no tools", async () => {
    const { calls, adapter } = fakeClient([msg("end_turn", [{ type: "text", text: '{"a":1}' }])]);
    expect(await adapter.extract(ex)).toEqual({ a: 1 });
    expect(calls[0]).not.toHaveProperty("tools");
    expect(calls[0]).not.toHaveProperty("output_format");
  });

  it("max_tokens is a retryable LlmError", async () => {
    const { adapter } = fakeClient([msg("max_tokens", [{ type: "text", text: '{"a":' }])]);
    await expect(adapter.extract(ex)).rejects.toMatchObject({ kind: "max_tokens", retryable: true });
  });
});

describe("per-request options (timeout, retries, signal)", () => {
  const ex = { query: "Miro", docs: [], probes: [], composio: { managed: "yes" as const, checkedAt: "2026-10-20" } };

  it("extract: maxRetries 0, timeout capped by the deadline, signal forwarded", async () => {
    const { options, adapter } = fakeClient([msg("end_turn", [{ type: "text", text: "{}" }])]);
    const signal = new AbortController().signal;
    await adapter.extract(ex, { deadlineAt: Date.now() + 5_000, signal });
    expect(options).toHaveLength(1);
    expect(options[0].maxRetries).toBe(0);
    expect(options[0].timeout).toBeGreaterThan(4_000);
    expect(options[0].timeout).toBeLessThanOrEqual(5_000);
    expect(options[0].signal).toBe(signal);
  });

  it("extract without a deadline uses the 180 s cap", async () => {
    const { options, adapter } = fakeClient([msg("end_turn", [{ type: "text", text: "{}" }])]);
    await adapter.extract(ex);
    expect(options[0]).toMatchObject({ timeout: 180_000, maxRetries: 0 });
  });

  it("extract past the deadline fails fast without calling the API", async () => {
    const { options, adapter } = fakeClient([]);
    await expect(adapter.extract(ex, { deadlineAt: Date.now() - 1 })).rejects.toMatchObject({ kind: "timeout", retryable: false });
    expect(options).toHaveLength(0);
  });

  it("research: maxRetries 1, timeout is min(own budget, soft deadline), signal on every continuation", async () => {
    const { options, adapter } = fakeClient([msg("pause_turn", []), msg("end_turn", [])]);
    const signal = new AbortController().signal;
    await adapter.research(input, { deadlineAt: Date.now() + 60_000, signal });
    expect(options).toHaveLength(2);
    for (const o of options) {
      expect(o.maxRetries).toBe(1);
      expect(o.timeout).toBeLessThanOrEqual(60_000);
      expect(o.signal).toBe(signal);
    }
    const { options: o2, adapter: a2 } = fakeClient([msg("end_turn", [])]);
    await a2.research(input);
    expect(o2[0].timeout).toBeLessThanOrEqual(140_000);
    expect(o2[0].timeout).toBeGreaterThan(139_000);
  });

  it("research with under 5 s to the deadline makes no call", async () => {
    const { options, adapter } = fakeClient([]);
    await expect(adapter.research(input, { deadlineAt: Date.now() + 3_000 })).rejects.toMatchObject({ kind: "timeout" });
    expect(options).toHaveLength(0);
  });

  it("the pipeline aborts the extract signal at the hard deadline and passes the soft-deadline signal to research", async () => {
    let extractSignal: AbortSignal | undefined;
    let researchSignal: AbortSignal | undefined;
    const base = createMockLlm();
    await runPipeline(
      { query: "Miro", runId: "sig" },
      {
        fetch: createMockFetch(),
        llm: {
          research: (i, o) => {
            researchSignal = o?.signal;
            return base.research(i);
          },
          extract: (_i, o) => {
            extractSignal = o?.signal;
            return new Promise((_, reject) => o?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
          },
        },
        store: createMemoryStore(),
        now: () => new Date(),
        emit: () => {},
      },
      { probeStepMs: 100, probeRequestMs: 50, fetchTimeoutMs: 100, hardDeadlineMs: 300 },
    );
    expect(researchSignal).toBeInstanceOf(AbortSignal);
    expect(extractSignal?.aborted).toBe(true);
  });
});

describe("error mapping (typed classes, most specific first)", () => {
  const headers = new Headers();
  it.each([
    [new Anthropic.RateLimitError(429, {}, "slow down", headers), "rate_limit"],
    [new Anthropic.AuthenticationError(401, {}, "bad key", headers), "auth"],
    [new Anthropic.APIConnectionTimeoutError(), "timeout"],
    [new Anthropic.APIUserAbortError(), "timeout"],
    [new Anthropic.InternalServerError(500, {}, "boom", headers), "api"],
  ])("%s → %s", (err, kind) => {
    expect(mapAnthropicError(err, Anthropic)).toMatchObject({ kind });
  });

  it("leaves unknown errors alone", () => {
    const e = new TypeError("x");
    expect(mapAnthropicError(e, Anthropic)).toBe(e);
  });
});

describe("refusal in the pipeline", () => {
  it("a refused extraction yields a labeled partial guide without retrying", async () => {
    let calls = 0;
    const base = createMockLlm();
    const run = await runPipeline(
      { query: "Miro", runId: "refuse" },
      {
        fetch: createMockFetch(),
        llm: {
          research: base.research,
          extract: async () => {
            calls += 1;
            throw new LlmRefusalError("general_harms", null);
          },
        },
        store: createMemoryStore(),
        now: () => new Date(),
        emit: () => {},
      },
      { probeStepMs: 1000, probeRequestMs: 300, fetchTimeoutMs: 500 },
    );
    expect(calls).toBe(1);
    expect(run.status).toBe("partial");
    expect(run.guide?.unknowns[0]).toMatch(/Model declined \(general_harms\)/);
    expect(new LlmRefusalError(null)).toBeInstanceOf(LlmError);
  });
});

describe("provider selection", () => {
  const saved = process.env.LLM_PROVIDER;
  afterEach(() => {
    if (saved === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = saved;
  });

  it("defaults to anthropic; gemini and openai stay selectable", () => {
    delete process.env.LLM_PROVIDER;
    expect(llmProvider()).toBe("anthropic");
    process.env.LLM_PROVIDER = "gemini";
    expect(llmProvider()).toBe("gemini");
    process.env.LLM_PROVIDER = "OpenAI";
    expect(llmProvider()).toBe("openai");
    process.env.LLM_PROVIDER = "nonsense";
    expect(llmProvider()).toBe("anthropic");
  });
});
