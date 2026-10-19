import { describe, expect, it } from "vitest";

import {
  authorizeProbeUrl,
  decodeAuthError,
  interpretAuthorize,
  parseDiscovery,
  pathDiscoveryUrls,
  runProbes,
} from "@/lib/agent/probe";
import recorded from "@/tests/fixtures/http/probes.json";

const a = recorded.authorize;

describe("interpretAuthorize (recorded responses)", () => {
  it("Google: redirects with authError = invalid_client", () => {
    const r = interpretAuthorize(a.google.status, a.google.location, a.google.body);
    expect(r.kind).toBe("invalid-client-redirect");
    expect(r.observed).toMatch(/invalid_client/);
  });

  it("LinkedIn: renders an invalid client_id page", () => {
    const r = interpretAuthorize(a.linkedin.status, a.linkedin.location, a.linkedin.body);
    expect(r.kind).toBe("invalid-client-page");
    expect(r.observed).toContain('invalid "oauth-atlas-probe-fake"');
  });

  it("GitHub: redirects to login before validating the client", () => {
    const r = interpretAuthorize(a.github.status, a.github.location, a.github.body);
    expect(r.kind).toBe("login-redirect");
  });

  it("Notion: redirects to its install page (recorded as observed, not as an error)", () => {
    const r = interpretAuthorize(a.notion.status, a.notion.location, a.notion.body);
    expect(r.kind).toBe("other");
    expect(r.observed).toContain("app.notion.com/install-integration");
  });

  it("decodes Google's base64 authError", () => {
    const authError = new URL(a.google.location!).searchParams.get("authError")!;
    expect(decodeAuthError(authError)).toMatch(/^invalid_client/);
  });
});

describe("parseDiscovery", () => {
  it("reads endpoints, PKCE methods and grant types", () => {
    const d = parseDiscovery(recorded.discovery.google.json);
    expect(d?.authorizationEndpoint).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(d?.codeChallengeMethods).toContain("S256");
    expect(d?.grantTypes).toContain("authorization_code");
  });

  it("rejects non-discovery JSON", () => {
    expect(parseDiscovery({ hello: "world" })).toBeNull();
    expect(parseDiscovery(null)).toBeNull();
  });
});

describe("runProbes", () => {
  const now = () => new Date("2026-10-20T00:00:00Z");

  it("uses the discovery document's authorize endpoint and tags every probe with a timestamp", async () => {
    const f: typeof fetch = async (input) => {
      const url = String(input);
      if (url === recorded.discovery.google.url) return Response.json(recorded.discovery.google.json);
      if (url.startsWith("https://accounts.google.com/o/oauth2/v2/auth")) {
        return new Response(null, { status: 302, headers: { location: a.google.location! } });
      }
      return new Response("nope", { status: 404 });
    };
    const r = await runProbes(
      { slug: "google", name: "Google", website: "https://workspace.google.com", category: "x", alternatives: [] },
      { fetch: f, now, stepMs: 2000, perRequestMs: 500 },
    );
    expect(r.discovery?.codeChallengeMethods).toContain("S256");
    expect(r.authorize?.kind).toBe("invalid-client-redirect");
    expect(r.authorize?.url).toContain("scope=openid");
    expect(r.probes.every((p) => p.at === "2026-10-20T00:00:00.000Z")).toBe(true);
  });

  it("GitHub: finds RFC 8414 path-inserted discovery and does not add an OIDC scope", async () => {
    const gh = recorded.discovery.github;
    const f: typeof fetch = async (input) => {
      const url = String(input);
      if (url === gh.url) return Response.json(gh.json);
      if (url.startsWith("https://github.com/login/oauth/authorize")) {
        return new Response(null, { status: 302, headers: { location: a.github.location! } });
      }
      return new Response("nope", { status: 404 });
    };
    const r = await runProbes(
      { slug: "github", name: "GitHub", website: "https://github.com", category: "x", alternatives: [] },
      { fetch: f, now, stepMs: 2000, perRequestMs: 500 },
    );
    expect(r.discovery?.url).toBe(gh.url);
    expect(r.discovery?.codeChallengeMethods).toEqual(["S256"]);
    expect(r.discovery?.grantTypes).toContain("urn:ietf:params:oauth:grant-type:device_code");
    expect(r.authorize?.kind).toBe("login-redirect");
    expect(r.authorize?.url).not.toContain("scope=openid");
  });

  it("builds RFC 8414 path variants from an authorize URL", () => {
    expect(pathDiscoveryUrls("https://github.com/login/oauth/authorize")).toEqual([
      "https://github.com/.well-known/oauth-authorization-server/login/oauth",
      "https://github.com/.well-known/openid-configuration/login/oauth",
      "https://github.com/login/oauth/.well-known/openid-configuration",
      "https://github.com/.well-known/oauth-authorization-server/login",
      "https://github.com/.well-known/openid-configuration/login",
      "https://github.com/login/.well-known/openid-configuration",
    ]);
    expect(pathDiscoveryUrls("https://slack.com/authorize")).toEqual([]);
  });

  it("treats a miss as unknown, never unsupported", async () => {
    const f: typeof fetch = async () => new Response("nope", { status: 404 });
    const r = await runProbes(
      { slug: "nope", name: "Nope", website: "https://nope.example", category: "x", alternatives: [] },
      { fetch: f, now, stepMs: 2000, perRequestMs: 500 },
    );
    expect(r.discovery).toBeUndefined();
    expect(r.summary).toContain("unknown");
    expect(r.probes.map((p) => p.observed).join(" ")).not.toMatch(/unsupported(?!\))/);
  });

  it("caps the whole step even when requests hang", async () => {
    const hang: typeof fetch = (_i, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    const t0 = Date.now();
    await runProbes(
      { slug: "github", name: "GitHub", website: "https://github.com", category: "x", consoleUrl: "https://github.com/settings/developers", alternatives: [] },
      { fetch: hang, now, stepMs: 300, perRequestMs: 200 },
    );
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it("builds the dummy authorize URL", () => {
    const u = new URL(authorizeProbeUrl("https://example.com/authorize"));
    expect(u.searchParams.get("client_id")).toBe("oauth-atlas-probe-fake");
    expect(u.searchParams.get("redirect_uri")).toBe("https://example.com/cb");
  });
});
