"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { approvalModelSchema, type App } from "@/lib/schema";

const archetypes = ["all", ...approvalModelSchema.options] as const;

const tierStyles: Record<App["tier"], string> = {
  tested: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  verified: "bg-sky-50 text-sky-700 ring-sky-200",
  generated: "bg-amber-50 text-amber-700 ring-amber-200",
  queued: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

export function AppLibrary({ apps }: { apps: App[] }) {
  const [query, setQuery] = useState("");
  const [archetype, setArchetype] = useState<(typeof archetypes)[number]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return apps.filter((app) => {
      const matchesQuery =
        !q ||
        app.name.toLowerCase().includes(q) ||
        app.website.toLowerCase().includes(q) ||
        app.category.toLowerCase().includes(q);
      const matchesArchetype =
        archetype === "all" || app.approvalModel === archetype;

      return matchesQuery && matchesArchetype;
    });
  }, [apps, archetype, query]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="app-search">
          Search apps
        </label>
        <input
          id="app-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by app, website, or category…"
          className="h-11 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
        />

        <label className="sr-only" htmlFor="archetype-filter">
          Filter by archetype
        </label>
        <select
          id="archetype-filter"
          value={archetype}
          onChange={(event) =>
            setArchetype(event.target.value as (typeof archetypes)[number])
          }
          className="h-11 rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
        >
          {archetypes.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All approval models" : value.replaceAll("-", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <p>
          {filtered.length} of {apps.length} apps
        </p>
        <p>Guides are generated in tiers: tested, verified, indexed.</p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-900">No apps found</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Try a different search, or submit an app for live generation.
          </p>
          <Link
            href="/generate"
            className="mt-4 inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Generate a guide
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((app) => (
            <Link
              key={app.slug}
              href={`/apps/${app.slug}`}
              className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-950 group-hover:underline">
                      {app.name}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">{app.category}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ring-1 ring-inset ${tierStyles[app.tier]}`}
                  >
                    {app.tier}
                  </span>
                </div>

                <p className="mt-4 text-sm capitalize text-zinc-600">
                  {app.approvalModel.replaceAll("-", " ")}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-4 text-xs text-zinc-500">
                <span>
                  Managed OAuth:{" "}
                  <span className="font-medium text-zinc-700">
                    {app.composio.managed}
                  </span>
                </span>
                <span className="font-medium text-zinc-900">Open guide →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
