import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import seed from "@/data/apps.seed.json";
import composio from "@/data/composio-managed.json";
import { rawGuides } from "@/data/guides";
import { isManaged, managedStatus, parseManagedAuthMarkdown } from "@/lib/composio";
import { difficulty } from "@/lib/difficulty";
import { appSchema, guideSchema, type GuideInput } from "@/lib/schema";

const guidesDir = path.join(__dirname, "..", "data", "guides");
const guideFiles = fs.readdirSync(guidesDir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));

describe("apps.seed.json", () => {
  const apps = seed.map((a) => appSchema.parse(a));

  it("has 100 unique apps", () => {
    expect(apps).toHaveLength(100);
    expect(new Set(apps.map((a) => a.slug)).size).toBe(100);
  });

  it("keeps the original 20", () => {
    const original = [
      "github", "google", "slack", "notion", "salesforce", "plaid", "hubspot", "atlassian", "shopify", "microsoft",
      "miro", "calendly", "linear", "airtable", "asana", "dropbox", "zoom", "stripe", "quickbooks", "meta",
    ];
    for (const s of original) expect(apps.some((a) => a.slug === s), s).toBe(true);
  });

  it("composio.managed agrees with the snapshot", () => {
    for (const a of apps) {
      if (a.composio.toolkitSlug) expect(a.composio.managed, a.slug).toBe(managedStatus(a.composio.toolkitSlug));
    }
  });
});

describe("composio snapshot", () => {
  it("has 123 managed / 211 byo", () => {
    expect(composio.managed).toHaveLength(123);
    expect(composio.byo).toHaveLength(211);
    expect(composio.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("isManaged()", () => {
    expect(isManaged("gmail")).toBe(true);
    expect(isManaged("GITHUB")).toBe(true);
    expect(isManaged("xero")).toBe(false);
    expect(managedStatus("xero")).toBe("no");
    expect(managedStatus("not-a-toolkit")).toBe("unknown");
  });

  it("parses the managed-auth markdown tables", () => {
    const md = [
      "## Composio-managed OAuth available (1)",
      "| Toolkit | Slug |",
      "|--|--|",
      "| [Gmail](/toolkits/gmail.md) | `GMAIL` |",
      "",
      "## Bring your own OAuth app (1)",
      "| [Xero](/toolkits/xero.md) | `XERO` |",
    ].join("\n");
    expect(parseManagedAuthMarkdown(md)).toEqual({ managed: ["gmail"], byo: ["xero"] });
  });
});

describe("data/guides", () => {
  it("every guide file is registered in index.ts and validates", () => {
    expect(rawGuides).toHaveLength(guideFiles.length);
    for (const raw of rawGuides) {
      const g = guideSchema.parse(raw);
      expect(difficulty(g.gates, { profile: g.verdict.profile }).score, g.slug).toBe(g.verdict.difficulty);
    }
  });
});

describe("guideSchema", () => {
  const milestones = (["dev-ready", "pilot-ready", "production-ready"] as const).map((id) => ({
    id,
    definition: id,
    handsOnHours: { min: 0, max: 1 },
    wait: { minDays: 0, maxDays: null },
    basis: "estimate" as const,
  }));
  const base: GuideInput = {
    slug: "example",
    app: appSchema.parse(seed[0]),
    version: "1",
    lastVerified: "2026-10-20",
    confidence: "medium",
    verdict: { difficulty: 1, approvalModel: "none", summary: "x", canTestBeforeApproval: true },
    milestones,
    generatedBy: "agent",
  };

  it("accepts a minimal guide and fills defaults", () => {
    const g = guideSchema.parse(base);
    expect(g.partial).toBe(false);
    expect(g.gates).toEqual([]);
    expect(g.probes).toEqual([]);
  });

  it("rejects milestones out of order or not exactly 3", () => {
    expect(guideSchema.safeParse({ ...base, milestones: [milestones[1], milestones[0], milestones[2]] }).success).toBe(false);
    expect(guideSchema.safeParse({ ...base, milestones: milestones.slice(0, 2) }).success).toBe(false);
  });
});
