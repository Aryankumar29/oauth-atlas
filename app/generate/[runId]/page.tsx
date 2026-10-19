import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { isMockMode } from "@/lib/agent/deps";
import { cachedInfo } from "@/lib/agent/cache";
import type { RunRecord } from "@/lib/agent/types";
import { DIFFICULTY_LABELS, difficulty, type DifficultyScore } from "@/lib/difficulty";
import type { Guide } from "@/lib/schema";
import { getStore } from "@/lib/store";

export default function RunPage(props: PageProps<"/generate/[runId]">) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <Link href="/generate" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
        ← Generate another
      </Link>
      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Loading run…</p>}>
        <Run params={props.params} />
      </Suspense>
    </main>
  );
}

async function Run({ params }: { params: PageProps<"/generate/[runId]">["params"] }) {
  const { runId } = await params;
  const store = await getStore();
  const run = await store.getRun(runId);
  if (!run) notFound();
  const latest = !run.guide && run.guideSlug ? await store.getGuide(run.guideSlug) : null;
  const guide = run.guide ?? latest;
  const cached = cachedInfo(run);

  return (
    <div className="mt-6 space-y-8">
      {isMockMode() && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
          MOCK MODE: fixture LLM and recorded HTTP. Results are synthetic.
        </p>
      )}
      <p className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800">
        Live-generated — verify before relying on it.
      </p>
      {latest && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-100 px-4 py-2 text-sm text-zinc-700">
          This run did not store its own guide; showing the latest guide for this app.
        </p>
      )}
      {cached && guide && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          Cached demo guide, generated {cached.generatedAt}.{" "}
          <Link
            href={`/generate?app=${encodeURIComponent(guide.app.name)}&slug=${guide.slug}&force=1`}
            className="font-medium underline"
          >
            Regenerate live
          </Link>
        </p>
      )}
      {run.status === "running" && (
        <p className="text-sm text-zinc-600">This run is still in progress. Refresh to see more.</p>
      )}
      {run.status === "failed" && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          Generation failed: {run.error ?? "unknown error"}
        </p>
      )}
      {guide && <GuideStub guide={guide} />}
      <RunTrace run={run} />
    </div>
  );
}

// Minimal placeholder until GuideView (T-003) lands.
function GuideStub({ guide }: { guide: Guide }) {
  const score = guide.verdict.difficulty as DifficultyScore;
  const rationale = difficulty(guide.gates, { profile: guide.verdict.profile }).rationale;
  const sources = new Set(guide.evidence.map((e) => e.sourceUrl)).size;
  return (
    <article className="space-y-6" data-testid="generated-guide">
      <header className="border-b border-zinc-200 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{guide.app.name}</h1>
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600">generated</span>
          {guide.partial && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">partial</span>
          )}
        </div>
        <p className="mt-3 text-sm text-zinc-700">{guide.verdict.summary}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat label="Difficulty" value={guide.partial && !guide.gates.length ? "Unknown" : `${score} · ${DIFFICULTY_LABELS[score]}`} />
          <Stat label="Approval model" value={guide.verdict.approvalModel} />
          <Stat label="Composio managed" value={guide.app.composio.managed} />
          <Stat label="Confidence" value={`${guide.confidence} · ${sources} sources`} />
        </dl>
        {rationale.length > 0 && <p className="mt-2 text-xs text-zinc-500">Driven by: {rationale.join("; ")}</p>}
      </header>

      <Section title="Probe results">
        {guide.probes.length ? (
          <ul className="space-y-2 text-xs">
            {guide.probes.map((p, i) => (
              <li key={i} className="break-all">
                <code>{p.method} {p.url}</code> → {p.status}
                {p.redirect ? ` → ${p.redirect}` : ""}. {p.observed} <span className="text-zinc-400">({p.at})</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">No probes ran.</p>
        )}
      </Section>

      <Section title="What we couldn't verify">
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {guide.unknowns.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      </Section>

      <Section title="Evidence">
        <ul className="space-y-2 text-sm">
          {guide.evidence.map((e) => (
            <li key={e.id}>
              <span className="text-xs uppercase text-zinc-500">{e.status}</span> {e.claim}{" "}
              <a href={e.sourceUrl} className="break-all text-xs underline" rel="noreferrer" target="_blank">
                {e.sourceUrl}
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <details className="rounded-xl border border-zinc-200 bg-white p-4 text-xs">
        <summary className="cursor-pointer font-medium">Full guide JSON</summary>
        <pre className="mt-3 overflow-x-auto">{JSON.stringify(guide, null, 2)}</pre>
      </details>
    </article>
  );
}

function RunTrace({ run }: { run: RunRecord }) {
  return (
    <Section title={`Run trace (${run.status})`}>
      <ol className="space-y-1 text-xs text-zinc-600" data-testid="run-trace">
        {run.events
          .filter((e) => e.status !== "progress")
          .map((e, i) => (
            <li key={i}>
              <span className="font-medium text-zinc-900">{e.step}</span> {e.status}: {e.message}
            </li>
          ))}
      </ol>
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
