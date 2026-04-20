import { GENRE_ORDER } from "@/lib/genreOrder";

/** ジャンル分布ドーナツ等と同一のパレット */
export const GENRE_CHART_COLORS = [
  "#fbbf24",
  "#fb7185",
  "#22d3ee",
  "#a78bfa",
  "#34d399",
  "#f472b6",
  "#2dd4bf",
  "#c4b5fd",
];

/**
 * `GENRE_ORDER` のインデックスに対応する色。未定義ジャンルはパレットを回す。
 */
export function genreSliceColor(genreName: string): string {
  const idx = GENRE_ORDER.findIndex((g) => g === genreName);
  const i = idx === -1 ? GENRE_ORDER.length : idx;
  return GENRE_CHART_COLORS[i % GENRE_CHART_COLORS.length];
}
