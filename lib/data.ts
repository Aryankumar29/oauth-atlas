import appsSeed from "@/data/apps.seed.json";
import { rawGuides } from "@/data/guides";
import { appSchema, guideSchema, type App, type Guide } from "@/lib/schema";

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
