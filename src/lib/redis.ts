import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "KV_REST_API_URL と KV_REST_API_TOKEN が必要です。`vercel env pull .env.local` で取得してください。"
    );
  }
  _redis = new Redis({ url, token });
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
