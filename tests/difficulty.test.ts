import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { difficulty, GATE_WEIGHTS } from "@/lib/difficulty";
import { gateSchema } from "@/lib/schema";

const fixtureSchema = z.object({
  slug: z.string(),
  expected: z.record(z.string(), z.number()),
  gates: z.array(gateSchema),
});

const dir = path.join(__dirname, "fixtures", "guides");
const fixtures = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => fixtureSchema.parse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))));

describe("difficulty() on demo fixtures", () => {
  it("covers all six demo apps", () => {
    expect(fixtures.map((f) => f.slug).sort()).toEqual(
      ["github", "gmail", "instagram", "microsoft", "notion", "slack"],
    );
  });

  for (const f of fixtures) {
    for (const [profile, score] of Object.entries(f.expected)) {
      it(`${f.slug} (${profile}) = ${score}`, () => {
        const result = difficulty(f.gates, profile === "default" ? {} : { profile });
        expect(result.score).toBe(score);
        expect(result.rationale.length).toBeGreaterThan(0);
      });
    }
  }
});

describe("difficulty() rules", () => {
  it("defaults to 1 with no gates", () => {
    expect(difficulty([])).toMatchObject({ score: 1, label: "Instant" });
  });

  it("ignores conditional gates (empty requiredFor)", () => {
    const r = difficulty([
      { type: "partner-program", name: "x", requiredFor: [] },
      { type: "testing-cap", name: "y", requiredFor: ["production-ready"] },
    ]);
    expect(r.score).toBe(2);
  });

  it("ignores pilot-only gates", () => {
    expect(difficulty([{ type: "app-review", name: "x", requiredFor: ["pilot-ready"] }]).score).toBe(1);
  });

  it("has a weight for every gate type", () => {
    for (const t of gateSchema.shape.type.options) expect(GATE_WEIGHTS[t]).toBeGreaterThan(0);
  });
});
