import type { LlmAdapter } from "@/lib/agent/types";
import { EXTRACT_SYSTEM, extractPrompt, parseJsonLoose, researchFromText, researchPrompt } from "@/lib/agent/llm/prompts";

// Model names change often; override with LLM_MODEL.
export const OPENAI_DEFAULT_MODEL = "gpt-5-mini";

export async function createOpenAiLlm(apiKey: string, model = OPENAI_DEFAULT_MODEL): Promise<LlmAdapter> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });

  return {
    async research(input) {
      const res = await client.responses.create({
        model,
        tools: [{ type: "web_search" }],
        input: researchPrompt(input),
      });
      return researchFromText(res.output_text ?? "");
    },
    async extract(input) {
      const res = await client.responses.create({
        model,
        instructions: EXTRACT_SYSTEM,
        input: extractPrompt(input),
        text: { format: { type: "json_object" } },
      });
      return parseJsonLoose(res.output_text ?? "");
    },
  };
}
