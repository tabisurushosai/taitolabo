/**
 * なろうジャンルコードに対応する日本語表記の表示順（公式コード昇順ベース、9801 は 9999 の次）。
 */
export const GENRE_ORDER = [
  "異世界〔恋愛〕",
  "現実世界〔恋愛〕",
  "ハイファンタジー〔ファンタジー〕",
  "ローファンタジー〔ファンタジー〕",
  "純文学〔文芸〕",
  "ヒューマンドラマ〔文芸〕",
  "歴史〔文芸〕",
  "推理〔文芸〕",
  "ホラー〔文芸〕",
  "アクション〔文芸〕",
  "コメディー〔文芸〕",
  "VRゲーム〔SF〕",
  "宇宙〔SF〕",
  "空想科学〔SF〕",
  "パニック〔SF〕",
  "童話〔その他〕",
  "詩〔その他〕",
  "エッセイ〔その他〕",
  "リプレイ〔その他〕",
  "その他〔その他〕",
  "ノンジャンル〔ノンジャンル〕",
] as const;

const ORDER_INDEX = new Map<string, number>(GENRE_ORDER.map((g, i) => [g, i]));

/**
 * チャート凡例など短い表示用。
 * 〔〕内が2文字以下ならそのまま（例: 異世界〔恋愛〕）。
 * それ以外は、括弧前が単独で12文字以上、または全体が12文字以上なら 〔…〕 を落として括弧前のみ。
 */
export function shortenGenreLabel(label: string): string {
  const m = /^(.+)〔([^〕]+)〕$/.exec(label);
  if (!m) return label;
  const base = m[1];
  const inner = m[2];
  if (inner.length <= 2) return label;
  if (base.length >= 12 || label.length >= 12) return base;
  return label;
}

/**
 * GENRE_ORDER の index 順。「全ジャンル」は FilterBar 側で先頭固定。
 * 未定義のジャンル文字列は末尾に localeCompare で整列。
 */
export function sortGenres(genres: string[]): string[] {
  const unknownRank = GENRE_ORDER.length;
  return [...genres].sort((a, b) => {
    const ia = ORDER_INDEX.has(a) ? ORDER_INDEX.get(a)! : unknownRank;
    const ib = ORDER_INDEX.has(b) ? ORDER_INDEX.get(b)! : unknownRank;
    if (ia !== ib) return ia - ib;
    return a.localeCompare(b, "ja");
  });
}
