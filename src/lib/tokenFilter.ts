/**
 * 表示用トークンの除外ルール（Redis / raw entries は変更しない）。
 * 集計・表示の直前に analyzer 経由で適用する。
 */

/**
 * コーパス全体の出現回数がこの値未満のトークンは表示・KPI 集計から除外する（希少語はノイズになりやすい）。
 * タグは意味が残りやすいので別定数にし、将来こちらだけ緩める／厳しくする調整ができるようにする。
 */
export const MIN_TOKEN_OCCURRENCE = 4;
export const MIN_TAG_OCCURRENCE = 4;

/** タイトラボのクラウドに載せる下限：dedupe 後にこの件数以上の作品に現れるトークンのみ */
export const MIN_WORKS_WITH_TOKEN = 4;

/** トークンクラウドはフィールド（タイトル / あらすじ / タグ）ごとに、この件数までしか描画しない */
export const MAX_DISPLAY_TOKENS = 500;

export type TokenCountPair = { token: string; count: number };

/**
 * 出現回数の降順（同数は token 名で整列）に並べ、先頭 MAX_DISPLAY_TOKENS 件だけ返す。
 * 切り捨てた件数は omitted に入る。
 */
export function limitDisplayTokens(rows: TokenCountPair[]): {
  displayed: TokenCountPair[];
  omitted: number;
} {
  const sorted = [...rows].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.token.localeCompare(b.token, "ja");
  });
  const total = sorted.length;
  if (total <= MAX_DISPLAY_TOKENS) {
    return { displayed: sorted, omitted: 0 };
  }
  return {
    displayed: sorted.slice(0, MAX_DISPLAY_TOKENS),
    omitted: total - MAX_DISPLAY_TOKENS,
  };
}

/**
 * token → count のマップで、count >= min のエントリだけ残した新しい Map を返す。
 */
export function filterByMinOccurrence(
  map: Map<string, number>,
  min: number
): Map<string, number> {
  const out = new Map<string, number>();
  for (const [token, count] of map) {
    if (count >= min) out.set(token, count);
  }
  return out;
}

/**
 * 半角英字1〜2文字は原則除外するが、略語として残すもの（大文字小文字は同一視して照合）。
 * 必要に応じてここに追加する。
 */
const WHITELIST_SHORT_ALPHA = [
  "AI",
  "VR",
  "PC",
  "PK",
  "HP",
  "MP",
  "RPG",
  "BL",
  "GL",
] as const;

const WHITELIST_SHORT_ALPHA_SET = new Set(
  WHITELIST_SHORT_ALPHA.map((s) => s.toUpperCase()),
);

/**
 * 日本語ストップワード（完全一致のみ除外。部分一致はしない）。
 * タイトル等で頻出しがちで意味が薄い語の初期版。頻度や運用でノイズ／信号のバランスを見ながら、
 * この配列を編集してチューニングしやすくしてある。
 *
 * 例:「事」「者」「人」はタイトルで意味を持つこともあるが、トークン統計の上位を埋めるノイズになりがちなので
 * 初期版では入れている。除外したくなければ配列から削除すればよい。
 */
const JA_STOPWORDS = [
  // 補助動詞・機能語
  "する",
  "なる",
  "いる",
  "ある",
  "なし",
  "ない",
  "られる",
  "られ",
  "できる",
  "出来る",
  "くる",
  "来る",
  "いく",
  "行く",
  "みる",
  "見る",
  "しまう",
  "もらう",
  "あげる",
  "くれる",
  "やる",
  "おく",
  "おる",
  // 指示・代名詞
  "これ",
  "それ",
  "あれ",
  "どれ",
  "ここ",
  "そこ",
  "あそこ",
  "どこ",
  "こう",
  "そう",
  "ああ",
  "どう",
  "この",
  "その",
  "あの",
  "どの",
  // よく使う一般動詞・状態語（タイトル頻出でノイズ気味なもの）
  "思う",
  "言う",
  "知る",
  "聞く",
  "持つ",
  "出す",
  "入れる",
  // 形式名詞・接続
  "こと",
  "もの",
  "ため",
  "よう",
  "とき",
  "ところ",
  "わけ",
  "はず",
  // 一文字漢字でノイズ気味なもの
  "事",
  "者",
  "人",
  "物",
  "時",
  "所",
  "方",
  "方々",
  // ランキング・宣伝で頻出しやすく、クラウドの信号として薄い語
  "書籍化",
  "連載化",
] as const;

const JA_STOPWORDS_SET = new Set<string>(JA_STOPWORDS);

/**
 * タイトルに慣習的に含まれるメタ情報語。作品内容とは無関係なので分析から除外する。
 * 必要に応じてこの配列だけ編集してチューニングする（`MIN_TOKEN_OCCURRENCE` 等とは独立）。
 */
export const META_INFO_STOPWORDS = [
  "WEB",
  "web",
  "ウェブ",
  "書籍",
  "書籍化",
  "コミカライズ",
  "コミック",
  // メディア展開・宣伝表記（【アニメ化】等）
  "アニメ",
  "アニメ化",
  "連載",
  "連載版",
  "連載中",
  "完結",
  "改稿",
  "改訂",
  "短編",
  "短編版",
  "投稿",
  "再投稿",
  "更新",
  "休載",
  "再開",
  "旧",
  // 「WEB版」「連載版」等の「版」残骸
  "版",
] as const;

const META_INFO_STOPWORDS_SET = new Set<string>(META_INFO_STOPWORDS);

/** 半角英字のみ・長さ1〜2（略語ホワイトリスト以外は除外） */
const SHORT_LATIN_1_2 = /^[A-Za-z]{1,2}$/;

/** ひらがな1文字（助詞の取りこぼし等） */
const HIRAGANA_ONE = /^[ぁ-ん]$/;

/** カタカナ1文字 */
const KATAKANA_ONE = /^[ァ-ヶー]$/;

/** トークナイザが切り出した HTML エンティティ断片（完全一致で除外） */
const ENTITY_REMNANTS = new Set([
  "quot",
  "amp",
  "lt",
  "gt",
  "nbsp",
  "apos",
  "#39",
  "#x27",
]);

/** 記号クラスで弾き損ねた単独記号（完全一致） */
const SINGLE_SYMBOL_TOKENS = new Set(["～", "〜", "・", "…", "—", "―", "「", "」"]);

/** 空白・記号・符号のみ（日本語記号含む） */
const SYMBOLS_AND_SPACE_ONLY = /^[\s\p{P}\p{S}]+$/u;

/** 半角・全角・漢数字のみ */
const NUMBERS_ONLY = /^[0-9０-９一二三四五六七八九十百千万零]+$/;

/** 数字（半角・全角）＋単位（月日・話数・巻数など）。漢数字＋意味語はここに含めない */
const NUM_WITH_UNIT = /^[0-9０-９]+(月|日|年|回|話|巻|章|部|号|話目|章目)$/;

/** 第1・第2 など順序語 */
const DAI_ORDER = /^第[0-9０-９一二三四五六七八九十百千]+$/;

/** 単体では意味を持たない単位語（完全一致） */
const STANDALONE_UNITS = new Set([
  "月",
  "日",
  "年",
  "回",
  "話",
  "巻",
  "章",
  "部",
  "号",
  "時",
  "分",
  "秒",
]);

export function isDisplayableToken(token: string): boolean {
  const t = token.trim();
  if (t.length === 0) return false;
  if (ENTITY_REMNANTS.has(t)) return false;
  if (SINGLE_SYMBOL_TOKENS.has(t)) return false;
  if (STANDALONE_UNITS.has(t)) return false;
  if (JA_STOPWORDS_SET.has(t)) return false;
  if (META_INFO_STOPWORDS_SET.has(t)) return false;
  if (NUMBERS_ONLY.test(t)) return false;
  if (NUM_WITH_UNIT.test(t)) return false;
  if (DAI_ORDER.test(t)) return false;
  if (SHORT_LATIN_1_2.test(t) && !WHITELIST_SHORT_ALPHA_SET.has(t.toUpperCase())) {
    return false;
  }
  if (HIRAGANA_ONE.test(t)) return false;
  if (KATAKANA_ONE.test(t)) return false;
  if (SYMBOLS_AND_SPACE_ONLY.test(t)) return false;
  return true;
}

export function filterTokens(tokens: string[]): string[] {
  return tokens.filter(isDisplayableToken);
}
