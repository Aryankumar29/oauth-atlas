import type { Metadata } from "next";

import { evidenceStatusSchema } from "@/lib/schema";
import { COMMUNITY_BADGE, STATUS_DESCRIPTIONS } from "@/lib/guide-content";

export const metadata: Metadata = {
  title: "Evidence and methodology — OAuth Atlas",
  description: "How OAuth Atlas sources, tests, and labels every claim.",
};

const REPO = "https://github.com/Aryankumar29/oauth-atlas";

const logs = [
  { path: "docs/verification-log.md", body: "Dated setup attempts, probe runs, and source checks." },
  { path: "docs/corrections.md", body: "Claims that changed after verification, with before, after, and why." },
  { path: "docs/evidence/", body: "Redacted screenshots and source snapshots." },
];

const methodology = [
  "Every important claim carries a status, a source URL, a retrieval date, and a confidence level.",
  "A primary claim must quote text actually fetched in that run. If the quote doesn't match, the claim is downgraded to inferred.",
  "Tested claims say which kind they are: a probe (a timestamped request to a live endpoint) or an attempt (a real setup run). Probes cover endpoint behaviour only, never policy.",
  "Difficulty is computed from the gates, never taken from the model. Conditional gates are shown but not scored.",
  "Timelines are ranges with a stated basis: official SLA, official estimate, community, estimate, or unknown.",
  `Community timelines carry a "${COMMUNITY_BADGE.toLowerCase()}" badge.`,
];

const limitations = [
  "No provider approvals have been completed.",
  "No paid accounts or production domains are used.",
  "Setup attempts are limited to free tiers and test users.",
  "Time estimates are ranges with a stated basis, not guarantees.",
  "Live-generated guides are drafts until verified.",
  "Some provider docs are login-walled or change frequently.",
];

export default function EvidencePage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Methodology
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-zinc-950">
        What we know, and how we know it.
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
        Tested steps are different from documentation, and both are different
        from inference. Every guide keeps them apart.
      </p>

      <section className="mt-8" aria-labelledby="method-h">
        <h2 id="method-h" className="text-sm font-semibold text-zinc-900">How claims are checked</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600">
          {methodology.map((m) => <li key={m}>{m}</li>)}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="status-h">
        <h2 id="status-h" className="text-sm font-semibold text-zinc-900">Evidence statuses</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          {evidenceStatusSchema.options.map((s) => (
            <div key={s} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <dt className="text-sm font-semibold capitalize text-zinc-950">{s}</dt>
              <dd className="mt-2 text-sm leading-6 text-zinc-600">{STATUS_DESCRIPTIONS[s]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10" aria-labelledby="logs-h">
        <h2 id="logs-h" className="text-sm font-semibold text-zinc-900">Verification artifacts</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {logs.map((l) => (
            <li key={l.path}>
              <a href={`${REPO}/${l.path.endsWith("/") ? "tree" : "blob"}/main/${l.path}`} target="_blank" rel="noreferrer" className="font-mono text-xs text-zinc-900 underline underline-offset-2">
                {l.path}
              </a>{" "}
              <span className="text-zinc-600">— {l.body}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6" aria-labelledby="limits-h">
        <h2 id="limits-h" className="text-sm font-semibold text-zinc-900">Current limitations</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-zinc-600">
          {limitations.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </main>
  );
}
