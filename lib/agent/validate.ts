import type { ResolvedApp } from "@/lib/agent/resolve";
import type { FetchedDoc } from "@/lib/agent/types";
import { difficulty } from "@/lib/difficulty";
import type { Claim, Guide } from "@/lib/schema";

// SPEC §5 Evidence rules, applied to every generated guide before it is stored.

export type ValidationReport = {
  checkedClaims: number;
  downgraded: { where: string; value: string; from: string; reason: string }[];
  difficulty: { llm: number | null; computed: number; rationale: string[] };
  primaryEvidence: number;
};

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’‛`]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// A quote matches when every ellipsis-separated fragment (≥ 8 chars) appears in one fetched doc.
export function quoteMatches(quote: string | undefined, corpus: string[]): boolean {
  if (!quote) return false;
  const parts = normalizeForMatch(quote)
    .split(/\.\.\.|…/)
    .map((p) => p.trim().replace(/^["']|["']$/g, "").trim())
    .filter((p) => p.length > 0);
  if (!parts.length || parts.some((p) => p.length < 8)) return false;
  return corpus.some((doc) => parts.every((p) => doc.includes(p)));
}

// Extra official domains per provider (subdomains included). Keep this table small and explicit.
export const OFFICIAL_DOMAINS: Record<string, string[]> = {
  meta: ["facebook.com", "meta.com", "instagram.com"],
  facebook: ["facebook.com", "meta.com"],
  instagram: ["facebook.com", "meta.com", "instagram.com"],
  whatsapp: ["facebook.com", "meta.com", "whatsapp.com"],
  slack: ["slack.com", "slack.dev"],
  google: ["google.com", "googleapis.com"],
  gmail: ["google.com", "googleapis.com"],
  youtube: ["google.com", "googleapis.com"],
  github: ["github.com"],
  notion: ["notion.com", "notion.so"],
  microsoft: ["microsoft.com", "microsoftonline.com"],
  outlook: ["microsoft.com"],
  "one-drive": ["microsoft.com"],
  onenote: ["microsoft.com"],
  "microsoft-todo": ["microsoft.com"],
  "microsoft-teams": ["microsoft.com"],
  linkedin: ["microsoft.com"],
  bitbucket: ["atlassian.com"],
  trello: ["atlassian.com"],
  jira: ["atlassian.com"],
  confluence: ["atlassian.com"],
};

// GitHub orgs whose repos count as the provider's own (github.com/<org>/...). Default: the app slug.
export const GITHUB_ORGS: Record<string, string[]> = {
  github: ["github"],
  slack: ["slackapi"],
  microsoft: ["microsoft", "microsoftdocs", "azuread"],
  google: ["google", "googleapis"],
  notion: ["makenotion"],
};

// User-generated content, never primary even on an official domain (QA-7).
const UGC_PREFIXES = ["community", "forum", "forums", "answers", "techcommunity", "groups", "sites", "discuss"];
const UGC_HOSTS = ["storage.googleapis.com", "gist.github.com"];
const SLACK_OFFICIAL_HOSTS = ["slack.com", "api.slack.com", "docs.slack.com"];
// First path segments on github.com that are GitHub's own pages, not a user or org.
const GITHUB_RESERVED = new Set([
  "settings", "apps", "marketplace", "login", "features", "pricing", "enterprise", "about", "site",
  "security", "organizations", "developer", "partners", "customer-stories", "",
]);
// Shared hosting suffixes: each subdomain is a different owner, so only the full host is official.
const PLATFORM_SUFFIXES = ["github.io", "vercel.app", "netlify.app", "herokuapp.com", "notion.site", "pages.dev"];
const SLD = new Set(["co", "com", "net", "org", "gov", "ac", "edu"]);

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
};

export function registrable(host: string): string {
  if (PLATFORM_SUFFIXES.some((p) => host === p || host.endsWith(`.${p}`))) return host;
  const labels = host.split(".");
  const n = labels.length;
  // acme.co.uk, acme.com.au
  if (n >= 3 && SLD.has(labels[n - 2]) && labels[n - 1].length === 2) return labels.slice(-3).join(".");
  return labels.slice(-2).join(".");
}

const githubOwner = (url: string): string | null => {
  try {
    return new URL(url).pathname.split("/")[1]?.toLowerCase() ?? "";
  } catch {
    return null;
  }
};

// Official set entries are domains ("miro.com", subdomains included) or GitHub scopes ("github.com/<org>").
export function officialDomainsFor(
  app: Pick<ResolvedApp, "slug" | "website" | "docsUrl" | "consoleUrl" | "websiteGuessed">,
): string[] {
  const out = new Set<string>(OFFICIAL_DOMAINS[app.slug] ?? []);
  for (const org of GITHUB_ORGS[app.slug] ?? [app.slug]) out.add(`github.com/${org.toLowerCase()}`);
  // A guessed website (bare name → name.com) is not evidence of ownership.
  const site = app.websiteGuessed ? null : hostOf(app.website);
  if (site) out.add(registrable(site));
  for (const u of [app.docsUrl, app.consoleUrl]) {
    const h = u && hostOf(u);
    if (!h) continue;
    if (h === "github.com") {
      const owner = githubOwner(u);
      if (owner && !GITHUB_RESERVED.has(owner)) out.add(`github.com/${owner}`);
    } else {
      out.add(h);
    }
  }
  return [...out];
}

export function isUserContentUrl(url: string, domains: string[]): boolean {
  const h = hostOf(url);
  if (!h) return true;
  if (UGC_PREFIXES.includes(h.split(".")[0]) || UGC_HOSTS.includes(h) || h.endsWith("githubusercontent.com")) return true;
  if (h.endsWith(".slack.com") && !SLACK_OFFICIAL_HOSTS.includes(h)) return true;
  if (h === "github.com") {
    const owner = githubOwner(url);
    return owner === null || (!GITHUB_RESERVED.has(owner) && !domains.includes(`github.com/${owner}`));
  }
  return false;
}

export function isOfficialUrl(url: string, domains: string[]): boolean {
  const h = hostOf(url);
  if (!h || isUserContentUrl(url, domains)) return false;
  if (h === "github.com" && domains.some((d) => d.startsWith("github.com/") && d === `github.com/${githubOwner(url)}`)) return true;
  return domains.some((d) => !d.includes("/") && (h === d || h.endsWith(`.${d}`)));
}

const urlKey = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}${u.search}`;
  } catch {
    return url;
  }
};

export function validateGuide(
  guide: Guide,
  ctx: { docs: FetchedDoc[]; officialDomains: string[]; llmDifficulty?: unknown },
): { guide: Guide; report: ValidationReport } {
  const g: Guide = structuredClone(guide);
  const corpus = ctx.docs.map((d) => normalizeForMatch(d.text));
  const byUrl = new Map(ctx.docs.map((d, i) => [urlKey(d.url), corpus[i]]));

  // primary: official host AND the quote is in the doc fetched from that same URL.
  // secondary: the quote is really in that URL's doc, but the host is not official.
  const grade = (url: string, quote: string | undefined): "primary" | "secondary" | null => {
    const own = byUrl.get(urlKey(url));
    if (!own || !quoteMatches(quote, [own])) return null;
    return isOfficialUrl(url, ctx.officialDomains) ? "primary" : "secondary";
  };
  const reasonFor = (url: string | undefined, quote: string | undefined) =>
    !url || !byUrl.has(urlKey(url))
      ? "source URL was not fetched this run"
      : quoteMatches(quote, [byUrl.get(urlKey(url))!])
        ? "source is not an official provider domain"
        : quoteMatches(quote, corpus)
          ? "quote only matches a different fetched doc"
          : "quote not found in fetched docs";
  const probeUrls = new Set(g.probes.map((p) => p.url));
  const report: ValidationReport = {
    checkedClaims: 0,
    downgraded: [],
    difficulty: { llm: typeof ctx.llmDifficulty === "number" ? ctx.llmDifficulty : null, computed: 0, rationale: [] },
    primaryEvidence: 0,
  };

  const checkClaim = (c: Claim | undefined, where: string) => {
    if (!c) return;
    report.checkedClaims += 1;
    if (c.status === "primary") {
      const grades = c.sources.map((s) => grade(s.url, s.quote));
      if (!grades.includes("primary")) {
        const to = grades.includes("secondary") ? "secondary" : "inferred";
        const reason = reasonFor(c.sources[0]?.url, c.sources[0]?.quote);
        report.downgraded.push({ where, value: c.value, from: "primary", reason });
        c.status = to;
        c.note = [c.note, `Downgraded to ${to}: ${reason}.`].filter(Boolean).join(" ");
      }
    } else if (c.status === "tested" && !(c.testKind === "probe" && c.sources.some((s) => probeUrls.has(s.url)))) {
      report.downgraded.push({ where, value: c.value, from: "tested", reason: "no matching probe record" });
      c.status = "inferred";
      c.testKind = undefined;
      c.note = [c.note, "Downgraded: no probe record backs this claim."].filter(Boolean).join(" ");
    }
  };

  g.milestones.forEach((m) => m.limitsUntilNext.forEach((c, i) => checkClaim(c, `milestones.${m.id}.limitsUntilNext[${i}]`)));
  g.gates.forEach((gate, i) => {
    checkClaim(gate.cost, `gates[${i}].cost`);
    checkClaim(gate.duration, `gates[${i}].duration`);
    checkClaim(gate.recurring, `gates[${i}].recurring`);
  });
  g.oauthConfig.redirectUris.forEach((c, i) => checkClaim(c, `oauthConfig.redirectUris[${i}]`));
  checkClaim(g.oauthConfig.pkce, "oauthConfig.pkce");
  checkClaim(g.oauthConfig.tokenLifetime, "oauthConfig.tokenLifetime");
  checkClaim(g.oauthConfig.refresh, "oauthConfig.refresh");
  g.oauthConfig.rateLimits.forEach((c, i) => checkClaim(c, `oauthConfig.rateLimits[${i}]`));

  for (const e of g.evidence) {
    report.checkedClaims += 1;
    if (e.status === "primary" && grade(e.sourceUrl, e.quote) !== "primary") {
      const to = grade(e.sourceUrl, e.quote) === "secondary" ? "secondary" : "inferred";
      report.downgraded.push({ where: `evidence.${e.id}`, value: e.claim, from: "primary", reason: reasonFor(e.sourceUrl, e.quote) });
      e.status = to;
      e.confidence = "low";
    } else if (e.status === "tested" && !probeUrls.has(e.sourceUrl)) {
      report.downgraded.push({ where: `evidence.${e.id}`, value: e.claim, from: "tested", reason: "no matching probe record" });
      e.status = "inferred";
      e.confidence = "low";
    }
    if (e.status === "primary") report.primaryEvidence += 1;
  }

  // Difficulty is computed, never generated (SPEC §5.2).
  const d = difficulty(g.gates, { profile: g.verdict.profile });
  g.verdict.difficulty = d.score;
  report.difficulty.computed = d.score;
  report.difficulty.rationale = d.rationale;

  // Generated guides never claim high confidence.
  g.confidence = !g.partial && report.primaryEvidence >= 3 ? "medium" : "low";

  return { guide: g, report };
}
