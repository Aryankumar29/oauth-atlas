import Link from "next/link";

const cards = [
  {
    title: "Library",
    body: "Browse app-specific guides. Filter by difficulty, approval model, time, and confidence.",
    href: "/apps",
    cta: "Open the library",
  },
  {
    title: "Live generation",
    body: "Submit an app name or URL. An agent researches the provider and drafts a shareable guide.",
    href: "/generate",
    cta: "Generate a guide",
  },
  {
    title: "Evidence",
    body: "See what we tested, what sources support, what we corrected, and what remains uncertain.",
    href: "/evidence",
    cta: "Read the methodology",
  },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-16 sm:py-24">
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
          OAuth Atlas
        </p>
        <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-6xl">
          Know what it takes to ship your OAuth integration.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
          Provider docs tell you how to configure OAuth. OAuth Atlas tells you
          whether to use a managed app or your own, how long approval will take,
          what will block you, and what to do next — with sources.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/apps"
            className="inline-flex h-11 items-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Browse the library
          </Link>
          <Link
            href="/generate"
            className="inline-flex h-11 items-center rounded-full border border-zinc-300 px-6 text-sm font-medium text-zinc-800 hover:border-zinc-400"
          >
            Generate a live guide
          </Link>
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="group rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-zinc-950">
              {card.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{card.body}</p>
            <p className="mt-6 text-sm font-medium text-zinc-900 group-hover:underline">
              {card.cta} →
            </p>
          </Link>
        ))}
      </section>

      <section className="mt-16 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
          Current status
        </p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-amber-900">
          This is the scaffold for the take-home build. The seed library and
          guide schema are in place. Next: publish five varied demo guides, wire
          the live generation pipeline, and add the verification log.
        </p>
      </section>
    </main>
  );
}
