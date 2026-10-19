import { COMPOSIO_SOURCES } from "@/lib/composio";
import type { EvidenceStatus, Guide, Managed, MilestoneId } from "@/lib/schema";

// Shared copy for GuideView and guideToMarkdown (SPEC §5.1).

export const OWN_APP_TRIGGERS = [
  "The consent screen must show your brand, not \"Composio\"",
  "You need custom scopes",
  "You need your own rate quota (managed apps share quota)",
  "You need polling faster than 15 minutes (the managed minimum)",
  "You connect to a custom or self-hosted instance",
  "Enterprise customers require your branding end-to-end",
] as const;

export const REDIRECT_URI_NOTE =
  "Copy the callback URL from the Composio dashboard (Create Auth Config); don't hard-code it.";

export const SWITCH_NOTE =
  "Switching to your own app affects new connections only. Existing connected accounts stay on the old auth config until users re-authenticate.";

export const OWN_APP_SOURCES = [
  { title: "Composio managed-auth directory", url: COMPOSIO_SOURCES.managedAuth },
  { title: "Custom app vs. managed app", url: COMPOSIO_SOURCES.customVsManaged },
  { title: "White-labeling authentication", url: COMPOSIO_SOURCES.whiteLabeling },
] as const;

export const MANAGED_VERDICT: Record<Managed, string> = {
  yes: "Composio-managed OAuth is available. You can start without your own OAuth app.",
  no: "Composio has no managed app for this toolkit. You need your own OAuth app.",
  unknown: "This toolkit is not in Composio's managed-auth directory. Assume you need your own OAuth app.",
};

export const MILESTONE_LABELS: Record<MilestoneId, string> = {
  "dev-ready": "Dev-ready",
  "pilot-ready": "Pilot-ready",
  "production-ready": "Production-ready",
};

export const STATUS_DESCRIPTIONS: Record<EvidenceStatus, string> = {
  tested: "We ran it: a dated setup attempt or a timestamped probe record.",
  primary: "Official provider docs, console, policy, pricing, or trust center.",
  secondary: "Community reports, changelogs, or reputable third parties. Reported by developers, not a commitment.",
  inferred: "Model reasoning. Labeled, never presented as fact.",
  conflicting: "Sources disagree. Both are shown.",
  stale: "Older than the 90-day freshness window. Re-check before relying on it.",
};

export const COMMUNITY_BADGE = "Reported by developers, not a commitment";

// Profiles mentioned in skipForProfiles, e.g. Gmail "send-only".
export function alternateProfiles(guide: Guide): string[] {
  const set = new Set<string>();
  for (const g of guide.gates) for (const p of g.skipForProfiles ?? []) set.add(p);
  if (guide.verdict.profile) set.delete(guide.verdict.profile);
  return [...set];
}

export function isLiveGenerated(guide: Guide): boolean {
  return guide.generatedBy === "agent" || guide.app.tier === "generated";
}
