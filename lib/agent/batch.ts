import { runPipeline, type PipelineOptions } from "@/lib/agent/pipeline";
import type { PipelineDeps, RunRecord } from "@/lib/agent/types";
import { difficulty } from "@/lib/difficulty";
import { guideSchema, type Claim, type Guide } from "@/lib/schema";

// SPEC §12 batch QA gate. Returns the reasons a guide may NOT leave `queued`; empty means publishable.
export function qaGate(guide: unknown, run?: Pick<RunRecord, "events">): string[] {
  const parsed = guideSchema.safeParse(guide);
  if (!parsed.success) return [`schema invalid: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`];
  const g: Guide = parsed.data;
  const reasons: string[] = [];

  if (g.partial) reasons.push("guide is partial");

  const claims: Claim[] = [
    ...g.milestones.flatMap((m) => m.limitsUntilNext),
    ...g.gates.flatMap((x) => [x.cost, x.duration, x.recurring].filter((c): c is Claim => !!c)),
    ...g.oauthConfig.redirectUris,
    ...g.oauthConfig.rateLimits,
    ...[g.oauthConfig.pkce, g.oauthConfig.tokenLifetime, g.oauthConfig.refresh].filter((c): c is Claim => !!c),
  ];
  // QA-15a: our own probe records are not sources.
  const probeUrls = new Set(g.probes.map((p) => p.url));
  const sources = new Set(
    [
      ...g.evidence.filter((e) => e.sourceType !== "test").map((e) => e.sourceUrl),
      ...claims.filter((c) => c.status !== "tested").flatMap((c) => c.sources.map((s) => s.url)),
    ].filter((u) => !probeUrls.has(u)),
  );
  const primary = g.evidence.filter((e) => e.status === "primary").length + claims.filter((c) => c.status === "primary").length;
  if (sources.size < 3) reasons.push(`only ${sources.size} distinct sources (need ≥3)`);
  if (primary < 1) reasons.push("no primary source survived the validator");

  // Citation coverage: at least one milestone limit is cited, and every gate that drives difficulty is cited.
  const cited = (c?: Claim) => !!c && c.sources.length > 0;
  if (!g.milestones.some((m) => m.limitsUntilNext.some(cited))) reasons.push("no milestone has a cited limit");
  const score = difficulty(g.gates, { profile: g.verdict.profile }).score;
  const drivers = g.gates.filter(
    (x) => x.type !== "self-serve" && x.requiredFor.includes("production-ready") && difficulty([x]).score === score,
  );
  for (const x of drivers) {
    if (![x.cost, x.duration, x.recurring].some(cited)) reasons.push(`difficulty-driving gate "${x.name}" has no cited claim`);
  }

  const probeRan = run
    ? run.events.some((e) => e.step === "probe" && e.status === "done")
    : g.probes.length > 0;
  if (!probeRan) reasons.push("probe step did not run");
  if (!g.unknowns.length) reasons.push("unknowns are empty");
  if (!g.steps.length) reasons.push("no steps");
  if (g.steps.some((s) => !s.owner)) reasons.push("a step has no owner");
  return reasons;
}

export type BatchOptions = {
  slugs: { slug: string; name: string }[];
  force: boolean;
  dryRun: boolean;
  mock: boolean;
  exists: (slug: string) => boolean;
  // Parsed JSON of the existing guide file, for the curated-guide check.
  readExisting?: (slug: string) => unknown;
  write: (slug: string, json: string) => void;
  makeDeps: () => Promise<PipelineDeps>;
  pipelineOptions?: PipelineOptions;
  log?: (line: string) => void;
  now?: () => Date;
};

export type BatchResult = {
  written: string[];
  wouldWrite: string[];
  skipped: { slug: string; reasons: string[] }[];
};

// Unknown or unreadable existing files count as curated: never clobber what we cannot inspect.
export function isCurated(existing: unknown): boolean {
  if (typeof existing !== "object" || existing === null) return true;
  const g = existing as { generatedBy?: unknown; app?: { tier?: unknown } };
  return g.generatedBy !== "agent" || g.app?.tier === "verified" || g.app?.tier === "tested";
}

// QA-15b: --limit must be a positive integer.
export function parseLimit(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  if (!/^\d+$/.test(v) || Number(v) < 1) throw new Error(`--limit must be a positive integer, got "${v}"`);
  return Number(v);
}

export class MockWriteRefused extends Error {
  constructor() {
    super("Refusing to write guides in MOCK_LLM=1 mode (mock output is never published). Use --dry-run.");
    this.name = "MockWriteRefused";
  }
}

export async function runBatch(o: BatchOptions): Promise<BatchResult> {
  if (o.mock && !o.dryRun) throw new MockWriteRefused();
  const log = o.log ?? (() => {});
  const now = o.now ?? (() => new Date());
  const result: BatchResult = { written: [], wouldWrite: [], skipped: [] };

  for (const app of o.slugs) {
    // QA-14: curated guides are never overwritten, even with --force.
    if (o.exists(app.slug) && isCurated(o.readExisting?.(app.slug))) {
      result.skipped.push({ slug: app.slug, reasons: ["curated guide, not overwritten"] });
      log(`- ${app.slug}: curated guide, not overwritten`);
      continue;
    }
    if (o.exists(app.slug) && !o.force) {
      result.skipped.push({ slug: app.slug, reasons: ["guide already exists (use --force)"] });
      log(`- ${app.slug}: exists, skipped`);
      continue;
    }
    log(`> ${app.slug}: generating`);
    const deps = await o.makeDeps();
    const runId = `batch-${app.slug}-${now().toISOString().replace(/[:.]/g, "")}`;
    let run: RunRecord;
    try {
      run = await runPipeline({ query: app.name, slug: app.slug, runId, force: true }, deps, o.pipelineOptions);
    } catch (e) {
      result.skipped.push({ slug: app.slug, reasons: [`pipeline threw: ${e instanceof Error ? e.message : String(e)}`] });
      continue;
    }
    if (!run.guide) {
      result.skipped.push({ slug: app.slug, reasons: [`run ${run.status}: ${run.error ?? "no guide"}`] });
      log(`- ${app.slug}: no guide (${run.status})`);
      continue;
    }
    const reasons = qaGate(run.guide, run);
    if (reasons.length) {
      result.skipped.push({ slug: app.slug, reasons });
      log(`- ${app.slug}: failed QA gate: ${reasons.join("; ")}`);
      continue;
    }
    if (o.dryRun) {
      result.wouldWrite.push(app.slug);
      log(`+ ${app.slug}: passes QA gate (dry run, not written)`);
    } else {
      o.write(app.slug, `${JSON.stringify(run.guide, null, 2)}\n`);
      result.written.push(app.slug);
      log(`+ ${app.slug}: written`);
    }
  }
  return result;
}

const ident = (slug: string) => slug.replace(/[^a-z0-9]+([a-z0-9])/gi, (_, c: string) => c.toUpperCase()).replace(/^(\d)/, "_$1");

// Lines a human adds to data/guides/index.ts (the script never edits it).
export function indexLines(slugs: string[]): string[] {
  return [
    ...slugs.map((s) => `import ${ident(s)} from "./${s}.json";`),
    `// then append to rawGuides: ${slugs.map(ident).join(", ")}`,
  ];
}
