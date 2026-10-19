import Link from "next/link";

const steps = [
  "Resolve the app and its official developer docs",
  "Discover OAuth, scope, and approval requirements",
  "Extract claims with quotes and source URLs",
  "Verify sources and flag contradictions",
  "Plan the guide, timeline, blockers, and handoff",
  "Critique coverage and render the shareable guide",
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

      <form className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <label
          htmlFor="app-input"
          className="text-sm font-medium text-zinc-900"
        >
          App name or website
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="app-input"
            name="app"
            type="text"
            placeholder="e.g. miro.com or Calendly"
            className="h-11 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:bg-white"
          />
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center justify-center rounded-xl bg-zinc-900 px-6 text-sm font-medium text-white opacity-50"
            title="The generation pipeline is not wired yet"
          >
            Generate (coming next)
          </button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Pipeline not wired yet. T-005 adds the streaming API and persisted run.
        </p>
      </form>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          What the agent will do
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
