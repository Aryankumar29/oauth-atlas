import { describe, expect, it } from "vitest";

import {
  applyAttemptFacts,
  ATTEMPT_REGISTRATION_BODY,
  authServerMetadataUrls,
  interpretRegistration,
  interpretToken,
  mcpHosts,
  runAttempts,
  type AttemptResult,
} from "@/lib/agent/attempt";
import { fallbackGuide } from "@/lib/agent/extract";
import { createMockFetch } from "@/lib/agent/llm/mock";
import { resolveApp, type ResolvedApp } from "@/lib/agent/resolve";
import { officialDomainsFor, validateGuide } from "@/lib/agent/validate";

// Bodies recorded from the live providers on 2026-10-28 (fake client, fake code, unparseable registration body).
const token = {
  google: [401, '{\n  "error": "invalid_client",\n  "error_description": "The OAuth client was not found."\n}'],
  slack: [200, '{"ok":false,"error":"invalid_code"}'],
  calendly: [400, '{"error":"invalid_request","error_description":"Missing required parameter: code_verifier."}'],
  asana: [400, '{"error":"invalid_grant","error_description":"The `code` provided was invalid."}'],
  atlassian: [400, '{"error":"invalid_request","error_description":"authorization_code is invalid"}'],
  miro: [401, '{\n  "status" : 401,\n  "code" : "notFound",\n  "message" : "Client not found",\n  "type" : "error"\n}'],
  github: [404, '{"error":"Not Found"}'],
} as const;

const registration = {
  notion: [400, '{"error":"invalid_client_metadata","error_description":"Invalid JSON body"}'],
  linear: [400, '{"error":"invalid_request","error_description":"Invalid JSON payload"}'],
  asana: [400, "Invalid request body format"],
  calendly: [400, "<!DOCTYPE html><html><head><title>Calendly</title></head><body>Bad Request</body></html>"],
  miro: [500, "Internal Server Error"],
} as const;

// Recorded 2026-10-28: Notion's remote MCP server.
const notionMcp: Record<string, [number, string]> = {
  "https://mcp.notion.com/.well-known/oauth-protected-resource": [
    200,
    '{"resource":"https://mcp.notion.com","authorization_servers":["https://mcp.notion.com"]}',
  ],
  "https://mcp.notion.com/.well-known/oauth-authorization-server": [
    200,
    '{"issuer":"https://mcp.notion.com","authorization_endpoint":"https://mcp.notion.com/authorize","token_endpoint":"https://mcp.notion.com/token","registration_endpoint":"https://mcp.notion.com/register","code_challenge_methods_supported":["S256"]}',
  ],
  "https://mcp.notion.com/register": [...registration.notion],
  "https://api.notion.com/v1/oauth/token": [401, '{"error":"invalid_client","request_id":"9e37d9dd"}'],
};
const notionFetch: typeof fetch = async (input) => {
  const hit = notionMcp[String(input)];
  return hit ? new Response(hit[1], { status: hit[0], headers: { "content-type": "application/json" } }) : new Response("nope", { status: 404 });
};

const now = () => new Date("2026-10-28T00:00:00Z");
const fast = { now, stepMs: 2000, perRequestMs: 500 };

function app(name: string): ResolvedApp {
  const r = resolveApp(name);
  if ("error" in r) throw new Error(r.error);
  return r;
}

describe("interpretToken (recorded responses)", () => {
  it("Calendly: asks for code_verifier before checking the client, so PKCE is required", () => {
    const r = interpretToken(...token.calendly);
    expect(r.kind).toBe("pkce-required");
    expect(r.observed).toContain("PKCE is required");
  });

  it("Slack: errors come back with HTTP 200", () => {
    expect(interpretToken(...token.slack).kind).toBe("error-in-200");
  });

  it("Google and Miro reject the unknown client first", () => {
    expect(interpretToken(...token.google).kind).toBe("invalid-client");
    expect(interpretToken(...token.miro).kind).toBe("invalid-client");
  });

  it("Asana and Atlassian check the code before the client", () => {
    expect(interpretToken(...token.asana).kind).toBe("invalid-grant");
    expect(interpretToken(...token.atlassian).kind).toBe("invalid-grant");
  });

  it("GitHub's 404 is recorded as observed, not as a verdict", () => {
    expect(interpretToken(...token.github).kind).toBe("not-found");
  });
});

describe("interpretRegistration (recorded responses)", () => {
  it("a 400 for the unparseable body means registration looks open", () => {
    expect(interpretRegistration(...registration.notion).kind).toBe("open");
    expect(interpretRegistration(...registration.linear).kind).toBe("open");
    expect(interpretRegistration(...registration.asana).kind).toBe("open");
    expect(interpretRegistration(...registration.notion).observed).toContain("Nothing was registered");
  });

  it("a generic HTML 400 page is inconclusive, not open", () => {
    expect(interpretRegistration(...registration.calendly).kind).toBe("inconclusive");
  });

  it("401/403 means protected, 404/405 unavailable, anything else inconclusive", () => {
    expect(interpretRegistration(401, '{"error":"invalid_token"}').kind).toBe("protected");
    expect(interpretRegistration(405, "").kind).toBe("unavailable");
    expect(interpretRegistration(...registration.miro).kind).toBe("inconclusive");
  });
});

describe("helpers", () => {
  it("builds one MCP host per official registrable domain and skips GitHub scopes", () => {
    expect(mcpHosts(["notion.com", "notion.so", "github.com/makenotion"])).toEqual(["https://mcp.notion.com", "https://mcp.notion.so"]);
  });

  it("inserts the issuer path after the well-known suffix (RFC 8414)", () => {
    expect(authServerMetadataUrls("https://calendly.com/")).toEqual([
      "https://calendly.com/.well-known/oauth-authorization-server",
      "https://calendly.com/.well-known/openid-configuration",
    ]);
    expect(authServerMetadataUrls("https://auth.example.com/tenant")[0]).toBe(
      "https://auth.example.com/.well-known/oauth-authorization-server/tenant",
    );
  });
});

describe("runAttempts", () => {
  it("Calendly (recorded): PKCE required, MCP server found on another host, registration inconclusive", async () => {
    const calendly = app("Calendly");
    const r = await runAttempts(calendly, null, { ...fast, fetch: createMockFetch(), officialDomains: officialDomainsFor(calendly) });

    expect(r.token).toMatchObject({ url: "https://auth.calendly.com/oauth/token", kind: "pkce-required" });
    expect(r.mcp).toMatchObject({ resource: "https://mcp.calendly.com", registrationEndpoint: "https://calendly.com/oauth/register" });
    expect(r.registrations).toEqual([expect.objectContaining({ url: "https://calendly.com/oauth/register", kind: "inconclusive", for: "mcp" })]);
    expect(r.attempts.length).toBeGreaterThanOrEqual(4);
    expect(r.attempts.every((a) => a.kind === "attempt" && a.at === "2026-10-28T00:00:00.000Z")).toBe(true);
  });

  it("never sends a registration body that could register a client", async () => {
    const sent: { url: string; method?: string; body?: unknown }[] = [];
    const mock = createMockFetch();
    const f: typeof fetch = async (input, init) => {
      sent.push({ url: String(input), method: init?.method, body: init?.body });
      return mock(input, init);
    };
    const calendly = app("Calendly");
    await runAttempts(calendly, null, { ...fast, fetch: f, officialDomains: officialDomainsFor(calendly) });

    const reg = sent.filter((s) => s.url.endsWith("/register"));
    expect(reg).toHaveLength(1);
    expect(reg[0].body).toBe(ATTEMPT_REGISTRATION_BODY);
    expect(() => JSON.parse(String(reg[0].body))).toThrow();
    // Only the code exchange and the registration attempt write; everything else is a GET.
    expect(sent.filter((s) => s.method === "POST").map((s) => s.url).sort()).toEqual([
      "https://auth.calendly.com/oauth/token",
      "https://calendly.com/oauth/register",
    ]);
  });

  it("does not contact a registration endpoint that points at a private address", async () => {
    const urls: string[] = [];
    const f: typeof fetch = async (input) => {
      urls.push(String(input));
      return new Response("nope", { status: 404 });
    };
    const r = await runAttempts(
      { slug: "x", name: "X", website: "https://x.example", category: "x", alternatives: [] },
      {
        probes: [],
        summary: "",
        discovery: { codeChallengeMethods: [], grantTypes: [], scopes: [], registrationEndpoint: "https://127.0.0.1/register", url: "https://x.example/.well-known/openid-configuration", at: "t" },
      },
      { ...fast, fetch: f, officialDomains: ["x.example"] },
    );
    expect(urls).not.toContain("https://127.0.0.1/register");
    expect(r.attempts.some((a) => a.url.includes("127.0.0.1"))).toBe(false);
    expect(r.registrations).toEqual([]);
  });

  it("finds nothing for an app with no token hint and no MCP server", async () => {
    const r = await runAttempts(
      { slug: "x", name: "X", website: "https://x.example", category: "x", alternatives: [] },
      null,
      { ...fast, fetch: async () => new Response("nope", { status: 404 }), officialDomains: ["x.example"] },
    );
    expect(r.attempts).toEqual([]);
    expect(r.summary).toBe("no token endpoint to try; no remote MCP server found");
  });
});

describe("applyAttemptFacts", () => {
  const calendly = app("Calendly");
  const base = (resolved = calendly) =>
    fallbackGuide({ resolved, composio: { managed: "yes", checkedAt: "2026-10-28" }, probes: [], runId: "t", now: now(), unknowns: [] }, "test");

  async function applied(resolved: ResolvedApp, f: typeof fetch) {
    const r = await runAttempts(resolved, null, { ...fast, fetch: f, officialDomains: officialDomainsFor(resolved) });
    const g = base(resolved);
    g.probes = r.attempts;
    return validateGuide(applyAttemptFacts(g, r), { docs: [], officialDomains: officialDomainsFor(resolved) });
  }

  it("Calendly: writes the PKCE requirement as a tested fact that survives validation", async () => {
    const { guide, report } = await applied(calendly, createMockFetch());
    expect(guide.oauthConfig.pkce).toMatchObject({ status: "tested", testKind: "attempt" });
    expect(guide.oauthConfig.pkce?.value).toMatch(/^PKCE required/);
    expect(guide.evidence.filter((e) => e.id.startsWith("attempt-")).map((e) => [e.id, e.status])).toEqual([
      ["attempt-token-pkce", "tested"],
      ["attempt-mcp", "tested"],
    ]);
    expect(guide.unknowns.at(-1)).toContain("inconclusive");
    expect(report.downgraded).toEqual([]);
  });

  it("Notion (recorded): open MCP registration becomes tested evidence and the first agent task", async () => {
    const { guide, report } = await applied(app("Notion"), notionFetch);
    expect(guide.evidence.find((e) => e.id === "attempt-dcr-mcp")).toMatchObject({ status: "tested", confidence: "medium" });
    expect(guide.agentTasks[0]).toContain("Dynamic Client Registration (https://mcp.notion.com/register)");
    expect(report.downgraded).toEqual([]);
  });

  it("an endpoint confirmed end to end (Linear) is high confidence and cites the record", () => {
    const result: AttemptResult = {
      attempts: [],
      summary: "",
      registrations: [{ url: "https://mcp.linear.app/register", kind: "open", for: "mcp", at: "2026-10-28T00:00:00.000Z" }],
    };
    const e = applyAttemptFacts(base(), result).evidence.find((x) => x.id === "attempt-dcr-mcp");
    expect(e).toMatchObject({ confidence: "high" });
    expect(e?.claim).toContain("docs/evidence/linear-mcp-setup.json");
  });

  it("downgrades an attempt claim that has no attempt record behind it", () => {
    const result: AttemptResult = {
      attempts: [],
      registrations: [],
      summary: "",
      token: { url: "https://auth.calendly.com/oauth/token", kind: "pkce-required", at: "2026-10-28T00:00:00.000Z" },
    };
    const { guide } = validateGuide(applyAttemptFacts(base(), result), { docs: [], officialDomains: [] });
    expect(guide.oauthConfig.pkce?.status).toBe("inferred");
  });

  it("records an inconclusive registration as an unknown, not a fact", () => {
    const result: AttemptResult = {
      attempts: [],
      summary: "",
      registrations: [{ url: "https://mcp.miro.com/register", kind: "inconclusive", for: "mcp", at: "t" }],
    };
    const g = applyAttemptFacts(base(), result);
    expect(g.unknowns.at(-1)).toContain("inconclusive");
    expect(g.evidence.some((e) => e.id.startsWith("attempt-dcr"))).toBe(false);
  });
});
