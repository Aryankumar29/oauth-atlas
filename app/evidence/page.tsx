const tiers = [
  {
    label: "Tested",
    body: "We attempted the setup and captured dated evidence: screenshots, logs, and the exact scopes and redirect URIs used.",
  },
  {
    label: "Primary source",
    body: "Official provider documentation, developer console, policy, pricing, or trust center. These are the strongest non-test sources.",
  },
  {
    label: "Secondary source",
    body: "Community reports, changelogs, and reputable third parties. Useful for wait times and edge cases, but not treated as fact.",
  },
  {
    label: "Inferred",
    body: "Model reasoning. Clearly labeled and never presented as a verified provider requirement.",
  },
];

export default function EvidencePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Methodology
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
        What we know, and how we know it.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
        Every important claim in a guide should have a source, a date, and a
        confidence level. Tested steps are different from documentation, and
        both are different from inference.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {tiers.map((tier) => (
          <div
            key={tier.label}
            className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-zinc-950">
              {tier.label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{tier.body}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6">
        <h2 className="text-sm font-semibold text-zinc-900">
          Current limitations
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600">
          <li>No provider approvals have been completed.</li>
          <li>No paid accounts or production domains are used.</li>
          <li>Setup attempts are limited to free tiers and test users.</li>
          <li>Time estimates are ranges with a stated basis, not guarantees.</li>
          <li>Live-generated guides are drafts until verified.</li>
          <li>Some provider docs are login-walled or change frequently.</li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-900">
          Verification artifacts
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          The working logs live in the repository:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
              docs/verification-log.md
            </code>{" "}
            — dated setup attempts and source checks
          </li>
          <li>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
              docs/corrections.md
            </code>{" "}
            — claims that changed after verification
          </li>
          <li>
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">
              docs/evidence/
            </code>{" "}
            — redacted screenshots and source snapshots
          </li>
        </ul>
      </section>
    </main>
  );
}
