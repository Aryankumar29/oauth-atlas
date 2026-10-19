// Usage: npx tsx scripts/probe.ts <domain|slug|url> [--authorize <url>] [--console <url>]
// Runs the credential-free probe step (SPEC §9.4) against the real network and prints probe records as JSON.
import { KNOWN_AUTHORIZE, runProbes } from "../lib/agent/probe";
import { resolveApp } from "../lib/agent/resolve";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const target = process.argv[2];
  if (!target || target.startsWith("--")) {
    console.error("Usage: npx tsx scripts/probe.ts <domain|slug|url> [--authorize <url>] [--console <url>]");
    process.exit(2);
  }
  const resolved = resolveApp(target, target);
  if ("error" in resolved) throw new Error(resolved.error);

  const authorize = flag("--authorize");
  if (authorize) KNOWN_AUTHORIZE[resolved.slug] = authorize;
  const consoleUrl = flag("--console") ?? resolved.consoleUrl;

  const result = await runProbes({ ...resolved, consoleUrl }, { fetch: globalThis.fetch, now: () => new Date() });
  console.log(
    JSON.stringify(
      {
        app: { slug: resolved.slug, name: resolved.name, website: resolved.website, consoleUrl },
        summary: result.summary,
        discovery: result.discovery ?? null,
        authorize: result.authorize ?? null,
        probes: result.probes,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
