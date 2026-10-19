// Pipeline contracts (interfaces only). Implementations live in lib/agent/* (T-005).
import type { Guide, Probe } from "@/lib/schema";

export type PipelineStep =
  | "resolve"
  | "composio"
  | "discover"
  | "probe"
  | "extract"
  | "verify"
  | "render";

export interface PipelineInput {
  // App name or URL as typed by the user.
  query: string;
  // Set when the user picked a known seed app.
  slug?: string;
  runId: string;
  // Skip the demo cache and regenerate.
  force?: boolean;
}

export interface RunEvent {
  step: PipelineStep;
  status: "start" | "progress" | "done" | "error" | "skipped";
  message: string;
  data?: unknown;
  at: string;
}

export interface FetchedDoc {
  url: string;
  title?: string;
  text: string;
  fetchedAt: string;
}

export interface ResearchResult {
  docs: FetchedDoc[];
  // Grounding/search URLs the model cited, even if not fetched.
  citedUrls: string[];
}

export interface ExtractInput {
  query: string;
  docs: FetchedDoc[];
  probes: Probe[];
  composio: Guide["app"]["composio"];
}

// Optional per-call bounds from the pipeline. Adapters may ignore them; the pipeline still races its deadlines.
export interface LlmCallOptions {
  // Absolute epoch ms the call must finish by.
  deadlineAt?: number;
  // Fires when the pipeline abandons the call; forward it so the HTTP request is cancelled.
  signal?: AbortSignal;
}

export interface LlmAdapter {
  research(input: { query: string; hints?: string[] }, opts?: LlmCallOptions): Promise<ResearchResult>;
  // Returns an unvalidated guide draft; the pipeline validates it with guideSchema.
  extract(input: ExtractInput, opts?: LlmCallOptions): Promise<unknown>;
}

export interface RunRecord {
  runId: string;
  input: PipelineInput;
  status: "running" | "done" | "failed" | "partial";
  events: RunEvent[];
  guideSlug?: string;
  // The guide this run produced; guide:{slug} only holds the latest one.
  guide?: Guide;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export interface Store {
  getRun(runId: string): Promise<RunRecord | null>;
  putRun(run: RunRecord): Promise<void>;
  getGuide(slug: string): Promise<Guide | null>;
  putGuide(guide: Guide): Promise<void>;
  // Increments a rate-limit counter and returns the count within the window.
  incrRate(key: string, windowSeconds: number): Promise<number>;
}

export interface PipelineDeps {
  fetch: typeof globalThis.fetch;
  llm: LlmAdapter;
  store: Store;
  now: () => Date;
  emit: (event: RunEvent) => void;
}
