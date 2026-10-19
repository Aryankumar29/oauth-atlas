import { fetchWithTimeout } from "@/lib/agent/fetchDoc";
import {
  COMPOSIO_SOURCES,
  composioSnapshot,
  managedStatus,
  normalizeToolkitSlug,
  parseManagedAuthMarkdown,
} from "@/lib/composio";
import type { ComposioInfo, Managed } from "@/lib/schema";

export type ComposioStepResult = {
  info: ComposioInfo;
  source: "toolkit-api" | "live-directory" | "snapshot";
  sourceUrl: string;
  detail: string;
};

type Opts = {
  fetch: typeof globalThis.fetch;
  now: () => Date;
  apiKey?: string;
  timeoutMs?: number;
};

const today = (d: Date) => d.toISOString().slice(0, 10);

// SPEC §5.1: toolkit API (if keyed) → live managed-auth.md → bundled snapshot.
export async function lookupComposio(toolkitSlug: string, opts: Opts): Promise<ComposioStepResult> {
  const slug = normalizeToolkitSlug(toolkitSlug);
  const timeoutMs = opts.timeoutMs ?? 5000;
  const notes: string[] = [];

  if (opts.apiKey) {
    try {
      const res = await fetchWithTimeout(
        opts.fetch,
        COMPOSIO_SOURCES.toolkitApi(slug),
        { headers: { "x-api-key": opts.apiKey, Accept: "application/json" } },
        timeoutMs,
      );
      if (res.ok) {
        const body = (await res.json()) as { composio_managed_auth_schemes?: unknown[] };
        const managed: Managed = Array.isArray(body.composio_managed_auth_schemes)
          ? body.composio_managed_auth_schemes.length > 0
            ? "yes"
            : "no"
          : "unknown";
        return {
          info: { toolkitSlug: slug, managed, checkedAt: today(opts.now()) },
          source: "toolkit-api",
          sourceUrl: COMPOSIO_SOURCES.toolkitApi(slug),
          detail: `Toolkit API: composio_managed_auth_schemes → ${managed}`,
        };
      }
      notes.push(`toolkit API HTTP ${res.status}`);
    } catch (e) {
      notes.push(`toolkit API failed: ${String(e)}`);
    }
  }

  try {
    const res = await fetchWithTimeout(
      opts.fetch,
      COMPOSIO_SOURCES.managedAuthMarkdown,
      { headers: { Accept: "text/markdown,text/plain" } },
      timeoutMs,
    );
    if (res.ok) {
      const parsed = parseManagedAuthMarkdown(await res.text());
      if (parsed.managed.length + parsed.byo.length > 0) {
        const managed: Managed = parsed.managed.includes(slug)
          ? "yes"
          : parsed.byo.includes(slug)
            ? "no"
            : "unknown";
        return {
          info: { toolkitSlug: slug, managed, checkedAt: today(opts.now()) },
          source: "live-directory",
          sourceUrl: COMPOSIO_SOURCES.managedAuth,
          detail: `Live directory (${parsed.managed.length} managed, ${parsed.byo.length} bring-your-own): ${managed}`,
        };
      }
      notes.push("live directory parsed empty");
    } else {
      notes.push(`live directory HTTP ${res.status}`);
    }
  } catch (e) {
    notes.push(`live directory failed: ${String(e)}`);
  }

  const managed = managedStatus(slug);
  return {
    info: { toolkitSlug: slug, managed, checkedAt: composioSnapshot.checkedAt },
    source: "snapshot",
    sourceUrl: composioSnapshot.source,
    detail: `Snapshot from ${composioSnapshot.checkedAt}: ${managed}${notes.length ? ` (${notes.join("; ")})` : ""}`,
  };
}
