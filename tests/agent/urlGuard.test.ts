import { describe, expect, it } from "vitest";

import { fetchDoc } from "@/lib/agent/fetchDoc";
import { createMockFetch, createMockLlm } from "@/lib/agent/llm/mock";
import { runPipeline } from "@/lib/agent/pipeline";
import { runProbes } from "@/lib/agent/probe";
import type { LlmAdapter } from "@/lib/agent/types";
import { checkFetchUrl, checkFetchUrlResolved, isPrivateAddress, isSafeFetchUrl } from "@/lib/agent/urlGuard";
import { createMemoryStore } from "@/lib/store";

const now = () => new Date("2026-10-20T00:00:00Z");

describe("isSafeFetchUrl: blocked classes", () => {
  it.each([
    ["http scheme", "http://developers.miro.com/docs"],
    ["file scheme", "file:///etc/passwd"],
    ["ftp scheme", "ftp://example.com/x"],
    ["localhost", "https://localhost/"],
    ["localhost with port", "https://localhost:3000/"],
    ["*.localhost", "https://app.localhost/"],
    ["*.local", "https://printer.local/"],
    ["*.internal", "https://metadata.google.internal/computeMetadata/v1/"],
    ["single-label host", "https://intranet/"],
    ["trailing-dot localhost", "https://localhost./"],
    ["non-default port", "https://developers.miro.com:8443/docs"],
    ["explicit port 80 on https", "https://example.com:80/"],
    ["credentials", "https://user:pass@example.com/"],
    ["IPv4 loopback", "https://127.0.0.1/"],
    ["IPv4 loopback (decimal form)", "https://2130706433/"],
    ["IPv4 loopback (hex form)", "https://0x7f.0.0.1/"],
    ["0.0.0.0/8", "https://0.0.0.0/"],
    ["10/8", "https://10.1.2.3/"],
    ["172.16/12", "https://172.20.0.5/"],
    ["192.168/16", "https://192.168.1.1/"],
    ["link-local / metadata", "https://169.254.169.254/latest/meta-data/"],
    ["CGNAT 100.64/10", "https://100.100.1.1/"],
    ["IPv6 loopback", "https://[::1]/"],
    ["IPv6 unspecified", "https://[::]/"],
    ["IPv6 link-local", "https://[fe80::1]/"],
    ["IPv6 unique-local", "https://[fd12:3456::1]/"],
    ["IPv4-mapped IPv6 loopback", "https://[::ffff:127.0.0.1]/"],
    ["IPv4-mapped IPv6 metadata", "https://[::ffff:a9fe:a9fe]/"],
    ["garbage", "not a url"],
  ])("%s: %s", (_label, url) => {
    expect(isSafeFetchUrl(url)).toBe(false);
  });

  it.each([
    "https://developers.miro.com/docs/getting-started-with-oauth",
    "https://developer.calendly.com/how-to-authenticate-with-oauth",
    "https://docs.github.com/en/apps/oauth-apps",
    "https://8.8.8.8/",
    "https://[2606:4700:4700::1111]/",
    "https://172.32.0.1/",
    "https://100.128.0.1/",
  ])("public https passes: %s", (url) => {
    expect(isSafeFetchUrl(url)).toBe(true);
  });

  it("isPrivateAddress covers mapped and edge ranges", () => {
    expect(isPrivateAddress("172.31.255.255")).toBe(true);
    expect(isPrivateAddress("172.32.0.0")).toBe(false);
    expect(isPrivateAddress("100.127.255.255")).toBe(true);
    expect(isPrivateAddress("::ffff:10.0.0.1")).toBe(true);
    expect(isPrivateAddress("::ffff:8.8.8.8")).toBe(false);
    expect(isPrivateAddress("not-an-ip")).toBe(true);
  });

  it("checkFetchUrl explains its reason", () => {
    expect(checkFetchUrl("http://x.com")).toEqual({ ok: false, reason: "scheme http: not allowed" });
  });
});

describe("DNS check", () => {
  it("rejects a public-looking host if ANY resolved address is private", async () => {
    const r = await checkFetchUrlResolved("https://rebind.example.com/", async () => ["93.184.216.34", "10.0.0.5"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/non-public address 10\.0\.0\.5/);
  });

  it("accepts a host that resolves only to public addresses", async () => {
    expect((await checkFetchUrlResolved("https://docs.example.com/", async () => ["93.184.216.34"])).ok).toBe(true);
  });

  it("fails closed on DNS errors", async () => {
    const r = await checkFetchUrlResolved("https://nx.example.com/", async () => {
      throw new Error("ENOTFOUND");
    });
    expect(r.ok).toBe(false);
  });

  it("fetchDoc never calls fetch for a host that resolves privately", async () => {
    let called = 0;
    const f: typeof fetch = async () => {
      called += 1;
      return new Response("x");
    };
    const r = await fetchDoc("https://evil.example.com/", { fetch: f, now, dnsLookup: async () => ["127.0.0.1"] });
    expect(r).toMatchObject({ ok: false, reason: "blocked" });
    expect(called).toBe(0);
  });
});

describe("redirects", () => {
  const page = "<html><body>" + "Public OAuth documentation text. ".repeat(20) + "</body></html>";

  it("a redirect to 127.0.0.1 is blocked before it is fetched", async () => {
    const seen: string[] = [];
    const modes: (RequestRedirect | undefined)[] = [];
    const f: typeof fetch = async (input, init) => {
      seen.push(String(input));
      modes.push(init?.redirect);
      return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/admin" } });
    };
    const r = await fetchDoc("https://docs.example.com/oauth", { fetch: f, now });
    expect(r).toMatchObject({ ok: false, reason: "blocked" });
    expect(seen).toEqual(["https://docs.example.com/oauth"]);
    expect(modes).toEqual(["manual"]);
  });

  it("a redirect to a DNS name that resolves privately is blocked", async () => {
    const f: typeof fetch = async () => new Response(null, { status: 301, headers: { location: "https://internal-rebind.example.net/" } });
    const lookup = async (h: string) => (h === "internal-rebind.example.net" ? ["192.168.0.10"] : ["93.184.216.34"]);
    const r = await fetchDoc("https://docs.example.com/oauth", { fetch: f, now, dnsLookup: lookup });
    expect(r).toMatchObject({ ok: false, reason: "blocked" });
  });

  it("follows up to 5 safe hops, and fails past that", async () => {
    const chain =
      (hops: number): typeof fetch =>
      async (input) => {
        const i = Number(new URL(String(input)).searchParams.get("i") ?? 0);
        return i < hops
          ? new Response(null, { status: 302, headers: { location: `https://docs.example.com/p?i=${i + 1}` } })
          : new Response(page, { status: 200, headers: { "content-type": "text/html" } });
      };
    const ok = await fetchDoc("https://docs.example.com/p?i=0", { fetch: chain(5), now });
    expect(ok.ok && ok.doc.url).toBe("https://docs.example.com/p?i=5");
    const tooMany = await fetchDoc("https://docs.example.com/p?i=0", { fetch: chain(6), now });
    expect(tooMany.ok).toBe(false);
    if (!tooMany.ok) expect(tooMany.detail).toMatch(/more than 5 redirects/);
  });
});

describe("pipeline + probe", () => {
  it("LLM-cited internal URLs are dropped silently, with one generic line", async () => {
    const base = createMockLlm();
    const fetched: string[] = [];
    const mockFetch = createMockFetch();
    const llm: LlmAdapter = {
      research: async (i) => {
        const r = await base.research(i);
        return {
          ...r,
          citedUrls: [...r.citedUrls, "http://localhost:3000/", "https://169.254.169.254/latest/meta-data/", "https://intranet/x"],
        };
      },
      extract: base.extract,
    };
    const run = await runPipeline(
      { query: "Miro", runId: "ssrf" },
      {
        fetch: (input, init) => {
          fetched.push(String(input));
          return mockFetch(input, init);
        },
        llm,
        store: createMemoryStore(),
        now: () => new Date(),
        emit: () => {},
      },
      { probeStepMs: 1000, probeRequestMs: 300, fetchTimeoutMs: 500 },
    );
    expect(run.status).toBe("done");
    const unknowns = run.guide!.unknowns.join("\n");
    expect(unknowns).toContain("Skipped 3 non-public URLs.");
    expect(unknowns).not.toMatch(/localhost|169\.254|intranet/);
    expect(JSON.stringify(run.events)).not.toMatch(/localhost|169\.254|intranet/);
    expect(fetched.some((u) => /localhost|169\.254|intranet/.test(u))).toBe(false);
  });

  it("probes never request internal hosts, even when the user typed one", async () => {
    const fetched: string[] = [];
    const f: typeof fetch = async (input) => {
      fetched.push(String(input));
      return new Response("nope", { status: 404 });
    };
    const r = await runProbes(
      {
        slug: "localhost",
        name: "Localhost",
        website: "https://localhost",
        category: "x",
        consoleUrl: "http://10.0.0.1/admin",
        alternatives: [],
      },
      { fetch: f, now, stepMs: 500, perRequestMs: 200 },
    );
    expect(fetched).toEqual([]);
    expect(r.probes).toEqual([]);
  });

  it("probes skip an authorize endpoint that a discovery document points at an internal host", async () => {
    const fetched: string[] = [];
    const f: typeof fetch = async (input) => {
      const url = String(input);
      fetched.push(url);
      if (url === "https://evil.example.com/.well-known/openid-configuration") {
        return Response.json({ issuer: "https://evil.example.com", authorization_endpoint: "https://192.168.1.1/authorize" });
      }
      return new Response("nope", { status: 404 });
    };
    const r = await runProbes(
      { slug: "evil", name: "Evil", website: "https://evil.example.com", category: "x", alternatives: [] },
      { fetch: f, now, stepMs: 1000, perRequestMs: 300 },
    );
    expect(r.discovery?.authorizationEndpoint).toBe("https://192.168.1.1/authorize");
    expect(fetched.some((u) => u.includes("192.168.1.1"))).toBe(false);
    expect(r.probes.some((p) => p.url.includes("192.168.1.1"))).toBe(false);
  });
});
