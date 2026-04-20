/**
 * ソースフィルタチップの表示順（期間 → ジャンル、なろう → カクヨム）。
 * Redis の取得順には依存しない。
 */
export const SOURCE_ORDER = [
  "narou_daily_total",
  "narou_daily_g101",
  "narou_daily_g102",
  "narou_daily_g201",
  "narou_daily_g202",
  "narou_weekly_total",
  "narou_weekly_g101",
  "narou_weekly_g102",
  "narou_weekly_g201",
  "narou_weekly_g202",
  "narou_monthly_total",
  "narou_monthly_g101",
  "narou_monthly_g102",
  "narou_monthly_g201",
  "narou_monthly_g202",
  "kakuyomu_daily_total",
  "kakuyomu_weekly_total",
] as const;

const ORDER_INDEX = new Map<string, number>(SOURCE_ORDER.map((s, i) => [s, i]));

/**
 * SOURCE_ORDER の index 順。未定義のソースは末尾にアルファベット順（localeCompare）。
 */
export function sortSources<T extends string>(sources: readonly T[]): T[] {
  const unknownRank = SOURCE_ORDER.length;
  return [...sources].sort((a, b) => {
    const ia = ORDER_INDEX.has(a) ? ORDER_INDEX.get(a)! : unknownRank;
    const ib = ORDER_INDEX.has(b) ? ORDER_INDEX.get(b)! : unknownRank;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b);
  });
}
