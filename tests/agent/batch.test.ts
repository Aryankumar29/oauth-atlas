import { describe, expect, it } from "vitest";

import { indexLines, isCurated, MockWriteRefused, parseLimit, qaGate, runBatch, type BatchOptions } from "@/lib/agent/batch";
import { fallbackGuide } from "@/lib/agent/extract";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { rawGuides } from "@/data/guides";
import { createMemoryStore } from "@/lib/store";

const makeDeps: BatchOptions["makeDeps"] = async () => ({
  fetch: createMockFetch(),
  llm: createMockLlm(),
  store: createMemoryStore(),
  now: () => new Date(),
  emit: () => {},
});
const fast = { probeStepMs: 1000, probeRequestMs: 300, fetchTimeoutMs: 500 };

function base(o: Partial<BatchOptions> = {}): BatchOptions & { files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    slugs: [{ slug: "miro", name: "Miro" }],
    force: false,
    dryRun: true,
    mock: true,
    exists: (s) => files.has(s),
    write: (s, j) => files.set(s, j),
    makeDeps,
    pipelineOptions: fast,
    files,
    ...o,
  };
}

describe("runBatch", () => {
  it("refuses to write in mock mode unless --dry-run", async () => {
    const o = base({ dryRun: false });
    await expect(runBatch(o)).rejects.toBeInstanceOf(MockWriteRefused);
    expect(o.files.size).toBe(0);
  });

  it("is idempotent: skips slugs that already have a guide unless --force", async () => {
    let runs = 0;
    const o = base({
      exists: (s) => s === "miro",
      readExisting: () => ({ generatedBy: "agent", app: { tier: "generated" } }),
      makeDeps: async () => {
        runs += 1;
        return makeDeps();
      },
    });
    const r = await runBatch(o);
    expect(runs).toBe(0);
    expect(r.skipped).toEqual([{ slug: "miro", reasons: ["guide already exists (use --force)"] }]);

    const forced = await runBatch({ ...o, force: true });
    expect(runs).toBe(1);
    expect(forced.skipped[0]?.reasons[0]).not.toMatch(/already exists/);
  });

  it("the thin mock Miro guide fails the QA gate and is not written, even with writes allowed", async () => {
    const o = base({ mock: false, dryRun: false });
    const r = await runBatch(o);
    expect(r.written).toEqual([]);
    expect(o.files.size).toBe(0);
    expect(r.skipped[0].reasons.join(" ")).toMatch(/distinct sources/);
  });
});

describe("QA-14: curated guides", () => {
  it.each([
    [{ generatedBy: "human", app: { tier: "generated" } }],
    [{ generatedBy: "agent", app: { tier: "verified" } }],
    [{ generatedBy: "agent", app: { tier: "tested" } }],
    [null],
  ])("never overwrites %j, even with --force", async (existing) => {
    let runs = 0;
    const o = base({
      force: true,
      mock: false,
      dryRun: false,
      exists: () => true,
      readExisting: () => existing,
      makeDeps: async () => {
        runs += 1;
        return makeDeps();
      },
    });
    const r = await runBatch(o);
    expect(runs).toBe(0);
    expect(o.files.size).toBe(0);
    expect(r.skipped).toEqual([{ slug: "miro", reasons: ["curated guide, not overwritten"] }]);
  });

  it("agent-generated guides are not curated", () => {
    expect(isCurated({ generatedBy: "agent", app: { tier: "generated" } })).toBe(false);
  });

  it("the shipped library guides are all curated", () => {
    for (const g of rawGuides) expect(isCurated(g)).toBe(true);
  });
});

describe("QA-15b: --limit", () => {
  it("accepts positive integers and rejects anything else", () => {
    expect(parseLimit(undefined)).toBeUndefined();
    expect(parseLimit("5")).toBe(5);
    for (const bad of ["abc", "", "0", "-1", "2.5", "5x"]) expect(() => parseLimit(bad)).toThrow(/positive integer/);
  });
});

describe("qaGate", () => {
  const ctx = {
    resolved: { slug: "x", name: "X", website: "https://x.example", category: "t", alternatives: [] },
    composio: { managed: "unknown" as const, checkedAt: "2026-10-20" },
    probes: [],
    runId: "t",
    now: new Date("2026-10-20T00:00:00Z"),
    unknowns: [],
  };

  it("rejects a thin guide with every applicable reason", () => {
    const reasons = qaGate(fallbackGuide(ctx, "thin"), { events: [] });
    expect(reasons).toEqual(
      expect.arrayContaining([
        "guide is partial",
        "only 0 distinct sources (need ≥3)",
        "no primary source survived the validator",
        "no milestone has a cited limit",
        "probe step did not run",
        "no steps",
      ]),
    );
  });

  it("QA-15a: probe/test sources do not count toward the 3 distinct sources", () => {
    const g = JSON.parse(JSON.stringify(rawGuides.find((x) => (x as { slug: string }).slug === "notion")));
    const probeUrl = "https://api.notion.com/v1/oauth/authorize";
    g.probes = [{ url: probeUrl, method: "GET", status: 302, observed: "x", at: "2026-10-20" }];
    const keep = g.evidence.find((e: { sourceType: string }) => e.sourceType !== "test");
    g.evidence = [
      keep,
      { ...keep, id: "t1", sourceUrl: probeUrl, sourceType: "test", status: "tested" },
      { ...keep, id: "t2", sourceUrl: "https://probe.example/x", sourceType: "test", status: "tested" },
    ];
    g.milestones.forEach((m: { limitsUntilNext: unknown[] }) => (m.limitsUntilNext = []));
    g.gates.forEach((x: Record<string, unknown>) => { delete x.cost; delete x.duration; delete x.recurring; });
    g.oauthConfig = { redirectUris: [], rateLimits: [] };
    expect(qaGate(g)).toContain("only 1 distinct sources (need ≥3)");
  });

  it("rejects schema-invalid input", () => {
    expect(qaGate({ slug: "x" })[0]).toMatch(/^schema invalid/);
  });

  it("the curated library guides pass apart from uncited driver gates (sanity check of the gate's strictness)", () => {
    // Curated guides are not batch output; instagram's Business Verification duration is currently uncited.
    for (const g of rawGuides) {
      const other = qaGate(g).filter((r) => !r.startsWith("difficulty-driving gate"));
      expect(other, (g as { slug: string }).slug).toEqual([]);
    }
  });

  it("prints index lines with valid identifiers", () => {
    expect(indexLines(["miro", "microsoft-teams"])).toEqual([
      'import miro from "./miro.json";',
      'import microsoftTeams from "./microsoft-teams.json";',
      "// then append to rawGuides: miro, microsoftTeams",
    ]);
  });
});
