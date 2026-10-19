import Link from "next/link";

import type { LibraryEntry } from "@/lib/data";
import type { Managed, Tier } from "@/lib/schema";

export const tierStyles: Record<Tier, string> = {
  tested: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  verified: "bg-sky-50 text-sky-700 ring-sky-200",
  generated: "bg-amber-50 text-amber-700 ring-amber-200",
  queued: "bg-zinc-100 text-zinc-600 ring-zinc-200",
};

const managedLabel: Record<Managed, string> = {
  yes: "Composio-managed OAuth",
  no: "Bring your own OAuth app",
  unknown: "Composio: unknown",
};

const managedStyles: Record<Managed, string> = {
  yes: "bg-violet-50 text-violet-700 ring-violet-200",
  no: "bg-orange-50 text-orange-700 ring-orange-200",
  unknown: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

export function AppCard({ entry }: { entry: LibraryEntry }) {
  const { app, tier, guide } = entry;
  const href = guide ? `/apps/${app.slug}` : `/generate?app=${app.slug}`;

  return (
    <Link
      href={href}
      data-testid="app-card"
      data-slug={app.slug}
      className="group flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-950 group-hover:underline">
              {app.name}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              {app.category} · {app.approvalModel.replaceAll("-", " ")}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ring-1 ring-inset ${tierStyles[tier]}`}
          >
            {tier}
          </span>
        </div>

        {guide ? (
          <>
            <p className="mt-4 text-sm font-medium text-zinc-900">
              {guide.difficulty.score}/5 · {guide.difficulty.label}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{guide.summary}</p>
            <p className="mt-3 inline-flex rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
              {guide.timeChip}
            </p>
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">
            No guide yet. Generate a draft from the official docs.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-4 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ring-1 ring-inset ${managedStyles[app.composio.managed]}`}
        >
          {managedLabel[app.composio.managed]}
        </span>
        <span className="font-medium text-zinc-900">
          {guide ? "Open guide →" : "Generate now →"}
        </span>
      </div>
    </Link>
  );
}
