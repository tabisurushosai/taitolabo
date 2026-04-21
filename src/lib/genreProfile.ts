import type { RankingEntry } from "./types";
import { computeEntryFinalWorkRootIndices, dedupeRankingEntriesByWork } from "./rankingDedupe";
import { isDisplayableToken } from "./tokenFilter";

/** 複数ソースを跨いだ「1 作品」の集約（順位は全行の最小 rank、強さの目安は全行の最大 points） */
type WorkAggregate = {
  rep: RankingEntry;
  minRank: number;
  maxPoints: number;
};

function buildWorkAggregates(entries: readonly RankingEntry[]): WorkAggregate[] {
  const n = entries.length;
  if (n === 0) return [];
  const roots = computeEntryFinalWorkRootIndices(entries);
  const rootToIndices = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const r = roots[i];
    let arr = rootToIndices.get(r);
    if (arr === undefined) {
      arr = [];
      rootToIndices.set(r, arr);
    }
    arr.push(i);
  }

  const out: WorkAggregate[] = [];
  for (const indices of rootToIndices.values()) {
    const rows = indices.map((i) => entries[i]);
    let minRank = Infinity;
    let maxPoints = -Infinity;
    for (const e of rows) {
      if (e.rank < minRank) minRank = e.rank;
      if (typeof e.points === "number" && !Number.isNaN(e.points)) {
        if (e.points > maxPoints) maxPoints = e.points;
      }
    }
    if (minRank === Infinity) minRank = 999;
    if (maxPoints === -Infinity) maxPoints = 0;

    const atMinRank = rows.filter((e) => e.rank === minRank);
    const candidates = atMinRank.length > 0 ? atMinRank : rows;
    let rep = candidates[0]!;
    let repPts = typeof rep.points === "number" && !Number.isNaN(rep.points) ? rep.points : -Infinity;
    for (const e of candidates) {
      const ep = typeof e.points === "number" && !Number.isNaN(e.points) ? e.points : -Infinity;
      if (ep > repPts) {
        rep = e;
        repPts = ep;
      } else if (ep === repPts && e.title.localeCompare(rep.title, "ja") < 0) {
        rep = e;
      }
    }
    out.push({ rep, minRank, maxPoints });
  }
  return out;
}

function compareWorkAggregates(a: WorkAggregate, b: WorkAggregate): number {
  if (a.minRank !== b.minRank) return a.minRank - b.minRank;
  if (b.maxPoints !== a.maxPoints) return b.maxPoints - a.maxPoints;
  return a.rep.title.localeCompare(b.rep.title, "ja");
}

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
 * 「上位 N 作品」は `computeEntryFinalWorkRootIndices` と同一の作品単位でまとめたうえで、
 * 各作品の **全ソース中の最良 rank（最小）** を第一キー、**全行の最大 points** を第二キー（降順）に
 * ソートし、先頭 `topRank` 件の**代表行**（最良 rank 行のうち points 最大）からトークン・タグを集計する。
 * ソースごとの rank=1 が複数あっても、上記キーで並んだ先頭 N 件だけが対象になる。
 *
 * - `avgPoints` … 入力 `entries` を `dedupeRankingEntriesByWork` した 1 行／作品の平均ポイント
 * - `topRangeAvgPoints` … 上記「上位 N 作品」代表行の平均ポイント
 *
 * points 未定義は分母から除外する。
 */
export function computeGenreProfile(
  entries: RankingEntry[],
  topRank: GenreProfileTopRank
): GenreProfile {
  assertTopRank(topRank);

  const byWork = dedupeRankingEntriesByWork(entries);
  const aggs = buildWorkAggregates(entries);
  const sortedAggs = [...aggs].sort(compareWorkAggregates);
  const topSlice = sortedAggs.slice(0, topRank).map((a) => a.rep);
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
