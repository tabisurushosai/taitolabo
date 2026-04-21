/** プロセス内 Map による IP 単位の固定窓レート制限（Upstash 不要の軽量ルート向け） */
export type IpRateBucket = { count: number; windowStart: number };

/**
 * @param storage ルートごとに別インスタンスの Map を渡す
 * @returns 許可なら true、拒否なら false（呼び出し側で 429）
 */
export function checkInMemoryIpRateLimit(
  storage: Map<string, IpRateBucket>,
  ip: string,
  maxPerWindow: number,
  windowMs: number,
  now: number = Date.now()
): boolean {
  let entry = storage.get(ip);
  if (!entry || now - entry.windowStart >= windowMs) {
    entry = { count: 0, windowStart: now };
    storage.set(ip, entry);
  }
  if (entry.count >= maxPerWindow) {
    return false;
  }
  entry.count += 1;
  return true;
}
