import { describe, expect, it } from "vitest";

import { formatWait } from "@/lib/format";

describe("formatWait", () => {
  it("formats wait ranges", () => {
    expect(formatWait({ minDays: 0, maxDays: 0 })).toBe("no wait");
    expect(formatWait({ minDays: 0, maxDays: 84 })).toBe("up to 84 days");
    expect(formatWait({ minDays: 0, maxDays: 1 })).toBe("up to 1 day");
    expect(formatWait({ minDays: 3, maxDays: 10 })).toBe("3–10 days");
    expect(formatWait({ minDays: 30, maxDays: null })).toBe("30+ days");
    expect(formatWait(undefined)).toBe("unknown");
  });
});
