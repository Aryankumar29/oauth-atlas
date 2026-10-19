import appsSeed from "@/data/apps.seed.json";
import { rawGuides } from "@/data/guides";
import { difficulty, type DifficultyResult } from "@/lib/difficulty";
import { devToProdChip } from "@/lib/format";
import { isDifficultyUnknown } from "@/lib/guide-content";
import { appSchema, guideSchema, type App, type Guide, type Tier } from "@/lib/schema";

export const apps: App[] = appsSeed.map((app) => appSchema.parse(app));

export const guides: Guide[] = rawGuides.map((g) => guideSchema.parse(g));

export function getApp(slug: string): App | undefined {
  return apps.find((app) => app.slug === slug);
}

export function getGuide(slug: string): Guide | null {
  return guides.find((g) => g.slug === slug) ?? null;
}

export function getAllGuides(): Guide[] {
  return guides;
}

// null = unknown (partial result with no gates).
export function guideDifficulty(guide: Guide): DifficultyResult | null {
  if (isDifficultyUnknown(guide)) return null;
  return difficulty(guide.gates, { profile: guide.verdict.profile });
}

// Serializable card data for the library (client component).
export type LibraryEntry = {
  app: App;
  tier: Tier;
  guide: {
    difficulty: DifficultyResult | null;
    summary: string;
    timeChip: string;
  } | null;
};

export function toLibraryEntry(app: App, guide: Guide | null): LibraryEntry {
  return {
    app,
    tier: guide?.app.tier ?? app.tier,
    guide: guide
      ? {
          difficulty: guideDifficulty(guide),
          summary: guide.verdict.summary,
          timeChip: devToProdChip(guide),
        }
      : null,
  };
}

export function getLibraryEntries(): LibraryEntry[] {
  return apps.map((app) => toLibraryEntry(app, getGuide(app.slug)));
}
