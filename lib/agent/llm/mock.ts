import type { LlmAdapter } from "@/lib/agent/types";
import { BROWSER_UA } from "@/lib/agent/fetchDoc";
import recorded from "@/tests/fixtures/http/recorded.json";
import miro from "@/tests/fixtures/llm/miro.json";

// MOCK_LLM=1 (SPEC §9.13): fixture-backed LLM and HTTP. Static imports so it bundles on Vercel.

type LlmFixture = { match: string[]; research: { citedUrls: string[] }; extract: Record<string, unknown> };
const LLM_FIXTURES: LlmFixture[] = [miro as LlmFixture];

function fixtureFor(query: string): LlmFixture | undefined {
  const q = query.toLowerCase();
  return LLM_FIXTURES.find((f) => f.match.some((m) => q.includes(m)));
}

function genericDraft(query: string, docUrls: string[]): Record<string, unknown> {
  const m = (id: string, definition: string) => ({
    id,
    definition,
    handsOnHours: { min: 0, max: 0 },
    wait: { minDays: 0, maxDays: null },
    basis: "unknown",
    limitsUntilNext: [],
  });
  return {
    confidence: "low",
    verdict: {
      approvalModel: "unknown",
      summary: `[MOCK] Synthetic guide for ${query}. Mock mode does not research real requirements.`,
      canTestBeforeApproval: "unknown",
    },
    milestones: [
      m("dev-ready", "OAuth works for your own account in development."),
      m("pilot-ready", "A small set of external users can connect."),
      m("production-ready", "Any user can connect without caps or warnings."),
    ],
    gates: [],
    unknowns: [`[MOCK] Mock mode fetched ${docUrls.length} docs but did not analyze them.`],
  };
}

export function createMockLlm(): LlmAdapter {
  return {
    async research({ query, hints }) {
      const f = fixtureFor(query);
      return { docs: [], citedUrls: f ? f.research.citedUrls : (hints ?? []) };
    },
    async extract(input) {
      const f = fixtureFor(input.query);
      return structuredClone(f ? f.extract : genericDraft(input.query, input.docs.map((d) => d.url)));
    },
  };
}

type HttpEntry = {
  url: string;
  status: number;
  contentType?: string;
  headers?: Record<string, string>;
  body: string;
  finalUrl?: string;
  browserUA?: { status: number; contentType?: string; body: string };
};

const HTTP: HttpEntry[] = (recorded as { entries: HttpEntry[] }).entries;

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const h = init?.headers;
  if (!h) return undefined;
  if (h instanceof Headers) return h.get(name) ?? undefined;
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  const rec = h as Record<string, string>;
  const key = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? rec[key] : undefined;
}

function respond(body: string, status: number, headers: Record<string, string>, url: string): Response {
  const nullBody = status === 204 || (status >= 300 && status < 400);
  const res = new Response(nullBody ? null : body, { status, headers });
  Object.defineProperty(res, "url", { value: url });
  return res;
}

// Serves recorded fixtures; anything unrecorded is a 404 so mock runs never touch the network.
export function createMockFetch(entries: HttpEntry[] = HTTP): typeof globalThis.fetch {
  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const bare = url.split("?")[0].replace(/\/$/, "");
    const e = entries.find((x) => x.url === url) ?? entries.find((x) => x.url.replace(/\/$/, "") === bare);
    if (!e) return respond("Not recorded (MOCK_LLM)", 404, { "content-type": "text/plain" }, url);
    const ua = headerOf(init, "user-agent");
    const v = e.browserUA && ua === BROWSER_UA ? e.browserUA : e;
    const headers: Record<string, string> = { "content-type": v.contentType ?? "text/html", ...(e.headers ?? {}) };
    if (init?.redirect !== "manual" && e.status >= 300 && e.status < 400 && headers.location) {
      const next = await mockFetch(new URL(headers.location, url).toString(), init);
      return next;
    }
    return respond(v.body, v.status, headers, e.finalUrl ?? url);
  };
  return mockFetch as typeof globalThis.fetch;
}
