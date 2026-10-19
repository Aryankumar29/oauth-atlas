import type { Metadata } from "next";
import Link from "next/link";

import { AppLibrary } from "@/components/AppLibrary";
import { getLibraryEntries } from "@/lib/data";

export const metadata: Metadata = {
  title: "App library — OAuth Atlas",
  description:
    "Browse OAuth setup and approval guides for apps that support OAuth.",
};

export default function AppsPage() {
  const entries = getLibraryEntries();
  const guideCount = entries.filter((e) => e.guide).length;
  const testedCount = entries.filter((e) => e.tier === "tested").length;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 sm:px-6">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Library
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
            Find the fastest path to a working OAuth app.
          </h1>
          <p
            data-testid="library-stats"
            className="mt-3 text-sm font-medium text-zinc-900"
          >
            {entries.length} tracked · {guideCount} guides · {testedCount} tested
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Open a guide for the verdict, timeline, scopes, blockers, and
            evidence. Apps without a guide can be drafted live.
          </p>
        </div>
        <Link
          href="/generate"
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Submit an app
        </Link>
      </div>

      <AppLibrary entries={entries} />
    </main>
  );
}
