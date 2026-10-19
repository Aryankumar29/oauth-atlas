import type { ReactNode } from "react";

import { ShareButtons } from "@/components/guide/ShareButtons";
import { difficulty } from "@/lib/difficulty";
import { humanize, milestoneHours, milestoneWait, UNKNOWN } from "@/lib/format";
import {
  alternateProfiles,
  COMMUNITY_BADGE,
  DIFFICULTY_UNKNOWN,
  isDifficultyUnknown,
  isLiveGenerated,
  MANAGED_VERDICT,
  MILESTONE_LABELS,
  OWN_APP_SOURCES,
  OWN_APP_TRIGGERS,
  REDIRECT_URI_NOTE,
  SWITCH_NOTE,
} from "@/lib/guide-content";
import { guideToMarkdown } from "@/lib/markdown";
import type { Claim, EvidenceStatus, Guide, Milestone } from "@/lib/schema";

const statusStyles: Record<EvidenceStatus, string> = {
  tested: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  primary: "bg-sky-50 text-sky-700 ring-sky-200",
  secondary: "bg-amber-50 text-amber-800 ring-amber-200",
  inferred: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  conflicting: "bg-rose-50 text-rose-700 ring-rose-200",
  stale: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

const basisStyles: Record<Milestone["basis"], string> = {
  "official-sla": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "official-estimate": "bg-sky-50 text-sky-700 ring-sky-200",
  community: "bg-amber-50 text-amber-800 ring-amber-200",
  estimate: "bg-zinc-100 text-zinc-600 ring-zinc-300",
  unknown: "bg-zinc-50 text-zinc-500 ring-zinc-200",
};

const severityStyles = {
  low: "bg-zinc-100 text-zinc-600",
  medium: "bg-amber-50 text-amber-800",
  high: "bg-orange-50 text-orange-700",
  critical: "bg-rose-50 text-rose-700",
} as const;

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}>
      {children}
    </span>
  );
}

function CommunityBadge() {
  return <Badge className={statusStyles.secondary}>{COMMUNITY_BADGE}</Badge>;
}

function Unknown() {
  return <span className="italic text-zinc-400">{UNKNOWN}</span>;
}

function ClaimText({ claim }: { claim: Claim | undefined }) {
  if (!claim) return <Unknown />;
  const src = claim.sources[0];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{claim.value}</span>
      <Badge className={statusStyles[claim.status]}>
        {claim.status}
        {claim.testKind ? ` · ${claim.testKind}` : ""}
      </Badge>
      {claim.status === "secondary" ? <CommunityBadge /> : null}
      {src ? (
        <a href={src.url} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
          source
        </a>
      ) : null}
    </span>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 id={`${id}-h`} className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-6 text-zinc-700">{children}</div>
    </section>
  );
}

function List({ items }: { items: ReactNode[] }) {
  if (items.length === 0) return <Unknown />;
  return <ul className="list-disc space-y-1.5 pl-5">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>;
}

export function GuideView({ guide, mock = false }: { guide: Guide; mock?: boolean }) {
  const { app } = guide;
  const d = isDifficultyUnknown(guide) ? null : difficulty(guide.gates, { profile: guide.verdict.profile });
  const alternates = alternateProfiles(guide).map((p) => ({ profile: p, result: difficulty(guide.gates, { profile: p }) }));
  const live = isLiveGenerated(guide);
  const oc = guide.oauthConfig;

  return (
    <article className="space-y-6">
      {mock ? (
        <div role="status" className="rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-4 py-3 text-sm font-semibold text-fuchsia-800">
          MOCK MODE — fixture data, not a real research run.
        </div>
      ) : null}
      {live ? (
        <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Live-generated — verify.</strong> An agent drafted this guide. Check the sources before relying on it.
        </div>
      ) : null}
      {guide.partial ? (
        <div role="status" className="rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm text-zinc-800">
          <strong>Partial guide.</strong> Generation stopped early; missing sections show as unknown.
        </div>
      ) : null}

      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">{app.category}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">{app.name}</h1>
          <p className="mt-2 text-sm text-zinc-600">
            <a href={app.website} target="_blank" rel="noreferrer" className="underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900">
              {app.website}
            </a>
            {" · "}v{guide.version} · last verified {guide.lastVerified} · <span className="capitalize">{app.tier}</span>
          </p>
        </div>
        <ShareButtons markdown={guideToMarkdown(guide)} />
      </header>

      <section
        data-testid="composio-box"
        aria-labelledby="own-app-h"
        className="rounded-2xl border border-violet-200 bg-violet-50/60 p-5 sm:p-6"
      >
        <h2 id="own-app-h" className="text-lg font-semibold text-zinc-950">Do you need your own OAuth app?</h2>
        <p className="mt-2 text-sm text-zinc-800">
          <strong>Composio managed: {app.composio.managed}</strong>{" "}
          <span className="text-zinc-500">(checked {app.composio.checkedAt})</span>. {MANAGED_VERDICT[app.composio.managed]}
        </p>
        <p className="mt-4 text-sm font-medium text-zinc-900">Bring your own app when:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {[...OWN_APP_TRIGGERS, ...guide.ownApp.triggers].map((t) => <li key={t}>{t}</li>)}
        </ul>
        {guide.ownApp.notes ? <p className="mt-3 text-sm text-zinc-700">{guide.ownApp.notes}</p> : null}
        <p className="mt-4 text-sm text-zinc-800"><strong>Redirect URI:</strong> {REDIRECT_URI_NOTE}</p>
        <p className="mt-2 text-sm text-zinc-700">{SWITCH_NOTE}</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {OWN_APP_SOURCES.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-zinc-900">
              {s.title} ↗
            </a>
          ))}
        </p>
      </section>

      <Section id="verdict" title="Verdict">
        <p className="text-lg font-medium text-zinc-950">{guide.verdict.summary}</p>
        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-zinc-500">Difficulty</dt>
            <dd className="mt-1 font-semibold text-zinc-900" data-testid="difficulty">{d ? `${d.score}/5 · ${d.label}` : DIFFICULTY_UNKNOWN}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Approval</dt>
            <dd className="mt-1 font-semibold capitalize text-zinc-900">{humanize(guide.verdict.approvalModel)}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Confidence</dt>
            <dd className="mt-1 font-semibold capitalize text-zinc-900">{guide.confidence}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Test before approval</dt>
            <dd className="mt-1 font-semibold text-zinc-900">
              {guide.verdict.canTestBeforeApproval === "unknown" ? <Unknown /> : guide.verdict.canTestBeforeApproval ? "Yes" : "No"}
            </dd>
          </div>
        </dl>
        {d ? (
          <>
            <p className="mt-5 text-xs font-medium text-zinc-500">Why this score</p>
            <List items={d.rationale} />
          </>
        ) : (
          <p className="mt-5 text-sm text-zinc-600">No gates were extracted before generation stopped, so difficulty cannot be scored.</p>
        )}
        {alternates.map(({ profile, result }) => (
          <p key={profile} className="mt-2 text-sm text-zinc-700">
            <strong>{profile} path:</strong> {result.score}/5 · {result.label}
          </p>
        ))}
      </Section>

      <section aria-label="Milestones" className="grid gap-3 sm:grid-cols-3">
        {guide.milestones.map((m) => (
          <div key={m.id} data-testid="milestone" className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{MILESTONE_LABELS[m.id]}</p>
            <p className="mt-2 text-sm text-zinc-800">{m.definition}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Hands-on</dt>
                <dd className="font-semibold text-zinc-900">{milestoneHours(m)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Wait</dt>
                <dd className="font-semibold text-zinc-900">{milestoneWait(m)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge className={basisStyles[m.basis]}>basis: {humanize(m.basis)}</Badge>
              {m.basis === "community" ? <CommunityBadge /> : null}
            </div>
            {m.limitsUntilNext.length ? (
              <div className="mt-3 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                <p className="font-medium text-zinc-700">Limits until next</p>
                <ul className="mt-1 space-y-1">
                  {m.limitsUntilNext.map((c, i) => <li key={i}><ClaimText claim={c} /></li>)}
                </ul>
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <Section id="next-actions" title="Next actions">
        <List
          items={guide.steps.slice(0, 3).map((s) => (
            <>
              <strong className="text-zinc-900">{s.title}</strong> <span className="text-zinc-500">({s.owner})</span> — done when: {s.doneWhen}
            </>
          ))}
        />
      </Section>

      <Section id="blockers" title="Blockers">
        <List
          items={guide.blockers.map((b) => (
            <>
              <span className={`mr-2 rounded px-1.5 py-0.5 text-xs font-medium ${severityStyles[b.severity]}`}>{b.severity}</span>
              {b.description} <span className="text-zinc-500">({MILESTONE_LABELS[b.affects]})</span>
              {b.workaround ? <span className="block text-zinc-600">Workaround: {b.workaround}</span> : null}
              {b.agentCanHelp ? <span className="block text-xs text-emerald-700">An agent can help with this.</span> : null}
            </>
          ))}
        />
      </Section>

      <Section id="requirements" title="Before you start">
        <List
          items={guide.requirements.map((r) => (
            <>
              <strong className="text-zinc-900">{r.label}</strong> <span className="text-zinc-500">({r.owner} · {MILESTONE_LABELS[r.requiredFor]})</span>: {r.detail}
            </>
          ))}
        />
      </Section>

      <Section id="gates" title="Gates">
        <List
          items={guide.gates.map((g) => (
            <>
              <strong className="text-zinc-900">{g.name}</strong>{" "}
              <span className="text-zinc-500">({humanize(g.type)})</span>
              <span className="block text-zinc-600">
                Applies when: {g.appliesWhen}.{" "}
                {g.requiredFor.length ? `Required for ${g.requiredFor.map((id) => MILESTONE_LABELS[id]).join(", ")}.` : "Conditional — not scored."}
                {g.skipForProfiles?.length ? ` Skipped for: ${g.skipForProfiles.join(", ")}.` : ""}
              </span>
              {g.duration ? <span className="block">Duration: <ClaimText claim={g.duration} /></span> : null}
              {g.cost ? <span className="block">Cost: <ClaimText claim={g.cost} /></span> : null}
              {g.recurring ? <span className="block">Recurring: <ClaimText claim={g.recurring} /></span> : null}
            </>
          ))}
        />
      </Section>

      <Section id="scopes" title="Scopes">
        {guide.scopes.length === 0 ? (
          <Unknown />
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="px-1 py-2 font-medium">Scope</th>
                  <th className="px-1 py-2 font-medium">Sensitivity</th>
                  <th className="px-1 py-2 font-medium">Why</th>
                  <th className="px-1 py-2 font-medium">Review trigger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {guide.scopes.map((s) => (
                  <tr key={s.name} className="align-top">
                    <td className="px-1 py-2 font-mono text-xs break-all">{s.name}</td>
                    <td className="px-1 py-2 capitalize">{s.sensitivity}</td>
                    <td className="px-1 py-2">
                      {s.whyNeeded}
                      {s.justificationDraft ? <span className="block text-xs text-zinc-500">Draft: {s.justificationDraft}</span> : null}
                    </td>
                    <td className="px-1 py-2">{s.reviewTrigger}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section id="steps" title="Setup steps">
        {guide.steps.length === 0 ? (
          <Unknown />
        ) : (
          <ol className="list-decimal space-y-3 pl-5">
            {guide.steps.map((s) => (
              <li key={s.id}>
                <strong className="text-zinc-900">{s.title}</strong>{" "}
                <span className="text-zinc-500">
                  ({s.phase} · {s.owner}{s.timeMinutes !== undefined ? ` · ~${s.timeMinutes} min` : ""})
                </span>
                <ul className="mt-1 list-disc pl-5 text-zinc-600">
                  {s.actions.map((a) => <li key={a}>{a}</li>)}
                </ul>
                <span className="block text-xs text-zinc-500">Done when: {s.doneWhen}</span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section id="oauth-config" title="OAuth configuration">
        <dl className="space-y-2">
          <div><dt className="inline font-medium text-zinc-900">Redirect URIs: </dt><dd className="inline">{oc.redirectUris.length ? oc.redirectUris.map((c, i) => <ClaimText key={i} claim={c} />) : <Unknown />}</dd></div>
          <div><dt className="inline font-medium text-zinc-900">PKCE: </dt><dd className="inline"><ClaimText claim={oc.pkce} /></dd></div>
          <div><dt className="inline font-medium text-zinc-900">Token lifetime: </dt><dd className="inline"><ClaimText claim={oc.tokenLifetime} /></dd></div>
          <div><dt className="inline font-medium text-zinc-900">Refresh: </dt><dd className="inline"><ClaimText claim={oc.refresh} /></dd></div>
          <div><dt className="inline font-medium text-zinc-900">Rate limits: </dt><dd className="inline">{oc.rateLimits.length ? oc.rateLimits.map((c, i) => <ClaimText key={i} claim={c} />) : <Unknown />}</dd></div>
        </dl>
      </Section>

      <Section id="handoff" title="Agent vs. human">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 font-medium text-zinc-900">Agent can do</p>
            <List items={guide.agentTasks} />
          </div>
          <div>
            <p className="mb-2 font-medium text-zinc-900">Human must do</p>
            <List items={guide.humanTasks} />
          </div>
        </div>
      </Section>

      <Section id="probes" title="Probe results">
        <List
          items={guide.probes.map((p) => (
            <>
              <code className="break-all text-xs">{p.method} {p.url}</code> → <strong>{p.status}</strong>
              {p.redirect ? <span className="break-all"> → {p.redirect}</span> : null}
              <span className="block text-zinc-600">{p.observed} <span className="text-xs text-zinc-400">({p.at})</span></span>
            </>
          ))}
        />
      </Section>

      <Section id="evidence" title="Evidence">
        <List
          items={guide.evidence.map((e) => (
            <>
              <span className="text-xs text-zinc-400">[{e.id}]</span> {e.claim}{" "}
              <Badge className={statusStyles[e.status]}>{e.status}</Badge>{" "}
              <span className="text-xs text-zinc-500">{e.confidence} confidence</span>
              {e.status === "secondary" ? <> <CommunityBadge /></> : null}
              {e.quote ? <blockquote className="mt-1 border-l-2 border-zinc-200 pl-3 text-zinc-600">{e.quote}</blockquote> : null}
              <a href={e.sourceUrl} target="_blank" rel="noreferrer" className="block break-all text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-900">
                {e.sourceUrl}
              </a>
              <span className="text-xs text-zinc-400">{e.sourceType} · retrieved {e.retrievedAt}</span>
            </>
          ))}
        />
      </Section>

      <Section id="unknowns" title="Unknowns">
        <List items={guide.unknowns} />
      </Section>

      {guide.corrections.length ? (
        <Section id="corrections" title="Corrections">
          <List
            items={guide.corrections.map((c) => (
              <>
                {c.date}: {c.claim} — <s className="text-zinc-400">{c.before}</s> → {c.after}{" "}
                <span className="text-zinc-500">({c.reason})</span>
              </>
            ))}
          />
        </Section>
      ) : null}
    </article>
  );
}
