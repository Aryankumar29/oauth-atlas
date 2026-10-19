"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AppCard } from "@/components/AppCard";
import type { LibraryEntry } from "@/lib/data";
import { approvalModelSchema, tierSchema } from "@/lib/schema";

const difficulties = ["all", "1", "2", "3", "4", "5"] as const;
const approvalModels = ["all", ...approvalModelSchema.options] as const;
const managedOptions = ["all", "yes", "no"] as const;
const tiers = ["all", ...tierSchema.options] as const;

const difficultyLabels: Record<string, string> = {
  "1": "1 · Instant",
  "2": "2 · Easy",
  "3": "3 · Moderate",
  "4": "4 · Hard",
  "5": "5 · Very hard",
};

const selectClass =
  "h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white";

function Filter<T extends string>({
  id,
  label,
  value,
  options,
  allLabel,
  format,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  allLabel: string;
  format?: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        data-testid={id}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={selectClass}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === "all" ? allLabel : format ? format(o) : o.replaceAll("-", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

export function AppLibrary({ entries }: { entries: LibraryEntry[] }) {
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("all");
  const [approval, setApproval] = useState<(typeof approvalModels)[number]>("all");
  const [managed, setManaged] = useState<(typeof managedOptions)[number]>("all");
  const [tier, setTier] = useState<(typeof tiers)[number]>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return entries.filter(({ app, tier: t, guide }) => {
      if (
        q &&
        !app.name.toLowerCase().includes(q) &&
        !app.website.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (difficulty !== "all" && String(guide?.difficulty.score) !== difficulty) return false;
      if (approval !== "all" && app.approvalModel !== approval) return false;
      if (managed !== "all" && app.composio.managed !== managed) return false;
      if (tier !== "all" && t !== tier) return false;
      return true;
    });
  }, [entries, query, difficulty, approval, managed, tier]);

  const hasFilters =
    query !== "" ||
    difficulty !== "all" ||
    approval !== "all" ||
    managed !== "all" ||
    tier !== "all";

  function reset() {
    setQuery("");
    setDifficulty("all");
    setApproval("all");
    setManaged("all");
    setTier("all");
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="sr-only" htmlFor="app-search">
            Search apps
          </label>
          <input
            id="app-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by app name or website…"
            className="h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
          />
        </div>
        <Filter
          id="filter-difficulty"
          label="Filter by difficulty"
          value={difficulty}
          options={difficulties}
          allLabel="Any difficulty"
          format={(v) => difficultyLabels[v]}
          onChange={setDifficulty}
        />
        <Filter
          id="filter-approval"
          label="Filter by approval model"
          value={approval}
          options={approvalModels}
          allLabel="Any approval model"
          onChange={setApproval}
        />
        <Filter
          id="filter-managed"
          label="Filter by Composio-managed OAuth"
          value={managed}
          options={managedOptions}
          allLabel="Composio: any"
          format={(v) => (v === "yes" ? "Composio-managed" : "Bring your own app")}
          onChange={setManaged}
        />
        <Filter
          id="filter-tier"
          label="Filter by tier"
          value={tier}
          options={tiers}
          allLabel="Any tier"
          onChange={setTier}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-500">
        <p aria-live="polite">
          Showing {filtered.length} of {entries.length}
        </p>
        <Link href="/generate" className="font-medium text-zinc-900 hover:underline">
          Missing an app? Submit it →
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
          <h2 className="text-lg font-semibold text-zinc-900">No apps match</h2>
          <p className="mt-2 text-sm text-zinc-600">
            {difficulty !== "all"
              ? "Difficulty is only known for apps with a published guide. "
              : ""}
            Clear the filters, or submit the app and the agent will draft a guide.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {hasFilters ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-700 hover:border-zinc-400"
              >
                Clear filters
              </button>
            ) : null}
            <Link
              href={query ? `/generate?app=${encodeURIComponent(query.trim())}` : "/generate"}
              className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700"
            >
              Submit an app
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <AppCard key={entry.app.slug} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
