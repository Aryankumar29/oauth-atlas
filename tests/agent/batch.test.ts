import { describe, expect, it } from "vitest";

import { indexLines, MockWriteRefused, qaGate, runBatch, type BatchOptions } from "@/lib/agent/batch";
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
