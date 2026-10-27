import type { LlmAdapter } from "@/lib/agent/types";
import { EXTRACT_SYSTEM, extractPrompt, parseJsonLoose, researchFromText, researchPrompt } from "@/lib/agent/llm/prompts";

// Model names change often; override with LLM_MODEL.
export const OPENAI_DEFAULT_MODEL = "gpt-5-mini";

// baseURL points the same client at an OpenAI-compatible v1 API, e.g. Azure OpenAI's
// https://<resource>.openai.azure.com/openai/v1 (the model is then the deployment name).
export async function createOpenAiLlm(apiKey: string, model = OPENAI_DEFAULT_MODEL, baseURL?: string): Promise<LlmAdapter> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey, baseURL });

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
