import type { FetchedDoc } from "@/lib/agent/types";

// SPEC §9.9 fallback chain: plain → browser UA → reader (optional) → unreachable.

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
// Meta (developers.facebook.com) answers 400 to a full Chrome UA but 200 to this.
export const MINIMAL_BROWSER_UA = "Mozilla/5.0";
export const PLAIN_UA = "OAuthAtlasBot/0.1 (+https://github.com/Aryankumar29)";

export type FetchVia = "plain" | "browser-ua" | "reader";

export type FetchDocResult =
  | { ok: true; doc: FetchedDoc; via: FetchVia; status: number }
  | { ok: false; url: string; reason: "unreachable" | "login-wall"; detail: string };

export type FetchDocOptions = {
  fetch: typeof globalThis.fetch;
  now: () => Date;
  timeoutMs?: number;
  // Reader service (r.jina.ai). Off unless explicitly enabled.
  reader?: { enabled: boolean; apiKey?: string };
  maxChars?: number;
};

const LOGIN_PATH = /\/(login|signin|sign-in|sign_in|auth\/login|session)(\b|\/|\?|$)/i;

export async function fetchWithTimeout(
  f: typeof globalThis.fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await f(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function htmlToText(html: string): { title?: string; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|nav|footer)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v\r]+/g, " ")
    .replace(/\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title: title ? decodeEntities(title) : undefined, text };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function looksLikeLoginWall(res: Response, requested: string, text: string): boolean {
  const finalUrl = res.url || requested;
  if (finalUrl !== requested && LOGIN_PATH.test(new URL(finalUrl).pathname)) return true;
  // Short page dominated by a sign-in form.
  return text.length < 1500 && /(sign in|log in)/i.test(text) && /password/i.test(text);
}

async function attempt(
  url: string,
  ua: string,
  opts: FetchDocOptions,
): Promise<{ res: Response; body: string } | { error: string }> {
  try {
    const res = await fetchWithTimeout(
      opts.fetch,
      url,
      { headers: { "User-Agent": ua, Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.8" }, redirect: "follow" },
      opts.timeoutMs ?? 8000,
    );
    return { res, body: await res.text() };
  } catch (e) {
    return { error: e instanceof Error && e.name === "AbortError" ? "timeout" : String(e) };
  }
}

function toDoc(url: string, body: string, contentType: string | null, opts: FetchDocOptions): FetchedDoc {
  const isHtml = !contentType || contentType.includes("html") || /^\s*</.test(body);
  const { title, text } = isHtml ? htmlToText(body) : { title: undefined, text: body.trim() };
  return { url, title, text: text.slice(0, opts.maxChars ?? 60_000), fetchedAt: opts.now().toISOString() };
}

export async function fetchDoc(url: string, opts: FetchDocOptions): Promise<FetchDocResult> {
  const failures: string[] = [];
  let loginWall = false;
  let lastStatus = 0;

  for (const [via, ua] of [
    ["plain", PLAIN_UA],
    ["browser-ua", BROWSER_UA],
    ["browser-ua", MINIMAL_BROWSER_UA],
  ] as const) {
    if (ua === MINIMAL_BROWSER_UA && lastStatus !== 400 && lastStatus !== 403) break;
    const r = await attempt(url, ua, opts);
    if ("error" in r) {
      lastStatus = 0;
      failures.push(`${via}: ${r.error}`);
      continue;
    }
    lastStatus = r.res.status;
    if (!r.res.ok) {
      failures.push(`${via}${ua === MINIMAL_BROWSER_UA ? " (minimal)" : ""}: HTTP ${r.res.status}`);
      continue;
    }
    // Final URL after redirects (search-grounding links are redirect wrappers).
    const doc = toDoc(r.res.url || url, r.body, r.res.headers.get("content-type"), opts);
    if (looksLikeLoginWall(r.res, url, doc.text)) {
      loginWall = true;
      failures.push(`${via}: login wall`);
      break;
    }
    if (doc.text.length < 200 && via === "plain") {
      // Likely JS-rendered or a bot interstitial; try again as a browser.
      failures.push(`${via}: near-empty body`);
      continue;
    }
    return { ok: true, doc, via, status: r.res.status };
  }

  if (opts.reader?.enabled) {
    const headers: Record<string, string> = { Accept: "text/plain" };
    if (opts.reader.apiKey) headers.Authorization = `Bearer ${opts.reader.apiKey}`;
    try {
      const res = await fetchWithTimeout(opts.fetch, `https://r.jina.ai/${url}`, { headers }, opts.timeoutMs ?? 8000);
      const body = await res.text();
      if (res.ok && body.trim().length >= 200) {
        return { ok: true, doc: toDoc(url, body, "text/plain", opts), via: "reader", status: res.status };
      }
      failures.push(`reader: HTTP ${res.status}`);
    } catch (e) {
      failures.push(`reader: ${String(e)}`);
    }
  }

  return { ok: false, url, reason: loginWall ? "login-wall" : "unreachable", detail: failures.join("; ") };
}
