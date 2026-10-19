import type { LlmProvider } from "@/lib/agent/deps";
import type { LlmAdapter } from "@/lib/agent/types";

const KEY_ENV: Record<LlmProvider, string> = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
};

export async function createLlm(provider: LlmProvider): Promise<LlmAdapter> {
  const apiKey = process.env[KEY_ENV[provider]];
  if (!apiKey) throw new Error(`${KEY_ENV[provider]} is not set (LLM_PROVIDER=${provider}). Set MOCK_LLM=1 to run offline.`);
  const model = process.env.LLM_MODEL || undefined;
  switch (provider) {
    case "gemini":
      return (await import("@/lib/agent/llm/gemini")).createGeminiLlm(apiKey, model);
    case "openai":
      return (await import("@/lib/agent/llm/openai")).createOpenAiLlm(apiKey, model);
    default:
      return (await import("@/lib/agent/llm/anthropic")).createAnthropicLlm(apiKey, model);
  }
}
