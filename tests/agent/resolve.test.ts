import { describe, expect, it } from "vitest";

import { resolveApp } from "@/lib/agent/resolve";

const slugOf = (q: string) => {
  const r = resolveApp(q);
  return "error" in r ? `error` : r.seed ? r.slug : `unknown:${r.slug}`;
};

describe("resolveApp (QA-9)", () => {
  it.each([
    ["X", "twitter"],
    ["x", "twitter"],
    ["Miro", "miro"],
    ["notion", "notion"],
    ["gcal", "googlecalendar"],
    ["MS Teams", "microsoft-teams"],
    ["miro.com", "miro"],
  ])("%s → %s", (q, slug) => {
    expect(slugOf(q)).toBe(slug);
  });

  it("short queries without an exact match never pick a substring hit", () => {
    expect(slugOf("bo")).toBe("unknown:bo");
  });

  it("ranks word-prefix above substring", () => {
    const r = resolveApp("google");
    expect("error" in r ? null : r.seed?.name.toLowerCase().startsWith("google")).toBe(true);
  });

  it.each(["zzzz", "asdfgh"])("garbage %s resolves to a labeled unknown app, not a seed", (q) => {
    const r = resolveApp(q);
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.seed).toBeUndefined();
    expect(r.websiteGuessed).toBe(true);
  });

  it("punctuation-only input is rejected", () => {
    expect(resolveApp("!!!")).toEqual({ error: '"!!!" is not an app name or URL.' });
  });
});
