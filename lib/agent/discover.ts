import { fetchDoc, type FetchDocOptions } from "@/lib/agent/fetchDoc";
import type { ResolvedApp } from "@/lib/agent/resolve";
import type { FetchedDoc, LlmAdapter, LlmCallOptions } from "@/lib/agent/types";
import { TimeoutError, withTimeout } from "@/lib/agent/extract";
import { LlmError } from "@/lib/agent/llm/errors";

export type DiscoverResult = {
  docs: FetchedDoc[];
  citedUrls: string[];
  failed: { url: string; reason: "unreachable" | "login-wall"; detail: string }[];
  researchError?: string;
  // Research ended because of a deadline (pipeline timeout or adapter cancellation), not a hard failure.
  researchTimedOut: boolean;
  stoppedEarly: boolean;
};

export const MAX_FETCHED_DOCS = 6;
const FETCH_CONCURRENCY = 3;

export async function discover(
  resolved: ResolvedApp,
  deps: {
    llm: LlmAdapter;
    fetchOpts: FetchDocOptions;
    remainingMs: () => number;
    onProgress: (msg: string) => void;
    llmOpts?: LlmCallOptions;
  },
): Promise<DiscoverResult> {
  const hints = [resolved.docsUrl, resolved.consoleUrl].filter((u): u is string => !!u);
  const out: DiscoverResult = { docs: [], citedUrls: [], failed: [], stoppedEarly: false, researchTimedOut: false };

  try {
    const research = await withTimeout(
      deps.llm.research({ query: `${resolved.name} (${resolved.website})`, hints }, deps.llmOpts),
      deps.remainingMs(),
      "research",
    );
    out.docs.push(...research.docs);
    out.citedUrls = research.citedUrls;
    deps.onProgress(`Research returned ${research.docs.length} docs and ${research.citedUrls.length} cited URLs`);
  } catch (e) {
    out.researchError = e instanceof Error ? e.message : String(e);
    // Typed check first; the message fallback covers adapters that throw plain errors.
    out.researchTimedOut =
      e instanceof TimeoutError || (e instanceof LlmError && e.kind === "timeout") || /timed out/i.test(out.researchError);
    deps.onProgress(`Research failed: ${out.researchError}`);
  }

  const have = new Set(out.docs.map((d) => d.url));
  const queue = [...new Set([...hints, ...out.citedUrls])].filter((u) => !have.has(u) && /^https?:\/\//.test(u));

  // Small parallel batches keep worst-case latency inside the soft deadline.
  for (let i = 0; i < queue.length && out.docs.length < MAX_FETCHED_DOCS; ) {
    if (deps.remainingMs() <= 0) {
      out.stoppedEarly = true;
      deps.onProgress("Soft deadline reached; stopping discovery");
      break;
    }
    const batch = queue.slice(i, i + Math.min(FETCH_CONCURRENCY, MAX_FETCHED_DOCS - out.docs.length));
    i += batch.length;
    const results = await Promise.all(batch.map((url) => fetchDoc(url, deps.fetchOpts)));
    results.forEach((r, j) => {
      const url = batch[j];
      if (r.ok) {
        if (!out.docs.some((d) => d.url === r.doc.url)) out.docs.push(r.doc);
        deps.onProgress(`Fetched ${url} (${r.via}, ${r.doc.text.length} chars)`);
      } else {
        out.failed.push({ url, reason: r.reason, detail: r.detail });
        deps.onProgress(`${r.reason === "login-wall" ? "Login wall" : "Unreachable"}: ${url}`);
      }
    });
  }
  return out;
}
