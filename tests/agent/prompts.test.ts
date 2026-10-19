import { describe, expect, it } from "vitest";

import { extractPrompt, parseJsonLoose, researchFromText } from "@/lib/agent/llm/prompts";

describe("LLM prompt helpers", () => {
  it("parses JSON wrapped in fences or prose", () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose('Here you go: {"a":{"b":2}} thanks')).toEqual({ a: { b: 2 } });
    expect(() => parseJsonLoose("no json")).toThrow();
  });

  it("collects cited URLs from text and grounding", () => {
    const r = researchFromText("URL: https://developers.miro.com/docs/oauth.\nURL: https://miro.com/legal", ["https://g.example/x"]);
    expect(r.citedUrls).toEqual(["https://developers.miro.com/docs/oauth", "https://miro.com/legal", "https://g.example/x"]);
  });

  it("puts docs, probes and Composio status in the extraction prompt", () => {
    const p = extractPrompt({
      query: "Miro",
      docs: [{ url: "https://d.example", text: "Doc body", fetchedAt: "2026-10-20" }],
      probes: [{ url: "https://p.example", method: "GET", status: 404, observed: "none", at: "2026-10-20" }],
      composio: { managed: "yes", toolkitSlug: "miro", checkedAt: "2026-10-20" },
    });
    expect(p).toContain("SOURCE 1: https://d.example");
    expect(p).toContain("GET https://p.example → 404");
    expect(p).toContain("COMPOSIO MANAGED OAUTH: yes");
  });
});
