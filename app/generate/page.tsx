import Link from "next/link";
import { Suspense } from "react";

import { GenerateClient } from "@/components/generate/GenerateClient";
import { isMockMode } from "@/lib/agent/deps";

const steps = [
  "Resolve the app and check Composio managed auth",
  "Search and fetch the official developer docs",
  "Probe discovery, authorize, and console endpoints (no credentials)",
  "Extract the guide in the library schema",
  "Check every primary quote against the fetched docs; compute difficulty from gates",
  "Save a shareable guide, partial if anything timed out",
];

export default function GeneratePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Live generation
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
        Turn any app into a setup guide.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
        Submit an app name or website. The agent will research the public
        developer program and draft a guide in the same format as the library.
        Live guides are labeled unverified until a human checks the sources.
      </p>

      <Suspense fallback={<div className="mt-8 h-40 rounded-2xl border border-zinc-200 bg-white" />}>
        <GenerateClient mock={isMockMode()} />
      </Suspense>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          What the agent does
        </h2>
        <ol className="mt-4 space-y-3">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-zinc-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-xs leading-5 text-zinc-500">
          The agent does not create accounts, accept legal terms, or submit
          reviews. It prepares the guide and the submission packet; you own the
          human gates.
        </p>
      </section>

      <p className="mt-8 text-sm text-zinc-500">
        Looking for an existing app?{" "}
        <Link href="/apps" className="font-medium text-zinc-900 underline">
          Browse the library
        </Link>
        .
      </p>
    </main>
  );
}
