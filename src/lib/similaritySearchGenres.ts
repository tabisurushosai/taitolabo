/**
 * タイトル類似度チェック専用の検索ジャンル（メインフィルタとは独立）。
 * `value` は RankingEntry.genre / CorpusEntry.genre と完全一致でフィルタする。
 */
export const SIMILARITY_SEARCH_GENRE_OPTIONS = [
  { value: null, chipLabel: "すべて" },
  { value: "異世界〔恋愛〕", chipLabel: "異世界〔恋愛〕" },
  { value: "現実世界〔恋愛〕", chipLabel: "現実世界〔恋愛〕" },
  { value: "ハイファンタジー〔ファンタジー〕", chipLabel: "ハイファンタジー" },
  { value: "ローファンタジー〔ファンタジー〕", chipLabel: "ローファンタジー" },
  { value: "ヒューマンドラマ〔文芸〕", chipLabel: "ヒューマンドラマ" },
  { value: "推理〔文芸〕", chipLabel: "推理" },
  { value: "コメディー〔文芸〕", chipLabel: "コメディー" },
  { value: "その他〔その他〕", chipLabel: "その他" },
] as const;

const ALLOWED = new Set<string>(
  SIMILARITY_SEARCH_GENRE_OPTIONS.flatMap((o) => (o.value !== null ? [o.value] : []))
);

/** API: 受け付ける genre 値（すべて除く） */
export function isAllowedSimilaritySearchGenre(genre: string): boolean {
  return ALLOWED.has(genre);
}
