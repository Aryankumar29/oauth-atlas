import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import type { PipelineOptions } from "@/lib/agent/pipeline";
import type { LlmAdapter, PipelineDeps, RunEvent } from "@/lib/agent/types";
import { nodeDnsLookup } from "@/lib/agent/urlGuard";
import { getStore } from "@/lib/store";

export const isMockMode = () => process.env.MOCK_LLM === "1";

export type LlmProvider = "gemini" | "anthropic" | "openai";

// Anthropic is the configured default; gemini and openai stay selectable.
export function llmProvider(): LlmProvider {
  const p = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  return p === "gemini" || p === "openai" ? p : "anthropic";
}

export async function getLlm(): Promise<LlmAdapter> {
  if (isMockMode()) return createMockLlm();
  const { createLlm } = await import("@/lib/agent/llm");
  try {
    return await createLlm(llmProvider());
  } catch (e) {
    // Keep the route usable (demo cache, labeled partial guides) when the provider is misconfigured.
    const fail = async (): Promise<never> => {
      throw e;
    };
    return { research: fail, extract: fail };
  }
}

export async function createDeps(emit: (e: RunEvent) => void): Promise<PipelineDeps> {
  return {
    fetch: isMockMode() ? createMockFetch() : globalThis.fetch.bind(globalThis),
    llm: await getLlm(),
    store: await getStore(),
    now: () => new Date(),
    emit,
  };
}

export function pipelineOptionsFromEnv(): PipelineOptions {
  return {
    // MOCK_LLM never touches real DNS; fixtures are already static.
    dnsLookup: isMockMode() ? undefined : nodeDnsLookup,
    reader: { enabled: !isMockMode() && process.env.READER_FALLBACK !== "0", apiKey: process.env.JINA_API_KEY || undefined },
    composioApiKey: isMockMode() ? undefined : process.env.COMPOSIO_API_KEY || undefined,
  };
}
