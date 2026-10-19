// Validates data/apps.seed.json and every data/guides/*.json. Exits 1 on any error.
import fs from "node:fs";
import path from "node:path";

import { difficulty } from "../lib/difficulty";
import { appSchema, guideSchema } from "../lib/schema";

const root = process.cwd();
const errors: string[] = [];

const seed: unknown[] = JSON.parse(fs.readFileSync(path.join(root, "data", "apps.seed.json"), "utf8"));
const slugs = new Set<string>();
seed.forEach((a, i) => {
  const r = appSchema.safeParse(a);
  if (!r.success) errors.push(`apps.seed.json[${i}]: ${r.error.message}`);
  else if (slugs.has(r.data.slug)) errors.push(`apps.seed.json: duplicate slug ${r.data.slug}`);
  else slugs.add(r.data.slug);
});

const dir = path.join(root, "data", "guides");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
const index = fs.readFileSync(path.join(dir, "index.ts"), "utf8");

for (const f of files) {
  const r = guideSchema.safeParse(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  if (!r.success) {
    errors.push(`${f}: ${r.error.message}`);
    continue;
  }
  const g = r.data;
  if (`${g.slug}.json` !== f) errors.push(`${f}: slug "${g.slug}" does not match filename`);
  if (!slugs.has(g.slug)) errors.push(`${f}: slug not in apps.seed.json`);
  if (!index.includes(`./${f}`)) errors.push(`${f}: not imported in data/guides/index.ts`);
  const d = difficulty(g.gates, { profile: g.verdict.profile });
  if (d.score !== g.verdict.difficulty) {
    errors.push(`${f}: verdict.difficulty ${g.verdict.difficulty} != computed ${d.score}`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${slugs.size} apps, ${files.length} guides`);
