import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { GET as getApp } from "@/app/api/guides/[app]/route";
import { GET as listRoute } from "@/app/api/guides/route";
import { fallbackGuide } from "@/lib/agent/extract";
import { guidePayload, listApps, lookupGuide } from "@/lib/api";
import { createMemoryStore } from "@/lib/store";

const emptyStore = createMemoryStore();

describe("listApps", () => {
  it("lists all 100 tracked apps; curated ones carry the computed difficulty", () => {
    const items = listApps();
    expect(items).toHaveLength(100);
    const gmail = items.find((a) => a.slug === "gmail")!;
    expect(gmail.guide).toMatchObject({ difficulty: 5, label: "Very hard" });
    expect(gmail.api).toMatch(/\/api\/guides\/gmail$/);
    expect(items.filter((a) => a.guide).length).toBe(5);
  });
});

describe("lookupGuide", () => {
  it("resolves a slug, a name or a URL to the curated guide", async () => {
    for (const q of ["github", "GitHub", "https://github.com"]) {
      const r = await lookupGuide(q, emptyStore);
      expect(r).toMatchObject({ found: true, source: "curated" });
    }
  });

  it("falls back to a generated guide in the store", async () => {
    const guide = fallbackGuide(
      {
        resolved: { slug: "miro", name: "Miro", website: "https://miro.com", category: "x", alternatives: [] },
        composio: { managed: "yes", checkedAt: "2026-10-28" },
        probes: [],
        runId: "run-1",
        now: new Date("2026-10-28T00:00:00Z"),
        unknowns: [],
      },
      "test",
    );
    const store = createMemoryStore();
    await store.putGuide(guide);
    const r = await lookupGuide("Miro", store);
    expect(r).toMatchObject({ found: true, source: "generated" });
    if (r.found) expect(guidePayload(r.source, r.guide).url).toMatch(/\/generate\/run-1$/);
  });

  it("answers not found with a link that starts generation", async () => {
    const r = await lookupGuide("Strava", emptyStore);
    expect(r).toMatchObject({ found: false, slug: "strava" });
    if (!r.found) expect(r.generateUrl).toMatch(/\/generate\?app=Strava$/);
  });
});

describe("routes", () => {
  const ctx = (app: string) => ({ params: Promise.resolve({ app }) }) as RouteContext<"/api/guides/[app]">;

  it("GET /api/guides returns JSON with CORS open", async () => {
    const res = await listRoute();
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect((await res.json()).count).toBe(100);
  });

  it("GET /api/guides/{app} returns the guide, or Markdown with ?format=md", async () => {
    const json = await getApp(new NextRequest("http://localhost/api/guides/gmail"), ctx("gmail"));
    const body = await json.json();
    expect(body).toMatchObject({ source: "curated", difficulty: { score: 5 } });
    expect(body.guide.slug).toBe("gmail");

    const md = await getApp(new NextRequest("http://localhost/api/guides/gmail?format=md"), ctx("gmail"));
    expect(md.headers.get("content-type")).toContain("text/markdown");
    expect(await md.text()).toContain("Gmail");
  });

  it("GET /api/guides/{unknown} is a 404 with a generate link", async () => {
    const res = await getApp(new NextRequest("http://localhost/api/guides/zzqqxv"), ctx("zzqqxv"));
    expect(res.status).toBe(404);
    expect((await res.json()).generateUrl).toContain("/generate?app=zzqqxv");
  });
});
