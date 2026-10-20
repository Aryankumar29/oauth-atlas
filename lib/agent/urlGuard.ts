import { isIP } from "node:net";

// SSRF guard for every server-side fetch of a URL that came from user input, model output, a discovery
// document, or a redirect. Public https on the default port only.

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

// Resolves a hostname to all of its addresses. Injected so tests and MOCK_LLM never touch real DNS.
export type DnsLookup = (host: string) => Promise<string[]>;

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal"];

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKS: [string, number][] = [
  ["0.0.0.0", 8], // this network
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (cloud metadata)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
];

function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

// Expands an IPv6 literal to 8 hextets (handles "::" and a trailing dotted IPv4).
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = ipv4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined && tail ? tail.split(":") : [];
  const fill = s.includes("::") ? 8 - h.length - t.length : 0;
  const parts = [...h, ...Array(fill).fill("0"), ...t].map((x) => parseInt(x, 16));
  return parts.length === 8 && parts.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffff) ? parts : null;
}

function isPrivateV6(ip: string): boolean {
  const p = expandV6(ip);
  if (!p) return true; // unparseable: refuse
  if (p.every((x) => x === 0)) return true; // ::
  if (p.slice(0, 7).every((x) => x === 0) && p[7] === 1) return true; // ::1
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): judge the embedded IPv4.
  if (p.slice(0, 5).every((x) => x === 0) && (p[5] === 0xffff || p[5] === 0)) {
    return isPrivateV4(`${p[6] >> 8}.${p[6] & 0xff}.${p[7] >> 8}.${p[7] & 0xff}`);
  }
  if ((p[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((p[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((p[0] & 0xff00) === 0xff00) return true; // multicast
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return isPrivateV4(ip);
  if (v === 6) return isPrivateV6(ip);
  return true;
}

export function checkFetchUrl(raw: string): UrlCheck {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "not a URL" };
  }
  if (u.protocol !== "https:") return { ok: false, reason: `scheme ${u.protocol} not allowed` };
  if (u.username || u.password) return { ok: false, reason: "credentials in URL" };
  if (u.port !== "") return { ok: false, reason: `port ${u.port} not allowed` };
  // WHATWG URL already normalizes decimal/hex/octal IPv4 forms (https://2130706433 → 127.0.0.1).
  const host = u.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (isIP(host)) return isPrivateAddress(host) ? { ok: false, reason: `non-public address ${host}` } : { ok: true, url: u };
  if (host === "localhost" || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: `internal host ${host}` };
  }
  if (!host.includes(".")) return { ok: false, reason: `single-label host ${host}` };
  return { ok: true, url: u };
}

export function isSafeFetchUrl(raw: string): boolean {
  return checkFetchUrl(raw).ok;
}

// Static check plus, when a resolver is given, rejection if ANY resolved address is non-public.
export async function checkFetchUrlResolved(raw: string, lookup?: DnsLookup): Promise<UrlCheck> {
  const c = checkFetchUrl(raw);
  if (!c.ok || !lookup || isIP(c.url.hostname.replace(/^\[|\]$/g, ""))) return c;
  let addrs: string[];
  try {
    addrs = await lookup(c.url.hostname);
  } catch {
    return { ok: false, reason: `DNS lookup failed for ${c.url.hostname}` };
  }
  const bad = addrs.find(isPrivateAddress);
  if (!addrs.length || bad) return { ok: false, reason: `${c.url.hostname} resolves to non-public address ${bad ?? "(none)"}` };
  return c;
}

// Node runtime resolver (the generate route runs on Node, not Edge).
export const nodeDnsLookup: DnsLookup = async (host) => {
  const { lookup } = await import("node:dns/promises");
  const res = await lookup(host, { all: true });
  return res.map((r) => r.address);
};

export class UnsafeUrlError extends Error {
  constructor(readonly url: string, readonly reason: string) {
    super(`Blocked non-public URL (${reason})`);
    this.name = "UnsafeUrlError";
  }
}
