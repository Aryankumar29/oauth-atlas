"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { PipelineStep, RunEvent } from "@/lib/agent/types";

const STEPS: { id: PipelineStep; label: string }[] = [
  { id: "resolve", label: "Resolve the app" },
  { id: "composio", label: "Check Composio managed auth" },
  { id: "discover", label: "Search and fetch official docs" },
  { id: "probe", label: "Probe OAuth endpoints" },
  { id: "extract", label: "Extract the guide" },
  { id: "verify", label: "Verify quotes and compute difficulty" },
  { id: "render", label: "Save and render" },
];

type Done = { runId: string; status: string; guideSlug?: string; error?: string; cached?: boolean };

function parseSse(chunk: string): { event: string; data: unknown }[] {
  return chunk
    .split("\n\n")
    .filter((block) => block.trim())
    .map((block) => {
      const event = block.match(/^event: (.*)$/m)?.[1] ?? "message";
      const data = block.match(/^data: (.*)$/m)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}

export function GenerateClient({ mock }: { mock: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("app") ?? "");
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mockRun, setMockRun] = useState(false);

  async function start(force = params.get("force") === "1") {
    if (!query.trim() || running) return;
    setRunning(true);
    setEvents([]);
    setDone(null);
    setError(null);
    setRunId(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, slug: params.get("slug") ?? undefined, force }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished: Done | null = null;
      for (;;) {
        const { value, done: eof } = await reader.read();
        if (eof) break;
        buffer += decoder.decode(value, { stream: true });
        const cut = buffer.lastIndexOf("\n\n");
        if (cut < 0) continue;
        const ready = buffer.slice(0, cut + 2);
        buffer = buffer.slice(cut + 2);
        for (const { event, data } of parseSse(ready)) {
          if (event === "run") {
            setRunId((data as { runId: string }).runId);
            setMockRun((data as { mock?: boolean }).mock === true);
          }
          else if (event === "step") setEvents((prev) => [...prev, data as RunEvent]);
          else if (event === "done") finished = data as Done;
        }
      }
      setDone(finished);
      if (finished?.runId && finished.status !== "failed") router.push(`/generate/${finished.runId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const stepState = (id: PipelineStep) => {
    const mine = events.filter((e) => e.step === id);
    const last = [...mine].reverse().find((e) => e.status !== "progress");
    return { status: last?.status ?? (mine.length ? "start" : null), messages: mine };
  };

  return (
    <div className="mt-8 space-y-6">
      {(mock || mockRun) && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900">
          MOCK MODE: fixture LLM and recorded HTTP. Results are synthetic.
        </p>
      )}
      <form
        className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <label htmlFor="app-input" className="text-sm font-medium text-zinc-900">
          App name or website
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="app-input"
            name="app"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. miro.com or Calendly"
            className="h-11 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
          />
          <button
            type="submit"
            disabled={running || !query.trim()}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white disabled:opacity-50"
          >
            {running ? "Generating…" : "Generate"}
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Takes up to 3 minutes. Live guides are unverified until a human checks the sources.
        </p>
      </form>

      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {(running || events.length > 0) && (
        <section aria-live="polite" className="rounded-2xl border border-zinc-200 bg-white p-6" data-testid="run-trace">
          <h2 className="text-sm font-semibold text-zinc-900">
            Run {runId ? <code className="text-xs text-zinc-500">{runId}</code> : null}
          </h2>
          <ol className="mt-4 space-y-3">
            {STEPS.map((s) => {
              const { status, messages } = stepState(s.id);
              const last = messages.at(-1);
              return (
                <li key={s.id} className="text-sm" data-step={s.id} data-status={status ?? "pending"}>
                  <span className="font-medium text-zinc-900">{s.label}</span>{" "}
                  <span className="text-xs uppercase tracking-wide text-zinc-500">{status ?? "pending"}</span>
                  {last && <p className="mt-0.5 text-xs text-zinc-600">{last.message}</p>}
                </li>
              );
            })}
          </ol>
          {done && (
            <div className="mt-4 text-sm">
              {done.status === "failed" ? (
                <p className="text-red-700">Run failed: {done.error ?? "unknown error"}</p>
              ) : (
                <Link href={`/generate/${done.runId}`} className="font-medium text-zinc-900 underline">
                  Open the {done.status === "partial" ? "partial " : ""}guide
                </Link>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
