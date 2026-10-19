import { difficulty } from "@/lib/difficulty";
import { formatHours, formatWait, humanize, UNKNOWN } from "@/lib/format";
import {
  alternateProfiles,
  COMMUNITY_BADGE,
  isLiveGenerated,
  MANAGED_VERDICT,
  MILESTONE_LABELS,
  OWN_APP_SOURCES,
  OWN_APP_TRIGGERS,
  REDIRECT_URI_NOTE,
  SWITCH_NOTE,
} from "@/lib/guide-content";
import type { Claim, Guide } from "@/lib/schema";

function claim(c: Claim | undefined): string {
  if (!c) return UNKNOWN;
  const badge = c.status === "secondary" ? `, ${COMMUNITY_BADGE.toLowerCase()}` : "";
  const kind = c.testKind ? ` ${c.testKind}` : "";
  const src = c.sources[0] ? ` — ${c.sources[0].url}` : "";
  return `${c.value} _(${c.status}${kind}${badge})_${src}`;
}

function list(items: string[]): string[] {
  return items.length ? items.map((i) => `- ${i}`) : [`- ${UNKNOWN}`];
}

export function guideToMarkdown(guide: Guide): string {
  const { app } = guide;
  const d = difficulty(guide.gates, { profile: guide.verdict.profile });
  const out: string[] = [];

  out.push(`# ${app.name} OAuth guide`, "");
  out.push(
    `${app.website} · v${guide.version} · last verified ${guide.lastVerified} · confidence ${guide.confidence} · tier ${app.tier}`,
    "",
  );
  if (isLiveGenerated(guide)) out.push("> **Live-generated — verify** before relying on these claims.", "");
  if (guide.partial) out.push("> **Partial:** generation stopped early. Missing sections are marked unknown.", "");

  out.push("## Do you need your own OAuth app?", "");
  out.push(`**Composio managed:** ${app.composio.managed} (checked ${app.composio.checkedAt}). ${MANAGED_VERDICT[app.composio.managed]}`, "");
  out.push("Bring your own app when:");
  out.push(...list([...OWN_APP_TRIGGERS, ...guide.ownApp.triggers]));
  if (guide.ownApp.notes) out.push("", guide.ownApp.notes);
  out.push("", `**Redirect URI:** ${REDIRECT_URI_NOTE}`, "", SWITCH_NOTE, "");
  out.push("Sources:", ...OWN_APP_SOURCES.map((s) => `- [${s.title}](${s.url})`), "");

  out.push("## Verdict", "");
  out.push(`**Difficulty ${d.score}/5 — ${d.label}.** ${guide.verdict.summary}`, "");
  out.push(...d.rationale.map((r) => `- ${r}`));
  for (const p of alternateProfiles(guide)) {
    const alt = difficulty(guide.gates, { profile: p });
    out.push(`- ${p} path: ${alt.score}/5 (${alt.label})`);
  }
  out.push(
    "",
    `- Approval model: ${humanize(guide.verdict.approvalModel)}`,
    `- Can test before approval: ${String(guide.verdict.canTestBeforeApproval)}`,
    "",
  );

  out.push("## Milestones", "");
  out.push("| Milestone | Definition | Hands-on | Wait | Basis |", "|---|---|---|---|---|");
  for (const m of guide.milestones) {
    const basis = m.basis === "community" ? `community (${COMMUNITY_BADGE.toLowerCase()})` : m.basis;
    out.push(`| ${MILESTONE_LABELS[m.id]} | ${m.definition} | ${formatHours(m.handsOnHours)} | ${formatWait(m.wait)} | ${basis} |`);
  }
  for (const m of guide.milestones) {
    if (m.limitsUntilNext.length) {
      out.push("", `Limits at ${MILESTONE_LABELS[m.id]}:`, ...m.limitsUntilNext.map((c) => `- ${claim(c)}`));
    }
  }
  out.push("");

  out.push("## Next actions", "");
  out.push(...list(guide.steps.slice(0, 3).map((s) => `**${s.title}** (${s.owner}) — done when: ${s.doneWhen}`)), "");

  out.push("## Blockers", "");
  out.push(
    ...list(
      guide.blockers.map(
        (b) =>
          `**${b.severity}** (${b.affects}): ${b.description}${b.workaround ? ` Workaround: ${b.workaround}` : ""}${b.agentCanHelp ? " _Agent can help._" : ""}`,
      ),
    ),
    "",
  );

  out.push("## Before you start", "");
  out.push(...list(guide.requirements.map((r) => `**${r.label}** (${r.owner}, ${r.requiredFor}): ${r.detail}`)), "");

  out.push("## Gates", "");
  out.push(
    ...list(
      guide.gates.map((g) => {
        const req = g.requiredFor.length ? g.requiredFor.join(", ") : "conditional, not scored";
        const extras = [
          g.duration && `duration: ${claim(g.duration)}`,
          g.cost && `cost: ${claim(g.cost)}`,
          g.recurring && `recurring: ${claim(g.recurring)}`,
        ].filter(Boolean);
        return `**${g.name}** (${g.type}; ${req}) — applies when: ${g.appliesWhen}${extras.length ? `; ${extras.join("; ")}` : ""}`;
      }),
    ),
    "",
  );

  out.push("## Scopes", "");
  if (guide.scopes.length) {
    out.push("| Scope | Sensitivity | Why | Review trigger |", "|---|---|---|---|");
    for (const s of guide.scopes) out.push(`| \`${s.name}\` | ${s.sensitivity} | ${s.whyNeeded} | ${s.reviewTrigger} |`);
  } else {
    out.push(`- ${UNKNOWN}`);
  }
  out.push("");

  out.push("## Setup steps", "");
  out.push(
    ...(guide.steps.length
      ? guide.steps.map(
          (s, i) =>
            `${i + 1}. **${s.title}** (${s.phase}, ${s.owner}${s.timeMinutes !== undefined ? `, ~${s.timeMinutes} min` : ""}): ${s.actions.join("; ")}. Done when: ${s.doneWhen}`,
        )
      : [`- ${UNKNOWN}`]),
    "",
  );

  const oc = guide.oauthConfig;
  out.push("## OAuth configuration", "");
  out.push(`- Redirect URIs: ${oc.redirectUris.length ? oc.redirectUris.map(claim).join("; ") : UNKNOWN}`);
  out.push(`- PKCE: ${claim(oc.pkce)}`);
  out.push(`- Token lifetime: ${claim(oc.tokenLifetime)}`);
  out.push(`- Refresh: ${claim(oc.refresh)}`);
  out.push(`- Rate limits: ${oc.rateLimits.length ? oc.rateLimits.map(claim).join("; ") : UNKNOWN}`, "");

  out.push("## Agent vs. human", "", "Agent:", ...list(guide.agentTasks), "", "Human:", ...list(guide.humanTasks), "");

  out.push("## Probe results", "");
  out.push(
    ...list(guide.probes.map((p) => `\`${p.method} ${p.url}\` → ${p.status}${p.redirect ? ` → ${p.redirect}` : ""}: ${p.observed} (${p.at})`)),
    "",
  );

  out.push("## Evidence", "");
  out.push(
    ...list(
      guide.evidence.map(
        (e) =>
          `[${e.id}] ${e.claim} — _${e.status}, ${e.confidence}_ — ${e.sourceUrl} (${e.retrievedAt})${e.quote ? `\n  > ${e.quote}` : ""}`,
      ),
    ),
    "",
  );

  out.push("## Unknowns", "", ...list(guide.unknowns), "");

  if (guide.corrections.length) {
    out.push("## Corrections", "");
    out.push(...guide.corrections.map((c) => `- ${c.date}: ${c.claim}: "${c.before}" → "${c.after}" (${c.reason})`), "");
  }

  return out.join("\n");
}
