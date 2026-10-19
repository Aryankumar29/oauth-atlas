// Usage: npx tsx scripts/cache-guide.ts <file.json>
// Validates a guide and stores it as guide:{slug}. Writes to Upstash only when UPSTASH_REDIS_REST_* (or KV_REST_API_*)
// are exported in this shell and MOCK_LLM is not 1; otherwise the memory store is used and nothing persists.
import fs from "node:fs";

import { cacheGuide } from "../lib/agent/cacheGuide";
import { getStore, storeKind } from "../lib/store";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npx tsx scripts/cache-guide.ts <file.json>");
    process.exit(2);
  }
  const kind = storeKind();
  if (kind === "memory") console.warn("Warning: no Upstash env (or MOCK_LLM=1); writing to the in-memory store, which does not persist.");
  const guide = await cacheGuide(JSON.parse(fs.readFileSync(file, "utf8")), await getStore());
  console.log(`Stored guide:${guide.slug} (${kind}) — v${guide.version}, lastVerified ${guide.lastVerified}, partial=${guide.partial}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
