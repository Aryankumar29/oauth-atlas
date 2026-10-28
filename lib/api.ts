import { resolveApp } from "@/lib/agent/resolve";
import type { Store } from "@/lib/agent/types";
import { apps, getGuide, guideDifficulty } from "@/lib/data";
import type { Guide } from "@/lib/schema";

// Public read-only API for agents (GET /api/guides, GET /api/guides/{app}). Curated guides come from the bundled
// library; anything else is the latest complete-or-partial guide generated live and saved in the store.

export const API_HEADERS = { "Access-Control-Allow-Origin": "*" };

// Links in API responses point at this deployment: NEXT_PUBLIC_SITE_URL, else Vercel's production domain.
export function siteUrl(): string {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.NEXT_PUBLIC_SITE_URL || (vercel ? `https://${vercel}` : "https://oauth-atlas.vercel.app")).replace(/\/$/, "");
}

export function listApps() {
  const base = siteUrl();
  return apps.map((app) => {
    const guide = getGuide(app.slug);
    const d = guide ? guideDifficulty(guide) : null;
    return {
      slug: app.slug,
      name: app.name,
      website: app.website,
      category: app.category,
      approvalModel: app.approvalModel,
      composioManaged: app.composio.managed,
      tier: guide?.app.tier ?? app.tier,
      guide: guide
        ? { difficulty: d?.score ?? null, label: d?.label ?? null, summary: guide.verdict.summary, url: `${base}/apps/${app.slug}` }
        : null,
      api: `${base}/api/guides/${app.slug}`,
    };
  });
}

export type GuideLookup =
  | { found: true; source: "curated" | "generated"; guide: Guide }
  | { found: false; slug: string; generateUrl: string };

// Accepts a slug, a name ("Google Calendar") or a URL ("calendly.com"), like the generate form.
export async function lookupGuide(query: string, store: Pick<Store, "getGuide">): Promise<GuideLookup> {
  const resolved = resolveApp(decodeURIComponent(query));
  const slug = "error" in resolved ? query.toLowerCase() : resolved.slug;
  const curated = getGuide(slug);
  if (curated) return { found: true, source: "curated", guide: curated };
  const generated = await store.getGuide(slug).catch(() => null);
  if (generated) return { found: true, source: "generated", guide: generated };
  return { found: false, slug, generateUrl: `${siteUrl()}/generate?app=${encodeURIComponent(query)}` };
}

export function guidePayload(source: "curated" | "generated", guide: Guide) {
  const d = guideDifficulty(guide);
  return {
    source,
    url: source === "curated" ? `${siteUrl()}/apps/${guide.slug}` : guide.runId ? `${siteUrl()}/generate/${guide.runId}` : null,
    difficulty: d ? { score: d.score, label: d.label, rationale: d.rationale } : null,
    guide,
  };
}
