import type { LlmProvider } from "@/lib/agent/deps";
import type { LlmAdapter } from "@/lib/agent/types";

export async function createLlm(provider: LlmProvider): Promise<LlmAdapter> {
  throw new Error(`LLM provider "${provider}" is not wired yet (T-005b). Set MOCK_LLM=1.`);
}
