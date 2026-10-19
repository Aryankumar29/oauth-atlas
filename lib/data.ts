import fs from "node:fs";
import path from "node:path";

import appsSeed from "@/data/apps.seed.json";
import { appSchema, guideSchema, type App, type Guide } from "@/lib/schema";

const guidesDir = path.join(process.cwd(), "data", "guides");

export const apps: App[] = appsSeed.map((app) => appSchema.parse(app));

export function getApp(slug: string): App | undefined {
  return apps.find((app) => app.slug === slug);
}

export function getGuide(slug: string): Guide | null {
  const file = path.join(guidesDir, `${slug}.json`);

  if (!fs.existsSync(file)) {
    return null;
  }

  try {
    return guideSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
  } catch (error) {
    console.error(`Invalid guide: ${file}`, error);
    return null;
  }
}

export function getAllGuides(): Guide[] {
  if (!fs.existsSync(guidesDir)) {
    return [];
  }

  return fs
    .readdirSync(guidesDir)
    .filter((file) => file.endsWith(".json") && !file.startsWith("_"))
    .map((file) => getGuide(file.replace(/\.json$/, "")))
    .filter((guide): guide is Guide => guide !== null);
}
