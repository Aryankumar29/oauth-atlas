import type { Metadata } from "next";

import { AppLibrary } from "@/components/AppLibrary";
import { apps } from "@/lib/data";

export const metadata: Metadata = {
  title: "App library — OAuth Atlas",
  description:
    "Browse OAuth setup and approval guides for apps that support OAuth.",
};

export default function AppsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <div className="mb-8 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Library
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
          Find the fastest path to a working OAuth app.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Filter by app type, then open a guide for the verdict, timeline,
          scopes, blockers, and evidence. Every guide shows what we tested and
          what is still uncertain.
        </p>
      </div>

      <AppLibrary apps={apps} />
    </main>
  );
}
