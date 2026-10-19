import type { RunRecord, Store } from "@/lib/agent/types";
import { guideSchema, type Guide } from "@/lib/schema";

// Keys (SPEC §9.11): run:{id}, guide:{slug}, rl:{key}.
const RUN_TTL_SECONDS = 60 * 60 * 24 * 30;

type MemoryState = {
  runs: Map<string, RunRecord>;
  guides: Map<string, Guide>;
  rates: Map<string, { count: number; resetAt: number }>;
};

// globalThis so route handlers and pages share one store in `next dev`.
const g = globalThis as unknown as { __oauthAtlasMemoryStore?: MemoryState };

export function createMemoryStore(state?: MemoryState): Store {
  const s = state ?? { runs: new Map(), guides: new Map(), rates: new Map() };
  const clone = <T>(v: T): T => structuredClone(v);
  return {
    async getRun(runId) {
      const r = s.runs.get(runId);
      return r ? clone(r) : null;
    },
    async putRun(run) {
      s.runs.set(run.runId, clone(run));
    },
    async getGuide(slug) {
      const guide = s.guides.get(slug);
      return guide ? clone(guide) : null;
    },
    async putGuide(guide) {
      s.guides.set(guide.slug, clone(guide));
    },
    async incrRate(key, windowSeconds) {
      const now = Date.now();
      const cur = s.rates.get(key);
      if (!cur || cur.resetAt <= now) {
        s.rates.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return 1;
      }
      cur.count += 1;
      return cur.count;
    },
  };
}

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

export async function createUpstashStore(env: { url: string; token: string }): Promise<Store> {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: env.url, token: env.token });
  return {
    async getRun(runId) {
      return (await redis.get<RunRecord>(`run:${runId}`)) ?? null;
    },
    async putRun(run) {
      await redis.set(`run:${run.runId}`, run, { ex: RUN_TTL_SECONDS });
    },
    async getGuide(slug) {
      const raw = await redis.get<unknown>(`guide:${slug}`);
      if (!raw) return null;
      const parsed = guideSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
    async putGuide(guide) {
      await redis.set(`guide:${guide.slug}`, guide);
    },
    async incrRate(key, windowSeconds) {
      const k = `rl:${key}`;
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, windowSeconds);
      return count;
    },
  };
}

// MOCK_LLM runs never touch Redis, so mock guides cannot leak into guide:{slug}.
function activeRedisEnv(): { url: string; token: string } | null {
  return process.env.MOCK_LLM === "1" ? null : redisEnv();
}

export function storeKind(): "upstash" | "memory" {
  return activeRedisEnv() ? "upstash" : "memory";
}

let cached: Promise<Store> | null = null;

// Upstash when configured (and not MOCK_LLM), otherwise a process-local memory store.
export function getStore(): Promise<Store> {
  if (!cached) {
    const env = activeRedisEnv();
    if (env) {
      cached = createUpstashStore(env);
    } else {
      g.__oauthAtlasMemoryStore ??= { runs: new Map(), guides: new Map(), rates: new Map() };
      cached = Promise.resolve(createMemoryStore(g.__oauthAtlasMemoryStore));
    }
  }
  return cached;
}
