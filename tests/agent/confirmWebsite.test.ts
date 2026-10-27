import { describe, expect, it } from "vitest";

import { confirmGuessedWebsite, namesApp, siteNames } from "@/lib/agent/confirmWebsite";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import type { RunEvent } from "@/lib/agent/types";
import { officialDomainsFor } from "@/lib/agent/validate";
import { createMemoryStore } from "@/lib/store";

// strava.com recorded 2026-10-28: a redirect to www, whose page carries og:site_name "Strava".
const strava = [
  { url: "https://strava.com", status: 301, headers: { location: "https://www.strava.com/" }, body: "" },
  { url: "https://www.strava.com/", status: 200, body: '<html><head><meta property="og:site_name" content="Strava"></head><body></body></html>' },
];

const page = (html: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(html, { status, headers: { "content-type": "text/html", ...headers } });

describe("siteNames / namesApp", () => {
  it("reads the title, og:site_name and application-name in either attribute order", () => {
    expect(siteNames('<title>Meeting Scheduling | Calendly</title><meta content="Cal" name="application-name">')).toEqual([
      "Meeting Scheduling | Calendly",
      "Cal",
    ]);
    expect(siteNames('<meta property="og:site_name" content="Strava">')).toEqual(["Strava"]);
    expect(siteNames("<title>Strava | Running, Cycling &amp; Hiking App</title>")).toEqual(["Strava | Running, Cycling & Hiking App"]);
  });

  it("matches whole words only", () => {
    expect(namesApp(["Strava | Running, Cycling & Hiking App"], "Strava")).toBe(true);
    expect(namesApp(["Toggl Track: time tracking"], "Toggl Track")).toBe(true);
    expect(namesApp(["Notional Finance"], "Notion")).toBe(false);
    expect(namesApp([], "Strava")).toBe(false);
  });
});

describe("confirmGuessedWebsite", () => {
  it("confirms through a same-domain redirect when the homepage names the app", async () => {
    const r = await confirmGuessedWebsite({ name: "Strava", website: "https://strava.com" }, { fetch: createMockFetch(strava) });
    expect(r).toMatchObject({ confirmed: true });
    expect(r.observed).toContain("www.strava.com");
  });

  it("does not confirm a page that doesn't name the app", async () => {
    const r = await confirmGuessedWebsite({ name: "Strava", website: "https://strava.com" }, { fetch: async () => page("<title>Domain for sale</title>") });
    expect(r.confirmed).toBe(false);
  });

  it("does not follow a redirect off the guessed domain", async () => {
    const urls: string[] = [];
    const f: typeof fetch = async (input) => {
      urls.push(String(input));
      return page("", 302, { location: "https://parking.example.net/strava" });
    };
    const r = await confirmGuessedWebsite({ name: "Strava", website: "https://strava.com" }, { fetch: f });
    expect(r).toMatchObject({ confirmed: false });
    expect(r.observed).toContain("Redirected off strava.com");
    expect(urls).toEqual(["https://strava.com"]);
  });

  it("never fetches a non-public address", async () => {
    const urls: string[] = [];
    const r = await confirmGuessedWebsite(
      { name: "X", website: "https://x.example" },
      { fetch: async (i) => (urls.push(String(i)), page("<title>X</title>")), dnsLookup: async () => ["10.0.0.5"] },
    );
    expect(r.confirmed).toBe(false);
    expect(urls).toEqual([]);
  });
});

describe("pipeline (QA-19)", () => {
  async function run(query: string, extra: typeof strava = []) {
    const events: RunEvent[] = [];
    const r = await runPipeline(
      { query, runId: `t-${query}` },
      { fetch: createMockFetch([...strava, ...extra]), llm: createMockLlm(), store: createMemoryStore(), now: () => new Date(), emit: (e) => events.push(e) },
      { probeStepMs: 1000, probeRequestMs: 300, fetchTimeoutMs: 500, skipProbe: true },
    );
    return { run: r, resolve: events.find((e) => e.step === "resolve" && e.status === "done")! };
  }

  it("a confirmed guess is an official domain, and the guide has no guessed-website unknown", async () => {
    const { run: r, resolve } = await run("Strava");
    expect(resolve.message).toContain("website confirmed");
    expect(r.guide?.unknowns.some((u) => u.includes("guessed from the name"))).toBe(false);
    expect(officialDomainsFor({ slug: "strava", website: "https://strava.com" })).toContain("strava.com");
  });

  it("an unconfirmed guess stays out of the official domains and is listed as unknown", async () => {
    const { run: r, resolve } = await run("Zzqqxv");
    expect(resolve.message).toContain("not confirmed");
    expect(r.guide?.unknowns.some((u) => u.includes("could not be confirmed"))).toBe(true);
  });
});
