import type { LlmAdapter } from "@/lib/agent/types";
import { EXTRACT_SYSTEM, extractPrompt, parseJsonLoose, researchFromText, researchPrompt } from "@/lib/agent/llm/prompts";

export const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5-5";

export async function createAnthropicLlm(apiKey: string, model = ANTHROPIC_DEFAULT_MODEL): Promise<LlmAdapter> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });

  const textOf = (content: { type: string }[]) =>
    content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n");

  return {
    async research(input) {
      const msg = await client.messages.create({
        model,
        max_tokens: 4000,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
        messages: [{ role: "user", content: researchPrompt(input) }],
      });
      const searched = msg.content.flatMap((b) =>
        b.type === "web_search_tool_result" && Array.isArray(b.content) ? b.content.map((r) => r.url) : [],
      );
      return researchFromText(textOf(msg.content), searched.slice(0, 4));
    },
    async extract(input) {
      const msg = await client.messages.create({
        model,
        max_tokens: 16000,
        system: EXTRACT_SYSTEM,
        messages: [{ role: "user", content: extractPrompt(input) }],
      });
      return parseJsonLoose(textOf(msg.content));
    },
  };
}
