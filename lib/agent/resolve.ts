import { apps } from "@/lib/data";
import type { App } from "@/lib/schema";

export type ResolvedApp = {
  slug: string;
  name: string;
  website: string;
  category: string;
  docsUrl?: string;
  consoleUrl?: string;
  // The seed entry, when the query matched one.
  seed?: App;
  // Other plausible matches; non-empty means the query was ambiguous.
  alternatives: { slug: string; name: string; website: string }[];
  // True when the website was guessed from a bare name.
  websiteGuessed?: boolean;
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function hostOf(input: string): string | null {
  const s = input.trim();
  if (!/[./]/.test(s) || /\s/.test(s)) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// Registrable-ish domain: last two labels ("developers.miro.com" → "miro.com").
function baseDomain(host: string): string {
  return host.split(".").slice(-2).join(".");
}

function fromSeed(app: App, alternatives: ResolvedApp["alternatives"]): ResolvedApp {
  return {
    slug: app.slug,
    name: app.name,
    website: app.website,
    category: app.category,
    docsUrl: app.docsUrl,
    consoleUrl: app.consoleUrl,
    seed: app,
    alternatives,
  };
}

const brief = (a: App) => ({ slug: a.slug, name: a.name, website: a.website });

// Deterministic resolution against the seed list; unknown apps are derived from the input.
export function resolveApp(query: string, slug?: string): ResolvedApp | { error: string } {
  const q = query.trim();
  if (slug) {
    const hit = apps.find((a) => a.slug === slug);
    if (hit) return fromSeed(hit, []);
  }
  if (!q) return { error: "Enter an app name or URL." };

  const host = hostOf(q);
  if (host) {
    const base = baseDomain(host);
    const hits = apps.filter((a) => {
      const h = hostOf(a.website);
      return h && baseDomain(h) === base;
    });
    if (hits.length) return fromSeed(hits[0], hits.slice(1).map(brief));
    const label = base.split(".")[0];
    return {
      slug: slugify(label),
      name: label.charAt(0).toUpperCase() + label.slice(1),
      website: `https://${host}`,
      category: "Uncategorized",
      alternatives: [],
    };
  }

  const qs = slugify(q);
  const lower = q.toLowerCase();
  const exact = apps.filter((a) => a.slug === qs || a.name.toLowerCase() === lower);
  const partial = apps.filter(
    (a) => !exact.includes(a) && (a.slug.includes(qs) || a.name.toLowerCase().includes(lower)),
  );
  const ranked = [...exact, ...partial];
  if (ranked.length) return fromSeed(ranked[0], ranked.slice(1, 5).map(brief));

  return {
    slug: qs || "app",
    name: q,
    website: `https://${qs.replace(/-/g, "")}.com`,
    category: "Uncategorized",
    alternatives: [],
    websiteGuessed: true,
  };
}
