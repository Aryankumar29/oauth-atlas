import snapshot from "@/data/composio-managed.json";
import type { Managed } from "@/lib/schema";

export const COMPOSIO_SOURCES = {
  managedAuth: "https://docs.composio.dev/toolkits/managed-auth",
  managedAuthMarkdown: "https://docs.composio.dev/toolkits/managed-auth.md",
  customVsManaged: "https://docs.composio.dev/docs/authentication/custom-app-vs-managed-app",
  whiteLabeling: "https://docs.composio.dev/docs/authentication/white-labeling-authentication",
  toolkitApi: (slug: string) => `https://backend.composio.dev/api/v3.1/toolkits/${slug}`,
} as const;

export type ComposioSnapshot = {
  checkedAt: string;
  source: string;
  managed: string[];
  byo: string[];
};

export const composioSnapshot: ComposioSnapshot = snapshot;

const managedSet = new Set(composioSnapshot.managed);
const byoSet = new Set(composioSnapshot.byo);

export function normalizeToolkitSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

// "yes" = Composio-managed OAuth available; "no" = bring your own app; "unknown" = not in the directory.
export function managedStatus(slug: string): Managed {
  const s = normalizeToolkitSlug(slug);
  if (managedSet.has(s)) return "yes";
  if (byoSet.has(s)) return "no";
  return "unknown";
}

export function isManaged(slug: string): boolean {
  return managedStatus(slug) === "yes";
}

// Parses the two toolkit tables ("Composio-managed OAuth available", "Bring your own OAuth app").
export function parseManagedAuthMarkdown(md: string): { managed: string[]; byo: string[] } {
  const managed: string[] = [];
  const byo: string[] = [];
  let bucket: string[] | null = null;

  for (const line of md.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      const h = line.toLowerCase();
      bucket = h.includes("managed") ? managed : h.includes("bring your own") ? byo : null;
      continue;
    }
    const m = bucket && line.match(/^\|.*\|\s*`([A-Za-z0-9_]+)`\s*\|\s*$/);
    if (m && bucket) bucket.push(m[1].toLowerCase());
  }
  return { managed, byo };
}
