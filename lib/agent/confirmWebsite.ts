import { BROWSER_UA, fetchWithTimeout } from "@/lib/agent/fetchDoc";
import type { ResolvedApp } from "@/lib/agent/resolve";
import { checkFetchUrlResolved, type DnsLookup } from "@/lib/agent/urlGuard";
import { registrable } from "@/lib/agent/validate";

// QA-19: a website guessed from a bare name (name → name.com) is not evidence of ownership, so its docs could never
// count as official. Confirm the guess instead: the homepage must name the app in its <title>, og:site_name or
// application-name, and any redirect must stay on the guessed registrable domain. Anything else stays unconfirmed.

export type WebsiteCheck = { confirmed: boolean; observed: string };

const MAX_HOPS = 3;

export function siteNames(html: string): string[] {
  const head = html.slice(0, 300_000);
  const title = head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
  const meta = (key: string) =>
    head.match(new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ??
    head.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`, "i"))?.[1];
  const decode = (s: string) =>
    s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
  return [title, meta("og:site_name"), meta("application-name")].filter((s): s is string => !!s?.trim()).map((s) => decode(s.trim()));
}

export function namesApp(names: string[], appName: string): boolean {
  const want = appName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!want) return false;
  return names.some((n) => ` ${n.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `.includes(` ${want} `));
}

export async function confirmGuessedWebsite(
  resolved: Pick<ResolvedApp, "name" | "website">,
  opts: { fetch: typeof globalThis.fetch; dnsLookup?: DnsLookup; timeoutMs?: number },
): Promise<WebsiteCheck> {
  let url = resolved.website;
  const domain = registrable(new URL(url).hostname);
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const check = await checkFetchUrlResolved(url, opts.dnsLookup);
      if (!check.ok) return { confirmed: false, observed: `Not fetched (${check.reason})` };
      if (registrable(check.url.hostname) !== domain) return { confirmed: false, observed: `Redirected off ${domain} to ${check.url.hostname}` };
      const res = await fetchWithTimeout(
        opts.fetch,
        url,
        { headers: { "User-Agent": BROWSER_UA, Accept: "text/html" }, redirect: "manual" },
        opts.timeoutMs ?? 5000,
      );
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        url = new URL(location, url).toString();
        continue;
      }
      if (!res.ok) return { confirmed: false, observed: `Homepage answered ${res.status}` };
      const names = siteNames(await res.text());
      return namesApp(names, resolved.name)
        ? { confirmed: true, observed: `Homepage ${new URL(url).hostname} names ${resolved.name} ("${names[0].slice(0, 80)}")` }
        : { confirmed: false, observed: `Homepage does not name ${resolved.name}${names.length ? ` ("${names[0].slice(0, 80)}")` : ""}` };
    }
    return { confirmed: false, observed: "Too many redirects" };
  } catch (e) {
    return { confirmed: false, observed: `Homepage check failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}
