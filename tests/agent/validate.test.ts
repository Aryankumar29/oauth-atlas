import { describe, expect, it } from "vitest";

import { fallbackGuide } from "@/lib/agent/extract";
import { isOfficialUrl, officialDomainsFor, quoteMatches, validateGuide } from "@/lib/agent/validate";
import type { FetchedDoc } from "@/lib/agent/types";
import { createMemoryStore } from "@/lib/store";

const doc: FetchedDoc = {
  url: "https://docs.example.com/oauth",
  text: "Apps in Testing mode are limited to 100 users.\nRefresh tokens expire after 7 days for apps in “Testing”.",
  fetchedAt: "2026-10-20T00:00:00Z",
};

function baseGuide() {
  return fallbackGuide(
    {
      resolved: { slug: "x", name: "X", website: "https://x.example", category: "Test", alternatives: [] },
      composio: { managed: "unknown", checkedAt: "2026-10-20" },
      probes: [{ url: "https://x.example/.well-known/openid-configuration", method: "GET", status: 200, observed: "found", at: "2026-10-20T00:00:00Z" }],
      runId: "t",
      now: new Date("2026-10-20T00:00:00Z"),
      unknowns: [],
    },
    "test",
  );
}

const OFFICIAL = ["example.com"];

const src = (quote: string) => [{ url: doc.url, quote, fetchedAt: doc.fetchedAt }];

describe("quoteMatches", () => {
  const corpus = [doc.text.toLowerCase().replace(/\s+/g, " ").replace(/[“”]/g, '"')];
  it("matches across whitespace, case and curly quotes", () => {
    expect(quoteMatches("apps in testing MODE are limited   to 100 users", corpus)).toBe(true);
    expect(quoteMatches('expire after 7 days for apps in "Testing"', corpus)).toBe(true);
  });
  it("matches ellipsis-joined fragments", () => {
    expect(quoteMatches("Apps in Testing mode … limited to 100 users", corpus)).toBe(true);
  });
  it("rejects missing, short, or invented quotes", () => {
    expect(quoteMatches(undefined, corpus)).toBe(false);
    expect(quoteMatches("100", corpus)).toBe(false);
    expect(quoteMatches("limited to 1000 users", corpus)).toBe(false);
  });
});

describe("validateGuide", () => {
  it("downgrades primary claims whose quote is not in fetched docs, keeps matching ones", () => {
    const g = baseGuide();
    g.oauthConfig.rateLimits = [
      { value: "100 users in testing", status: "primary", sources: src("limited to 100 users"), lastChecked: "2026-10-20" },
      { value: "1000 users in testing", status: "primary", sources: src("limited to 1000 users"), lastChecked: "2026-10-20" },
    ];
    g.oauthConfig.refresh = { value: "7-day refresh tokens", status: "primary", sources: [{ url: doc.url, fetchedAt: doc.fetchedAt }], lastChecked: "2026-10-20" };
    const { guide, report } = validateGuide(g, { docs: [doc], officialDomains: OFFICIAL });
    expect(guide.oauthConfig.rateLimits.map((c) => c.status)).toEqual(["primary", "inferred"]);
    expect(guide.oauthConfig.refresh?.status).toBe("inferred");
    expect(report.downgraded).toHaveLength(2);
  });

  it("downgrades tested claims and evidence without a probe record", () => {
    const g = baseGuide();
    g.oauthConfig.pkce = {
      value: "PKCE S256",
      status: "tested",
      testKind: "probe",
      sources: [{ url: "https://x.example/.well-known/openid-configuration", fetchedAt: "2026-10-20" }],
      lastChecked: "2026-10-20",
    };
    g.oauthConfig.tokenLifetime = { value: "1h", status: "tested", testKind: "attempt", sources: [], lastChecked: "2026-10-20" };
    g.evidence.push({
      id: "e1", claim: "c", sourceUrl: "https://elsewhere.example", sourceType: "test",
      retrievedAt: "2026-10-20", status: "tested", confidence: "high",
    });
    const { guide } = validateGuide(g, { docs: [doc], officialDomains: OFFICIAL });
    expect(guide.oauthConfig.pkce?.status).toBe("tested");
    expect(guide.oauthConfig.tokenLifetime?.status).toBe("inferred");
    expect(guide.evidence[0].status).toBe("inferred");
  });

  it("recomputes difficulty from gates and ignores the LLM value", () => {
    const g = baseGuide();
    g.verdict.difficulty = 2;
    g.gates = [{ type: "security-assessment", name: "CASA", appliesWhen: "restricted scopes", requiredFor: ["production-ready"] }];
    const { guide, report } = validateGuide(g, { docs: [doc], officialDomains: OFFICIAL, llmDifficulty: 2 });
    expect(guide.verdict.difficulty).toBe(5);
    expect(report.difficulty).toMatchObject({ llm: 2, computed: 5 });
  });
});

describe("official-source rule", () => {
  const blog: FetchedDoc = {
    url: "https://random-blog.test/oauth-tips",
    text: "Apps in Testing mode are limited to 100 users, says this blog.",
    fetchedAt: "2026-10-20T00:00:00Z",
  };
  const other: FetchedDoc = { url: "https://docs.example.com/other", text: "Unrelated page.", fetchedAt: "2026-10-20T00:00:00Z" };
  const ev = (id: string, sourceUrl: string, quote: string) => ({
    id, claim: "c", sourceUrl, sourceType: "official-doc" as const, quote,
    retrievedAt: "2026-10-20", status: "primary" as const, confidence: "high" as const,
  });

  it("verifier repro: random-blog evidence with a matching quote does not stay primary", () => {
    const g = baseGuide();
    g.evidence.push(ev("blog", blog.url, "limited to 100 users"));
    g.oauthConfig.rateLimits = [
      { value: "100 users", status: "primary", sources: [{ url: blog.url, quote: "limited to 100 users", fetchedAt: "x" }], lastChecked: "x" },
    ];
    const { guide, report } = validateGuide(g, { docs: [doc, blog], officialDomains: OFFICIAL });
    expect(guide.evidence[0].status).toBe("secondary");
    expect(guide.oauthConfig.rateLimits[0].status).toBe("secondary");
    expect(report.downgraded.map((d) => d.reason)).toContain("source is not an official provider domain");
  });

  it("an on-domain quote from its own doc stays primary", () => {
    const g = baseGuide();
    g.evidence.push(ev("own", doc.url, "limited to 100 users"));
    const { guide } = validateGuide(g, { docs: [doc, other], officialDomains: OFFICIAL });
    expect(guide.evidence[0].status).toBe("primary");
  });

  it("a quote that only matches a different doc is downgraded", () => {
    const g = baseGuide();
    g.evidence.push(ev("wrong-doc", other.url, "limited to 100 users"));
    g.evidence.push(ev("unfetched", "https://docs.example.com/never-fetched", "limited to 100 users"));
    const { guide, report } = validateGuide(g, { docs: [doc, other], officialDomains: OFFICIAL });
    expect(guide.evidence.map((e) => e.status)).toEqual(["inferred", "inferred"]);
    expect(report.downgraded.map((d) => d.reason)).toEqual([
      "quote only matches a different fetched doc",
      "source URL was not fetched this run",
    ]);
  });

  it("derives official domains from the website, docs/console hosts and the provider table", () => {
    const d = officialDomainsFor({ slug: "instagram", website: "https://www.instagram.com", docsUrl: "https://developers.facebook.com/docs/instagram" });
    expect(isOfficialUrl("https://developers.facebook.com/docs/x", d)).toBe(true);
    expect(isOfficialUrl("https://help.instagram.com/a", d)).toBe(true);
    expect(isOfficialUrl("https://notfacebook.com/a", d)).toBe(false);
    expect(isOfficialUrl("https://medium.com/@x/instagram", d)).toBe(false);
  });
});

describe("memory store", () => {
  it("counts rate-limit hits within a window", async () => {
    const s = createMemoryStore();
    expect(await s.incrRate("ip", 60)).toBe(1);
    expect(await s.incrRate("ip", 60)).toBe(2);
    expect(await s.incrRate("other", 60)).toBe(1);
  });
});
