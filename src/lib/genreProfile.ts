import type { RankingEntry } from "./types";
import { dedupeRankingEntriesByWork } from "./rankingDedupe";
import { isDisplayableToken } from "./tokenFilter";

export type GenreProfile = {
  targetCount: number;
  topTokens: { token: string; count: number }[];
  topTags: { tag: string; count: number }[];
  avgTitleLength: number;
  avgPoints: number;
  topRangeAvgPoints: number;
};

const VALID_TOP_RANKS = [10, 20, 30, 50] as const;
export type GenreProfileTopRank = (typeof VALID_TOP_RANKS)[number];

function assertTopRank(topRank: number): asserts topRank is GenreProfileTopRank {
  if (!VALID_TOP_RANKS.includes(topRank as GenreProfileTopRank)) {
    throw new Error(`topRank must be one of ${VALID_TOP_RANKS.join(", ")}`);
  }
}

function titleLengthOf(e: RankingEntry): number {
  if (typeof e.titleLength === "number" && Number.isFinite(e.titleLength)) {
    return e.titleLength;
  }
  return [...e.title.replace(/[\s　]/g, "")].length;
}

function meanPoints(list: RankingEntry[]): number {
  if (list.length === 0) return 0;
  let sum = 0;
  let n = 0;
  for (const e of list) {
    if (typeof e.points === "number" && !Number.isNaN(e.points)) {
      sum += e.points;
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
}

function meanTitleLength(list: RankingEntry[]): number {
  if (list.length === 0) return 0;
  let sum = 0;
  for (const e of list) {
    sum += titleLengthOf(e);
  }
  return sum / list.length;
}

function sortedTopCounts(map: Map<string, number>, n: number): { name: string; count: number }[] {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "ja");
    })
    .slice(0, n);
}

/**
 * ジャンル（または任意のエントリ集合）の上位ランク帯の特徴を集計する。I/O なし。
 *
 * rank 昇順で先頭 `topRank` 件に絞った集合について、トークン・タグ TOP5・平均タイトル長を算出する。
 * - `avgPoints` … 入力 `entries` を作品単位にまとめたうえでの平均ポイント
 * - `topRangeAvgPoints` … 順位の上位 `topRank` **作品**のみの平均ポイント
 *
 * points 未定義は分母から除外する。
 */
export function computeGenreProfile(
  entries: RankingEntry[],
  topRank: GenreProfileTopRank
): GenreProfile {
  assertTopRank(topRank);

  const byWork = dedupeRankingEntriesByWork(entries);
  const sorted = [...byWork].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    return a.title.localeCompare(b.title, "ja");
  });

  const topSlice = sorted.slice(0, topRank);
  const targetCount = topSlice.length;

  const tokenCounts = new Map<string, number>();
  for (const e of topSlice) {
    const seen = new Set<string>();
    for (const raw of e.titleTokens) {
      if (!isDisplayableToken(raw)) continue;
      const t = raw.trim();
      if (t.length === 0 || seen.has(t)) continue;
      seen.add(t);
      tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
    }
  }

  const tagCounts = new Map<string, number>();
  for (const e of topSlice) {
    const seen = new Set<string>();
    for (const tag of e.tags) {
      const t = tag.trim();
      if (t.length === 0 || seen.has(t)) continue;
      seen.add(t);
      tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
    }
  }

  return {
    targetCount,
    topTokens: sortedTopCounts(tokenCounts, 5).map(({ name, count }) => ({ token: name, count })),
    topTags: sortedTopCounts(tagCounts, 5).map(({ name, count }) => ({ tag: name, count })),
    avgTitleLength: meanTitleLength(topSlice),
    avgPoints: meanPoints(byWork),
    topRangeAvgPoints: meanPoints(topSlice),
  };
}
