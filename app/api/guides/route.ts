import { API_HEADERS, listApps } from "@/lib/api";

// Every tracked app with its guide summary. Built from the bundled library, so it is prerendered.
export async function GET() {
  const items = listApps();
  return Response.json({ count: items.length, apps: items }, { headers: API_HEADERS });
}
