import { countTokens } from "@/lib/analyzer";
import type { RankingEntry } from "@/lib/types";

export type TrendEntry = {
  token: string;
  /** 今週（現在コーパス）の出現回数 */
  currentCount: number;
  /** 先週（比較コーパス）の出現回数 */
  previousCount: number;
  /** currentCount - previousCount */
  delta: number;
  /** currentCount / previousCount。previousCount === 0 かつ currentCount > 0 のとき Infinity */
  ratio: number;
};

export type TrendResult = {
  rising: TrendEntry[];
  falling: TrendEntry[];
  currentDate: string;
  previousDate: string;
};

function ratioForCounts(currentCount: number, previousCount: number): number {
  if (previousCount === 0) {
    return currentCount > 0 ? Number.POSITIVE_INFINITY : 0;
  }
  return currentCount / previousCount;
}

/**
 * 今週・先週のランキングエントリから、タイトルトークンの伸び／下がりを算出する（純関数）。
 */
export function computeTrend(
  currentEntries: RankingEntry[],
  previousEntries: RankingEntry[],
  limit: number = 15
): Omit<TrendResult, "currentDate" | "previousDate"> {
  if (currentEntries.length === 0 && previousEntries.length === 0) {
    return { rising: [], falling: [] };
  }

  const currentMap = countTokens(currentEntries, "titleTokens");
  const previousMap = countTokens(previousEntries, "titleTokens");

  const tokenSet = new Set<string>([...currentMap.keys(), ...previousMap.keys()]);
  const rows: TrendEntry[] = [];

  for (const token of tokenSet) {
    const currentCount = currentMap.get(token) ?? 0;
    const previousCount = previousMap.get(token) ?? 0;
    if (currentCount + previousCount < 3) continue;

    const delta = currentCount - previousCount;
    rows.push({
      token,
      currentCount,
      previousCount,
      delta,
      ratio: ratioForCounts(currentCount, previousCount),
    });
  }

  const ja = (a: string, b: string) => a.localeCompare(b, "ja");

  const rising = rows
    .filter((r) => r.delta > 0)
    .sort((a, b) => (b.delta !== a.delta ? b.delta - a.delta : ja(a.token, b.token)))
    .slice(0, Math.max(0, limit));

  const falling = rows
    .filter((r) => r.delta < 0)
    .sort((a, b) => (a.delta !== b.delta ? a.delta - b.delta : ja(a.token, b.token)))
    .slice(0, Math.max(0, limit));

  return { rising, falling };
}
