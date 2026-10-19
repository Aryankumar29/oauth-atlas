import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { GuideView } from "@/components/guide/GuideView";
import { cachedInfo } from "@/lib/agent/cache";
import { isMockMode } from "@/lib/agent/deps";
import type { RunRecord } from "@/lib/agent/types";
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
  const mock = isMockMode();

  return (
    <div className="mt-6 space-y-8">
      {/* GuideView renders the MOCK MODE and live-generated banners; repeat MOCK only when there is no guide. */}
      {mock && !guide && (
        <p className="rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-800">
          MOCK MODE — fixture data, not a real research run.
        </p>
      )}
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
      {guide && <GuideView guide={guide} mock={mock} />}
      <RunTrace run={run} />
    </div>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
