import { describe, expect, it } from "vitest";

import { devToProdChip, formatWait, milestoneHours, milestoneWait } from "@/lib/format";
import { guideSchema, type Milestone } from "@/lib/schema";

import sample from "./fixtures/sample-guide.json";

describe("formatWait", () => {
  it("formats wait ranges", () => {
    expect(formatWait({ minDays: 0, maxDays: 0 })).toBe("no wait");
    expect(formatWait({ minDays: 0, maxDays: 84 })).toBe("up to 84 days");
    expect(formatWait({ minDays: 0, maxDays: 1 })).toBe("up to 1 day");
    expect(formatWait({ minDays: 3, maxDays: 10 })).toBe("3–10 days");
    expect(formatWait({ minDays: 30, maxDays: null })).toBe("30+ days");
    expect(formatWait(undefined)).toBe("unknown");
  });

  it("renders placeholder unknown-basis milestones as unknown, not zeros", () => {
    const placeholder: Milestone = {
      id: "dev-ready",
      definition: "unknown",
      handsOnHours: { min: 0, max: 0 },
      wait: { minDays: 0, maxDays: null },
      basis: "unknown",
      limitsUntilNext: [],
    };
    expect(milestoneHours(placeholder)).toBe("unknown");
    expect(milestoneWait(placeholder)).toBe("unknown");

    // Real zeros with a stated basis still render.
    const instant = { ...placeholder, basis: "official-estimate" as const, wait: { minDays: 0, maxDays: 0 } };
    expect(milestoneHours(instant)).toBe("0 min");
    expect(milestoneWait(instant)).toBe("no wait");

    const failed = guideSchema.parse({
      ...sample,
      milestones: (["dev-ready", "pilot-ready", "production-ready"] as const).map((id) => ({ ...placeholder, id })),
    });
    expect(devToProdChip(failed)).toBe("Dev unknown → Prod unknown");
  });

  it("says 'no wait' once, and suffixes real waits", () => {
    const g = guideSchema.parse(sample);
    const prod = g.milestones.find((m) => m.id === "production-ready")!;
    prod.basis = "official-estimate";
    prod.wait = { minDays: 0, maxDays: 0 };
    expect(devToProdChip(g)).toMatch(/→ Prod no wait$/);
    prod.wait = { minDays: 0, maxDays: 84 };
    expect(devToProdChip(g)).toMatch(/→ Prod up to 84 days wait$/);
  });
});
