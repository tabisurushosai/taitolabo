import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// 読み取り系: 1分間にIP毎60回まで
export const readLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, "1 m"),
  analytics: true,
  prefix: "rl:read",
});

// 書き込み系（投入・削除）: 1分間にIP毎5回まで
export const writeLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "1 m"),
  analytics: true,
  prefix: "rl:write",
});

// IP取得ヘルパー
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    headers.get("x-real-ip") ??
    "anonymous"
  );
}
