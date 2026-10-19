import { createDeps, isMockMode, pipelineOptionsFromEnv } from "@/lib/agent/deps";
import { runPipeline } from "@/lib/agent/pipeline";
import type { PipelineInput, RunEvent } from "@/lib/agent/types";

// SPEC §9.15: give the function room past the 150 s soft deadline. [verify Vercel plan limit]
export const maxDuration = 300;

type Body = { query?: unknown; slug?: unknown; force?: unknown };

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "Expected a JSON body" }, { status: 400 });
  }
  const query = typeof body.query === "string" ? body.query.trim().slice(0, 200) : "";
  const slug = typeof body.slug === "string" ? body.slug : undefined;
  if (!query && !slug) return Response.json({ error: "Enter an app name or URL." }, { status: 400 });

  const input: PipelineInput = { query: query || slug!, slug, runId: crypto.randomUUID(), force: body.force === true };
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(sse(event, data)));
        } catch {
          // Client went away; the run keeps going and is persisted.
          open = false;
        }
      };
      send("run", { runId: input.runId, mock: isMockMode() });
      try {
        const deps = await createDeps((e: RunEvent) => send("step", e));
        const run = await runPipeline(input, deps, pipelineOptionsFromEnv());
        send("done", { runId: run.runId, status: run.status, guideSlug: run.guideSlug, error: run.error });
      } catch (e) {
        send("done", { runId: input.runId, status: "failed", error: e instanceof Error ? e.message : String(e) });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
