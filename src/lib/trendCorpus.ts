import { getDataset, listDatasetKeys, rankingDatasetKey } from "@/lib/data";
import type { RankingEntry, RankingSource } from "@/lib/types";

/** トレンド比較の対象とする週間ランキングソースのみ */
export const TREND_WEEKLY_SOURCES = [
  "narou_weekly_total",
  "narou_weekly_g101",
  "narou_weekly_g102",
  "narou_weekly_g201",
  "narou_weekly_g202",
] as const satisfies readonly RankingSource[];

export type TrendWeeklySource = (typeof TREND_WEEKLY_SOURCES)[number];

const TREND_SOURCE_SET = new Set<string>(TREND_WEEKLY_SOURCES);

const CACHE_TTL_MS = 5 * 60 * 1000;

type CorpusSlice = { date: string; entries: RankingEntry[] };

type LoadTrendCorpusResult = {
  current: CorpusSlice | null;
  previous: CorpusSlice | null;
};

type CacheEntry = { expiresAt: number; value: LoadTrendCorpusResult };

const cache = new Map<string, CacheEntry>();

function cacheKey(source: string, currentDate: string | undefined): string {
  const d =
    currentDate !== undefined && currentDate !== "" ? currentDate : "__latest__";
  return `${source}\0${d}`;
}

function parseDateFromDatasetKey(redisKey: string, source: string): string | null {
  const prefix = `ranking:${source}:`;
  if (!redisKey.startsWith(prefix)) return null;
  const tail = redisKey.slice(prefix.length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tail)) return null;
  return tail;
}

/** YYYY-MM-DD に UTC 日単位で delta 日を加算 */
function addDaysUtc(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * current から 5〜9 日前の範囲に入る日付のうち、current に最も近い（最大の）日付を選ぶ。
 * 利用可能な日付が無ければ null。
 */
function pickPreviousDate(sortedDatesDesc: string[], currentDate: string): string | null {
  const windowStart = addDaysUtc(currentDate, -9);
  const windowEnd = addDaysUtc(currentDate, -5);
  const inWindow = sortedDatesDesc.filter((d) => d >= windowStart && d <= windowEnd);
  if (inWindow.length === 0) return null;
  return inWindow[0];
}

async function datesForSource(source: string): Promise<string[]> {
  const keys = await listDatasetKeys();
  const prefix = `ranking:${source}:`;
  const dates: string[] = [];
  for (const k of keys) {
    if (typeof k !== "string" || !k.startsWith(prefix)) continue;
    const d = parseDateFromDatasetKey(k, source);
    if (d) dates.push(d);
  }
  dates.sort((a, b) => b.localeCompare(a, "en-CA"));
  const uniq = [...new Set(dates)];
  return uniq;
}

export function isTrendWeeklySource(source: string): source is TrendWeeklySource {
  return TREND_SOURCE_SET.has(source);
}

/**
 * Redis の rankings:index から、週間ソースの「今週」「先週」コーパスを読み込む。
 * 同一引数は 5 分間モジュール内キャッシュする。
 */
export async function loadTrendCorpus(
  source: string,
  currentDate?: string
): Promise<{
  current: CorpusSlice | null;
  previous: CorpusSlice | null;
}> {
  const ck = cacheKey(source, currentDate);
  const now = Date.now();
  const hit = cache.get(ck);
  if (hit && hit.expiresAt > now) {
    return hit.value;
  }

  const empty: LoadTrendCorpusResult = { current: null, previous: null };

  if (!isTrendWeeklySource(source)) {
    cache.set(ck, { expiresAt: now + CACHE_TTL_MS, value: empty });
    return empty;
  }

  const sortedDates = await datesForSource(source);
  if (sortedDates.length === 0) {
    cache.set(ck, { expiresAt: now + CACHE_TTL_MS, value: empty });
    return empty;
  }

  const resolvedCurrent =
    currentDate !== undefined && currentDate !== ""
      ? currentDate
      : sortedDates[0];

  if (!sortedDates.includes(resolvedCurrent)) {
    cache.set(ck, { expiresAt: now + CACHE_TTL_MS, value: empty });
    return empty;
  }

  const previousDate = pickPreviousDate(sortedDates, resolvedCurrent);

  const currentKey = rankingDatasetKey(source, resolvedCurrent);
  const currentDs = await getDataset(currentKey);
  const current: CorpusSlice | null =
    currentDs && Array.isArray(currentDs.entries)
      ? { date: resolvedCurrent, entries: currentDs.entries }
      : null;

  let previous: CorpusSlice | null = null;
  if (previousDate) {
    const prevKey = rankingDatasetKey(source, previousDate);
    const prevDs = await getDataset(prevKey);
    if (prevDs && Array.isArray(prevDs.entries)) {
      previous = { date: previousDate, entries: prevDs.entries };
    }
  }

  const value: LoadTrendCorpusResult = { current, previous };
  cache.set(ck, { expiresAt: now + CACHE_TTL_MS, value: value });
  return value;
}
