// Fetches Composio's managed-auth directory and writes data/composio-managed.json.
// Usage: npm run snapshot:composio
import fs from "node:fs";
import path from "node:path";

import { COMPOSIO_SOURCES, parseManagedAuthMarkdown } from "../lib/composio";

async function main() {
  const res = await fetch(COMPOSIO_SOURCES.managedAuthMarkdown);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const { managed, byo } = parseManagedAuthMarkdown(await res.text());
  if (managed.length === 0 || byo.length === 0) {
    throw new Error("Parsed an empty list; the page format probably changed");
  }

  const snapshot = {
    // Project runs on IST; stamp the local date, not UTC.
    checkedAt: new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
    source: COMPOSIO_SOURCES.managedAuth,
    managed,
    byo,
  };
  const out = path.join(process.cwd(), "data", "composio-managed.json");
  fs.writeFileSync(out, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`Wrote ${out}: ${managed.length} managed / ${byo.length} byo`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
