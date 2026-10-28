import type { NextRequest } from "next/server";

import { API_HEADERS, guidePayload, lookupGuide } from "@/lib/api";
import { guideToMarkdown } from "@/lib/markdown";
import { getStore } from "@/lib/store";

// One app's guide as JSON, or Markdown with ?format=md. {app} may be a slug, a name or a URL.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/guides/[app]">) {
  const { app } = await ctx.params;
  const result = await lookupGuide(app, await getStore());
  if (!result.found) {
    return Response.json(
      { error: `No guide for "${result.slug}" yet. Generate one, then fetch this URL again.`, generateUrl: result.generateUrl },
      { status: 404, headers: API_HEADERS },
    );
  }
  if (request.nextUrl.searchParams.get("format") === "md") {
    return new Response(guideToMarkdown(result.guide), { headers: { ...API_HEADERS, "Content-Type": "text/markdown; charset=utf-8" } });
  }
  return Response.json(guidePayload(result.source, result.guide), { headers: API_HEADERS });
}
