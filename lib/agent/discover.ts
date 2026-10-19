import { fetchDoc, type FetchDocOptions } from "@/lib/agent/fetchDoc";
import type { ResolvedApp } from "@/lib/agent/resolve";
import type { FetchedDoc, LlmAdapter } from "@/lib/agent/types";
import { withTimeout } from "@/lib/agent/extract";

export type DiscoverResult = {
  docs: FetchedDoc[];
  citedUrls: string[];
  failed: { url: string; reason: "unreachable" | "login-wall"; detail: string }[];
  researchError?: string;
  stoppedEarly: boolean;
};

export const MAX_FETCHED_DOCS = 6;

export async function discover(
  resolved: ResolvedApp,
  deps: { llm: LlmAdapter; fetchOpts: FetchDocOptions; remainingMs: () => number; onProgress: (msg: string) => void },
): Promise<DiscoverResult> {
  const hints = [resolved.docsUrl, resolved.consoleUrl].filter((u): u is string => !!u);
  const out: DiscoverResult = { docs: [], citedUrls: [], failed: [], stoppedEarly: false };

  try {
    const research = await withTimeout(
      deps.llm.research({ query: `${resolved.name} (${resolved.website})`, hints }),
      deps.remainingMs(),
      "research",
    );
    out.docs.push(...research.docs);
    out.citedUrls = research.citedUrls;
    deps.onProgress(`Research returned ${research.docs.length} docs and ${research.citedUrls.length} cited URLs`);
  } catch (e) {
    out.researchError = e instanceof Error ? e.message : String(e);
    deps.onProgress(`Research failed: ${out.researchError}`);
  }

  const have = new Set(out.docs.map((d) => d.url));
  const queue = [...new Set([...hints, ...out.citedUrls])].filter((u) => !have.has(u) && /^https?:\/\//.test(u));

  for (const url of queue) {
    if (out.docs.length >= MAX_FETCHED_DOCS) break;
    if (deps.remainingMs() <= 0) {
      out.stoppedEarly = true;
      deps.onProgress("Soft deadline reached; stopping discovery");
      break;
    }
    const r = await fetchDoc(url, deps.fetchOpts);
    if (r.ok) {
      out.docs.push(r.doc);
      deps.onProgress(`Fetched ${url} (${r.via}, ${r.doc.text.length} chars)`);
    } else {
      out.failed.push({ url, reason: r.reason, detail: r.detail });
      deps.onProgress(`${r.reason === "login-wall" ? "Login wall" : "Unreachable"}: ${url}`);
    }
  }
  return out;
}
