import { describe, expect, it } from "vitest";

import { BROWSER_UA, fetchDoc, htmlToText, MINIMAL_BROWSER_UA } from "@/lib/agent/fetchDoc";
import { createMockFetch } from "@/lib/agent/llm/mock";

const now = () => new Date("2026-10-20T00:00:00Z");

describe("fetchDoc", () => {
  it("falls back to a browser User-Agent on a 403", async () => {
    const seen: string[] = [];
    const base = createMockFetch();
    const spy: typeof fetch = (input, init) => {
      seen.push((init?.headers as Record<string, string>)["User-Agent"]);
      return base(input, init);
    };
    const r = await fetchDoc("https://developer.calendly.com/how-to-authenticate-with-oauth", { fetch: spy, now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.via).toBe("browser-ua");
    expect(r.doc.text).toContain("register an OAuth application");
    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(BROWSER_UA);
  });

  it("Meta: retries with a minimal Mozilla/5.0 UA after the full Chrome UA gets a 400", async () => {
    const seen: string[] = [];
    const base = createMockFetch();
    const spy: typeof fetch = (input, init) => {
      seen.push((init?.headers as Record<string, string>)["User-Agent"]);
      return base(input, init);
    };
    const r = await fetchDoc("https://developers.facebook.com/docs/facebook-login/overview", { fetch: spy, now });
    expect(r.ok && r.via).toBe("browser-ua");
    expect(seen.slice(1)).toEqual([BROWSER_UA, MINIMAL_BROWSER_UA]);
    if (r.ok) expect(r.doc.text).toContain("minimal User-Agent");
  });

  it("does not try the minimal UA after a 404", async () => {
    const seen: string[] = [];
    const f: typeof fetch = async (_i, init) => {
      seen.push((init?.headers as Record<string, string>)["User-Agent"]);
      return new Response("gone", { status: 404 });
    };
    await fetchDoc("https://gone.example/", { fetch: f, now });
    expect(seen).not.toContain(MINIMAL_BROWSER_UA);
  });

  it("marks a source unreachable when every step fails", async () => {
    const r = await fetchDoc("https://nowhere.example/docs", { fetch: createMockFetch(), now });
    expect(r).toMatchObject({ ok: false, reason: "unreachable" });
  });

  it("tries the reader service before giving up when enabled", async () => {
    const calls: string[] = [];
    const f: typeof fetch = async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith("https://r.jina.ai/")) return new Response("Rendered text. ".repeat(30), { status: 200 });
      return new Response("blocked", { status: 403 });
    };
    const r = await fetchDoc("https://xero.example/pricing", { fetch: f, now, reader: { enabled: true } });
    expect(r.ok && r.via).toBe("reader");
    expect(calls.at(-1)).toBe("https://r.jina.ai/https://xero.example/pricing");
  });

  it("detects a login wall", async () => {
    const r = await fetchDoc("https://docs.example-loginwall.test/oauth", { fetch: createMockFetch(), now });
    expect(r).toMatchObject({ ok: false, reason: "login-wall" });
  });

  it("times out slow requests", async () => {
    const hang: typeof fetch = (_input, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    const r = await fetchDoc("https://slow.example/", { fetch: hang, now, timeoutMs: 20 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("timeout");
  });

  it("strips scripts and tags", () => {
    const { title, text } = htmlToText("<title>T &amp; C</title><script>x()</script><p>Hello</p><p>World</p>");
    expect(title).toBe("T & C");
    expect(text).toBe("T & C Hello\nWorld");
  });
});
