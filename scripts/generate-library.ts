// Usage: npx tsx scripts/generate-library.ts [--only a,b] [--limit N] [--force] [--dry-run]
// Runs the live pipeline over queued seed apps and writes data/guides/<slug>.json only for guides that pass
// the SPEC §12 QA gate. It never edits data/guides/index.ts or the seed; it prints the lines to add.
// MOCK_LLM=1 only works with --dry-run. Real runs need LLM keys exported in this shell (tsx does not load .env.local).
import fs from "node:fs";
import path from "node:path";

import { indexLines, MockWriteRefused, runBatch } from "../lib/agent/batch";
import { createDeps, isMockMode, pipelineOptionsFromEnv } from "../lib/agent/deps";
import { apps } from "../lib/data";
import { createMemoryStore } from "../lib/store";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

async function main() {
  const dir = path.join(process.cwd(), "data", "guides");
  const only = arg("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
  const limit = arg("--limit") ? Number(arg("--limit")) : undefined;

  const unknown = only?.filter((s) => !apps.some((a) => a.slug === s)) ?? [];
  if (unknown.length) throw new Error(`Not in apps.seed.json: ${unknown.join(", ")}`);
  let slugs = only ? apps.filter((a) => only.includes(a.slug)) : apps.filter((a) => a.tier === "queued");
  if (limit !== undefined && Number.isFinite(limit)) slugs = slugs.slice(0, limit);

  const result = await runBatch({
    slugs: slugs.map((a) => ({ slug: a.slug, name: a.name })),
    force: has("--force"),
    dryRun: has("--dry-run"),
    mock: isMockMode(),
    exists: (slug) => fs.existsSync(path.join(dir, `${slug}.json`)),
    write: (slug, json) => fs.writeFileSync(path.join(dir, `${slug}.json`), json),
    // Memory store: batch runs must not overwrite the public demo cache (guide:{slug}) in Redis.
    makeDeps: async () => ({ ...(await createDeps(() => {})), store: createMemoryStore() }),
    pipelineOptions: pipelineOptionsFromEnv(),
    log: (l) => console.log(l),
  });

  console.log(`\nWritten: ${result.written.length} · would write (dry run): ${result.wouldWrite.length} · skipped: ${result.skipped.length}`);
  for (const s of result.skipped) console.log(`  skipped ${s.slug}: ${s.reasons.join("; ")}`);
  if (result.written.length) {
    console.log("\nAdd to data/guides/index.ts:");
    indexLines(result.written).forEach((l) => console.log(`  ${l}`));
    console.log("\nThen set tier to \"generated\" for these slugs in data/apps.seed.json, spot-check each guide, and run npm run check.");
  }
}

main().catch((e) => {
  console.error(e instanceof MockWriteRefused ? e.message : e instanceof Error ? e.message : e);
  process.exit(1);
});
