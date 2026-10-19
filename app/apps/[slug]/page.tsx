import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { GuideView } from "@/components/guide/GuideView";
import { apps, getApp, getGuide } from "@/lib/data";

export function generateStaticParams() {
  return apps.map((app) => ({ slug: app.slug }));
}

export async function generateMetadata(props: PageProps<"/apps/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const app = getApp(slug);
  const guide = getGuide(slug);
  if (!app) return {};
  return {
    title: `${app.name} OAuth guide — OAuth Atlas`,
    description: guide?.verdict.summary ?? `OAuth setup and approval guide for ${app.name}.`,
  };
}

export default async function AppPage(props: PageProps<"/apps/[slug]">) {
  const { slug } = await props.params;
  const app = getApp(slug);

  if (!app) {
    notFound();
  }

  const guide = getGuide(slug);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <Link
        href="/apps"
        className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
      >
        ← Back to library
      </Link>

      {guide ? (
        <div className="mt-6">
          <GuideView guide={guide} />
        </div>
      ) : (
        <>
          <header className="mt-6 border-b border-zinc-200 pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              {app.category}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-zinc-950">
                {app.name}
              </h1>
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium capitalize text-zinc-600">
                {app.tier}
              </span>
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              {app.approvalModel.replaceAll("-", " ")} ·{" "}
              <a
                href={app.website}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
              >
                {app.website}
              </a>
            </p>
          </header>

          <section className="mt-8 rounded-2xl border border-dashed border-zinc-300 bg-white p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Guide pending
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
              This app is queued, not verified yet.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Composio managed OAuth: <strong>{app.composio.managed}</strong>{" "}
              (checked {app.composio.checkedAt}). Generate a draft guide from the
              official docs; it stays labeled unverified until checked.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={`/generate?app=${app.slug}`}
                className="inline-flex h-10 items-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Generate a draft
              </Link>
              {app.docsUrl ? (
                <a
                  href={app.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-700 hover:border-zinc-400"
                >
                  Official docs ↗
                </a>
              ) : null}
              {app.consoleUrl ? (
                <a
                  href={app.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center rounded-full border border-zinc-300 px-5 text-sm font-medium text-zinc-700 hover:border-zinc-400"
                >
                  Developer console ↗
                </a>
              ) : null}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
