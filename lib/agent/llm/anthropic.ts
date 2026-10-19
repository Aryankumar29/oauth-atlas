import type Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { LlmError, LlmRefusalError } from "@/lib/agent/llm/errors";
import { EXTRACT_SYSTEM, extractPrompt, parseJsonLoose, researchFromText, researchPrompt } from "@/lib/agent/llm/prompts";
import type { LlmAdapter } from "@/lib/agent/types";

// Exact model ID, no date suffix. LLM_MODEL overrides. Thinking is always on for this model: never send `thinking`.
export const ANTHROPIC_DEFAULT_MODEL = "claude-opus-5-5";
export const ANTHROPIC_BETAS = ["server-side-fallback-2026-07-01"];
const MAX_CONTINUATIONS = 3;
// Inside the pipeline's 150 s soft deadline; the pipeline's own timeout still races these calls.
export const RESEARCH_BUDGET_MS = 140_000;
export const EXTRACT_TIMEOUT_MS = 180_000;

type CreateFn = (params: MessageCreateParamsNonStreaming, options?: { timeout?: number }) => Promise<BetaMessage>;
type ErrorClasses = Pick<typeof Anthropic, "RateLimitError" | "AuthenticationError" | "APIConnectionTimeoutError" | "APIError">;

export type AnthropicDeps = { create: CreateFn; errors: ErrorClasses; now?: () => number };

const textOf = (content: BetaMessage["content"]) =>
  content
    .filter((b): b is Extract<BetaMessage["content"][number], { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("\n");

// Most specific first; no string matching.
export function mapAnthropicError(e: unknown, errors: ErrorClasses): unknown {
  if (e instanceof LlmError) return e;
  if (e instanceof errors.RateLimitError) return new LlmError("rate_limit", `Anthropic rate limit: ${e.message}`, false);
  if (e instanceof errors.AuthenticationError) return new LlmError("auth", "Anthropic API key was rejected", false);
  if (e instanceof errors.APIConnectionTimeoutError) return new LlmError("timeout", "Anthropic request timed out", false);
  if (e instanceof errors.APIError) return new LlmError("api", `Anthropic API error ${e.status ?? ""}: ${e.message}`, true);
  return e;
}

function checkRefusal(msg: BetaMessage) {
  if (msg.stop_reason === "refusal") {
    throw new LlmRefusalError(msg.stop_details?.category ?? null, msg.stop_details?.explanation ?? null);
  }
}

export function anthropicAdapter(model: string, deps: AnthropicDeps): LlmAdapter {
  const now = deps.now ?? Date.now;
  const base = {
    model,
    betas: ANTHROPIC_BETAS,
    fallbacks: "default" as const,
    output_config: { effort: "medium" as const },
  };

  return {
    async research(input) {
      const started = now();
      const params: MessageCreateParamsNonStreaming = {
        ...base,
        max_tokens: 16000,
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: researchPrompt(input) }],
      };
      const responses: BetaMessage[] = [];
      try {
        for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
          const remaining = RESEARCH_BUDGET_MS - (now() - started);
          if (remaining <= 5_000) break;
          const msg = await deps.create(params, { timeout: remaining });
          checkRefusal(msg);
          responses.push(msg);
          if (msg.stop_reason !== "pause_turn") break;
          // Server tool paused a long turn: resend with the partial assistant turn to continue.
          params.messages = [...params.messages, { role: "assistant", content: msg.content }];
        }
      } catch (e) {
        throw mapAnthropicError(e, deps.errors);
      }
      if (!responses.length) throw new LlmError("timeout", "Research budget exhausted before the first response", false);

      const blocks = responses.flatMap((r) => r.content);
      // An error result has an object `content` (e.g. max_uses_exceeded), not an array: ignore it.
      const searched = blocks.flatMap((b) =>
        b.type === "web_search_tool_result" && Array.isArray(b.content) ? b.content.map((r) => r.url) : [],
      );
      // On max_tokens we still use whatever text and results arrived.
      return researchFromText(textOf(blocks), searched.slice(0, 4));
    },

    async extract(input) {
      let msg: BetaMessage;
      try {
        msg = await deps.create(
          {
            ...base,
            max_tokens: 32000,
            system: EXTRACT_SYSTEM,
            messages: [{ role: "user", content: extractPrompt(input) }],
          },
          { timeout: EXTRACT_TIMEOUT_MS },
        );
      } catch (e) {
        throw mapAnthropicError(e, deps.errors);
      }
      checkRefusal(msg);
      if (msg.stop_reason === "max_tokens") {
        throw new LlmError("max_tokens", "Extraction hit max_tokens; JSON is truncated", true);
      }
      return parseJsonLoose(textOf(msg.content));
    },
  };
}

export async function createAnthropicLlm(apiKey: string, model = ANTHROPIC_DEFAULT_MODEL): Promise<LlmAdapter> {
  const { default: AnthropicSdk } = await import("@anthropic-ai/sdk");
  const client = new AnthropicSdk({ apiKey, maxRetries: 2 });
  return anthropicAdapter(model, {
    create: (params, options) => client.beta.messages.create(params, options),
    errors: AnthropicSdk,
  });
}
