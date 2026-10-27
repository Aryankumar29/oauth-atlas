import { applyAttemptFacts, runAttempts, type AttemptResult } from "@/lib/agent/attempt";
import { lookupComposio } from "@/lib/agent/composio";
import { discover } from "@/lib/agent/discover";
import { extractGuide, fallbackGuide, type GuideContext } from "@/lib/agent/extract";
import type { FetchDocOptions } from "@/lib/agent/fetchDoc";
import { runProbes, type ProbeResult } from "@/lib/agent/probe";
import { resolveApp, type ResolvedApp } from "@/lib/agent/resolve";
import type { FetchedDoc, PipelineDeps, PipelineInput, PipelineStep, RunEvent, RunRecord } from "@/lib/agent/types";
import type { DnsLookup } from "@/lib/agent/urlGuard";
import { officialDomainsFor, validateGuide } from "@/lib/agent/validate";
import type { ComposioInfo, Guide } from "@/lib/schema";


export type PipelineOptions = {
  // SPEC §9.15: stop discovery and extract from what we have.
  softDeadlineMs?: number;
  // Hard cap on extraction; past it the run saves a fallback guide.
  hardDeadlineMs?: number;
  probeStepMs?: number;
  probeRequestMs?: number;
  fetchTimeoutMs?: number;
  reader?: FetchDocOptions["reader"];
  composioApiKey?: string;
  skipProbe?: boolean;
  // SSRF DNS check for fetchDoc and probes; unset in MOCK_LLM and tests.
  dnsLookup?: DnsLookup;
};

const DEFAULTS = {
  softDeadlineMs: 150_000,
  hardDeadlineMs: 250_000,
  probeStepMs: 20_000,
  probeRequestMs: 5_000,
  fetchTimeoutMs: 8_000,
};

export async function runPipeline(
  input: PipelineInput,
  deps: PipelineDeps,
  options: PipelineOptions = {},
): Promise<RunRecord> {
  const opts = { ...DEFAULTS, ...options };
  const start = deps.now().getTime();
  const elapsed = () => deps.now().getTime() - start;
  const softRemaining = () => opts.softDeadlineMs - elapsed();
  const hardRemaining = () => opts.hardDeadlineMs - elapsed();
  // Abort signals so abandoned LLM HTTP requests are actually cancelled: research at the soft deadline,
  // extraction at the hard deadline. Both also fire when the run finishes.
  const softAbort = new AbortController();
  const hardAbort = new AbortController();
  const timers = [
    setTimeout(() => softAbort.abort(new Error("soft deadline")), opts.softDeadlineMs),
    setTimeout(() => hardAbort.abort(new Error("hard deadline")), opts.hardDeadlineMs),
  ];
  const researchOpts = { deadlineAt: start + opts.softDeadlineMs, signal: softAbort.signal };
  const extractOpts = { deadlineAt: start + opts.hardDeadlineMs, signal: hardAbort.signal };

  const run: RunRecord = {
    runId: input.runId,
    input,
    status: "running",
    events: [],
    startedAt: deps.now().toISOString(),
  };

  const record = async (step: PipelineStep, status: RunEvent["status"], message: string, data?: unknown) => {
    const event: RunEvent = { step, status, message, at: deps.now().toISOString(), ...(data === undefined ? {} : { data }) };
    run.events.push(event);
    deps.emit(event);
    // Persist on step boundaries so a refresh shows progress (SPEC §9.11).
    if (status !== "progress") await safePut(deps, run);
  };

  try {
    return await body();
  } finally {
    timers.forEach(clearTimeout);
    // Anything still in flight was abandoned by the pipeline (e.g. the losing side of a deadline race): cancel it.
    softAbort.abort(new Error("run finished"));
    hardAbort.abort(new Error("run finished"));
  }

  async function body(): Promise<RunRecord> {
    await safePut(deps, run);
    const unknowns: string[] = [];
    let partial = false;

    try {
      // 1. resolve
      await record("resolve", "start", `Resolving "${input.query}"`);
      const resolvedOrErr = resolveApp(input.query, input.slug);
      if ("error" in resolvedOrErr) {
        await record("resolve", "error", resolvedOrErr.error);
        return await finish(run, deps, "failed", resolvedOrErr.error);
      }
      const resolved: ResolvedApp = resolvedOrErr;
      if (resolved.alternatives.length) {
        unknowns.push(
          `"${input.query}" also matched ${resolved.alternatives.map((a) => a.name).join(", ")}; this guide covers ${resolved.name}.`,
        );
      }
      if (resolved.websiteGuessed) unknowns.push(`Website ${resolved.website} was guessed from the name; confirm it is the right product.`);
      await record("resolve", "done", `${resolved.name} (${resolved.website})${resolved.seed ? " — in the seed list" : ""}`, {
        slug: resolved.slug,
        name: resolved.name,
        website: resolved.website,
        docsUrl: resolved.docsUrl,
        alternatives: resolved.alternatives,
      });

      // 2. composio
      await record("composio", "start", "Checking Composio managed-auth directory");
      let composio: ComposioInfo;
      try {
        const c = await lookupComposio(resolved.seed?.composio.toolkitSlug ?? resolved.slug, {
          fetch: deps.fetch,
          now: deps.now,
          apiKey: opts.composioApiKey,
        });
        composio = c.info;
        await record("composio", "done", c.detail, { managed: c.info.managed, source: c.source, sourceUrl: c.sourceUrl });
      } catch (e) {
        composio = { toolkitSlug: resolved.slug, managed: "unknown", checkedAt: deps.now().toISOString().slice(0, 10) };
        await record("composio", "error", `Composio lookup failed: ${msg(e)}`);
      }

      // 3. discover runs concurrently with 4. probe and then 4b. attempt; each of those has its own 20 s cap.
      await record("discover", "start", "Searching and fetching official docs");
      const probeOpts = {
        fetch: deps.fetch,
        now: deps.now,
        perRequestMs: opts.probeRequestMs,
        stepMs: opts.probeStepMs,
        dnsLookup: opts.dnsLookup,
      };
      const probePromise: Promise<ProbeResult | null> = opts.skipProbe
        ? Promise.resolve(null)
        : (async () => {
            await record("probe", "start", "Probing discovery, authorize, and console endpoints");
            return runProbes(resolved, probeOpts);
          })();
      const attemptPromise: Promise<AttemptResult | null> = opts.skipProbe
        ? Promise.resolve(null)
        : (async () => {
            const p = await probePromise.catch(() => null);
            await record("attempt", "start", "Attempting setup steps: code exchange, MCP server, client registration");
            return runAttempts(resolved, p, { ...probeOpts, officialDomains: officialDomainsFor(resolved) });
          })();

      const fetchOpts: FetchDocOptions = {
        fetch: deps.fetch,
        now: deps.now,
        timeoutMs: opts.fetchTimeoutMs,
        reader: opts.reader,
        dnsLookup: opts.dnsLookup,
      };
      const disc = await discover(resolved, {
        llm: deps.llm,
        fetchOpts,
        remainingMs: softRemaining,
        llmOpts: researchOpts,
        onProgress: (m) => void record("discover", "progress", m),
      });
      const docs: FetchedDoc[] = disc.docs;
      for (const f of disc.failed) {
        unknowns.push(f.reason === "login-wall" ? `Docs behind a login wall: ${f.url}` : `Could not fetch ${f.url}`);
      }
      if (disc.stoppedEarly || disc.researchTimedOut) {
        partial = true;
        unknowns.push("Generation hit the soft deadline; discovery stopped early.");
      }
      if (disc.researchError) unknowns.push(`Research call failed: ${disc.researchError}`);
      if (disc.skippedUnsafe) unknowns.push(`Skipped ${disc.skippedUnsafe} non-public URLs.`);
      await record(
        "discover",
        docs.length ? "done" : "error",
        `${docs.length} docs fetched, ${disc.failed.length} unreachable`,
        { sources: docs.map((d) => ({ url: d.url, title: d.title, chars: d.text.length })), failed: disc.failed },
      );

      let probe: ProbeResult | null = null;
      try {
        probe = await probePromise;
        if (probe) await record("probe", "done", probe.summary, { probes: probe.probes });
        else await record("probe", "skipped", "Probe disabled");
      } catch (e) {
        await record("probe", "error", `Probe failed: ${msg(e)}`);
      }

      let attempt: AttemptResult | null = null;
      try {
        attempt = await attemptPromise;
        if (attempt) await record("attempt", "done", attempt.summary, { attempts: attempt.attempts });
        else await record("attempt", "skipped", "Attempts disabled");
      } catch (e) {
        await record("attempt", "error", `Attempts failed: ${msg(e)}`);
      }

      // 5. extract
      const ctx: GuideContext = {
        resolved,
        composio,
        probes: [...(probe?.probes ?? []), ...(attempt?.attempts ?? [])],
        runId: input.runId,
        now: deps.now(),
        unknowns,
      };
      let guide: Guide;
      let llmDifficulty: unknown;
      if (!docs.length) {
        partial = true;
        await record("extract", "skipped", "No docs to extract from; saving a labeled partial guide");
        guide = fallbackGuide(ctx, "No official docs could be fetched for this app.");
      } else {
        await record("extract", "start", `Extracting a guide from ${docs.length} docs`);
        const ex = await extractGuide(
          deps.llm,
          { query: `${resolved.name} (${resolved.website})`, docs, probes: ctx.probes, composio },
          ctx,
          { partial, remainingMs: hardRemaining, llmOpts: extractOpts },
        );
        guide = ex.guide;
        if (ex.ok) {
          llmDifficulty = ex.llmDifficulty;
          await record("extract", "done", `Guide draft validated against the schema (attempt ${ex.attempts})`);
        } else {
          partial = true;
          await record("extract", "error", `Saved a partial guide: ${ex.error.slice(0, 300)}`);
        }
      }

      // 6. verify
      await record("verify", "start", "Checking quotes against fetched docs and computing difficulty");
      if (probe) guide = applyProbeFacts(guide, probe);
      if (attempt) guide = applyAttemptFacts(guide, attempt);
      guide.partial = guide.partial || partial;
      const v = validateGuide(guide, { docs, officialDomains: officialDomainsFor(resolved), llmDifficulty });
      guide = v.guide;
      await record(
        "verify",
        "done",
        `Difficulty ${v.report.difficulty.computed} (computed). ${v.report.downgraded.length} of ${v.report.checkedClaims} claims downgraded.`,
        v.report,
      );

      // 7. render
      await record("render", "start", "Saving the guide");
      run.guide = guide;
      run.guideSlug = guide.slug;
      // Never replace a complete guide:{slug} with a partial one; the run record still keeps its own guide.
      const existing = guide.partial ? await deps.store.getGuide(guide.slug).catch(() => null) : null;
      if (!existing || existing.partial) await deps.store.putGuide(guide);
      await record("render", "done", guide.partial ? "Saved a partial guide" : "Guide ready", { slug: guide.slug });
      return await finish(run, deps, guide.partial ? "partial" : "done");
    } catch (e) {
      const lastStep = run.events.at(-1)?.step ?? "resolve";
      await record(lastStep, "error", `Unexpected failure: ${msg(e)}`).catch(() => {});
      return await finish(run, deps, run.guide ? "partial" : "failed", msg(e));
    }
  }
}

// Probe observations are endpoint facts we tested ourselves; they back PKCE support only (never policy).
function applyProbeFacts(guide: Guide, probe: ProbeResult): Guide {
  const d = probe.discovery;
  if (!d || !d.codeChallengeMethods.length) return guide;
  const g = structuredClone(guide);
  const value = `PKCE supported (${d.codeChallengeMethods.join(", ")}), per the provider's discovery document`;
  g.oauthConfig.pkce = {
    value,
    status: "tested",
    testKind: "probe",
    sources: [{ url: d.url, title: "OIDC/OAuth discovery document", fetchedAt: d.at }],
    lastChecked: d.at,
  };
  if (!g.evidence.some((e) => e.sourceUrl === d.url)) {
    g.evidence.push({
      id: "probe-discovery",
      claim: value,
      sourceUrl: d.url,
      sourceType: "test",
      retrievedAt: d.at,
      status: "tested",
      confidence: "high",
    });
  }
  return g;
}

async function finish(run: RunRecord, deps: PipelineDeps, status: RunRecord["status"], error?: string) {
  run.status = status;
  run.finishedAt = deps.now().toISOString();
  if (error) run.error = error;
  await safePut(deps, run);
  return run;
}

async function safePut(deps: PipelineDeps, run: RunRecord) {
  try {
    await deps.store.putRun(run);
  } catch (e) {
    console.error(`[pipeline] putRun failed for ${run.runId}: ${msg(e)}`);
  }
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
