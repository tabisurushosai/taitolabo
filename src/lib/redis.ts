import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/** Vercel KV 統合の標準名を優先。`UPSTASH_*` は後方互換用。 */
function redisRestCredentials(): { url: string; token: string } | null {
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken };
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken };
  return null;
}

export function getRedis(): Redis {
  if (_redis) return _redis;
  const cred = redisRestCredentials();
  if (!cred) {
    throw new Error(
      "Redis credentials not found. Set KV_REST_API_URL and KV_REST_API_TOKEN " +
        "(Vercel KV / Upstash), or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, in .env or environment."
    );
  }
  _redis = new Redis({ url: cred.url, token: cred.token });
  return _redis;
}

/** Ratelimit 等と共有するプロキシ（遅延で getRedis() に委譲） */
export const redis: Redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    const r = getRedis();
    const value = Reflect.get(r, prop, receiver);
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(r) : value;
  },
});
