import type { LlmAdapter } from "@/lib/agent/types";
import { EXTRACT_SYSTEM, extractPrompt, parseJsonLoose, researchFromText, researchPrompt } from "@/lib/agent/llm/prompts";

// SPEC §9.10: grounded research call, then a separate JSON extraction call (grounding and JSON mode don't combine).
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export async function createGeminiLlm(apiKey: string, model = GEMINI_DEFAULT_MODEL): Promise<LlmAdapter> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  return {
    async research(input) {
      const res = await ai.models.generateContent({
        model,
        contents: researchPrompt(input),
        config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
      });
      const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const grounding = chunks.map((c) => c.web?.uri).filter((u): u is string => !!u);
      return researchFromText(res.text ?? "", grounding);
    },
    async extract(input) {
      const res = await ai.models.generateContent({
        model,
        contents: extractPrompt(input),
        config: { systemInstruction: EXTRACT_SYSTEM, responseMimeType: "application/json", temperature: 0.1 },
      });
      return parseJsonLoose(res.text ?? "");
    },
  };
}
