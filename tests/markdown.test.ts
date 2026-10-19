import { describe, expect, it } from "vitest";

import { toLibraryEntry } from "@/lib/data";
import { guideToMarkdown } from "@/lib/markdown";
import { guideSchema } from "@/lib/schema";

import sample from "./fixtures/sample-guide.json";

describe("guideToMarkdown", () => {
  const guide = guideSchema.parse(sample);

  it("matches the snapshot", () => {
    expect(guideToMarkdown(guide)).toMatchSnapshot();
  });

  it("puts the own-app box first and uses computed difficulty", () => {
    const md = guideToMarkdown(guide);
    expect(md.indexOf("## Do you need your own OAuth app?")).toBeLessThan(md.indexOf("## Verdict"));
    expect(md).toContain("Difficulty 5/5");
    expect(md).toContain("send-only path: 3/5");
    expect(md).toContain("reported by developers");
  });

  it("renders missing sections as unknown", () => {
    const sparse = guideSchema.parse({
      ...sample,
      steps: [],
      scopes: [],
      blockers: [],
      probes: [],
      evidence: [],
      unknowns: [],
      oauthConfig: {},
      generatedBy: "agent",
      partial: true,
    });
    const md = guideToMarkdown(sparse);
    expect(md).toContain("- PKCE: unknown");
    expect(md).toContain("Live-generated — verify");
    expect(md).toContain("**Partial:**");
  });

  it("shows unknown difficulty for a partial guide with no gates", () => {
    const partial = guideSchema.parse({ ...sample, partial: true, gates: [] });
    const md = guideToMarkdown(partial);
    expect(md).toContain("**Difficulty: unknown (partial result).**");
    expect(md).not.toMatch(/Difficulty \d\/5/);
    expect(toLibraryEntry(partial.app, partial).guide?.difficulty).toBeNull();

    const complete = guideSchema.parse({ ...sample, gates: [] });
    expect(guideToMarkdown(complete)).toContain("Difficulty 1/5");
  });
});
