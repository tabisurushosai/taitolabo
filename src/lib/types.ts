export const RANKING_SOURCE_LABELS = {
  narou_daily_total: "なろう 日間総合",
  narou_daily_g101: "なろう 日間 異世界〔恋愛〕",
  narou_daily_g102: "なろう 日間 現実世界〔恋愛〕",
  narou_daily_g201: "なろう 日間 ハイファンタジー〔ファンタジー〕",
  narou_daily_g202: "なろう 日間 ローファンタジー〔ファンタジー〕",
  narou_weekly_total: "なろう 週間総合",
  narou_weekly_g101: "なろう 週間 異世界〔恋愛〕",
  narou_weekly_g102: "なろう 週間 現実世界〔恋愛〕",
  narou_weekly_g201: "なろう 週間 ハイファンタジー〔ファンタジー〕",
  narou_weekly_g202: "なろう 週間 ローファンタジー〔ファンタジー〕",
  narou_monthly_total: "なろう 月間総合",
  narou_monthly_g101: "なろう 月間 異世界〔恋愛〕",
  narou_monthly_g102: "なろう 月間 現実世界〔恋愛〕",
  narou_monthly_g201: "なろう 月間 ハイファンタジー〔ファンタジー〕",
  narou_monthly_g202: "なろう 月間 ローファンタジー〔ファンタジー〕",
  kakuyomu_daily_total: "カクヨム 日間総合",
  kakuyomu_weekly_total: "カクヨム 週間総合",
} as const;

export type RankingSource = keyof typeof RANKING_SOURCE_LABELS;

/** 投入・削除バリデーションと同期（重複なし・順序固定） */
export const VALID_RANKING_SOURCES: readonly RankingSource[] = Object.keys(
  RANKING_SOURCE_LABELS
) as RankingSource[];

export type RankingEntry = {
  rank: number;
  title: string;
  titleTokens: string[]; // 事前抽出：タイトルの名詞・固有語
  points?: number; // なろう pt or カクヨム ★
  genre: string; // 例: "異世界〔恋愛〕"
  tags: string[]; // ユーザー付与タグ
  /**
   * なろうの作品コード。`https://ncode.syosetu.com/{ncode}/` でアクセス。
   * 取得スクリプトでは小文字に正規化して格納する。
   */
  ncode?: string;
  synopsisHead: string; // あらすじ冒頭そのまま（データ保持用。UIでは表示しない）
  synopsisTokens: string[]; // 事前抽出：あらすじ冒頭のキーワード
  isShort?: boolean;
  /**
   * なろう API の `length`（**本文**の文字数）。タイトル文字数ではない。
   */
  charCount?: number;
  /**
   * タイトル文字数（記号含む、空白除く）。グラフ用。取得時は
   * `[...title.replace(/[\s　]/g, "")].length` で算出する。
   */
  titleLength?: number;
};

export type RankingDataset = {
  source: RankingSource;
  date: string; // YYYY-MM-DD（ランキングの基準日）
  entries: RankingEntry[];
  /**
   * 本番 Redis に保存した日時（ISO 8601 UTC）。再投入のたびに更新される。
   * この項目追加以前に保存されたデータには無い。
   */
  savedAt?: string;
};

export type DiagnoseVerdict = "blue_ocean" | "balanced" | "red_leaning" | "full_red";

export type DiagnoseTokenField = "titleTokens" | "synopsisTokens" | "tags";

export type DiagnoseMatchedToken = {
  token: string;
  field: DiagnoseTokenField;
  frequency: number;
};

export type DiagnoseSimilarItem = {
  rank: number;
  title: string;
  points?: number;
  genre: string;
  sharedTokens: string[];
};

export type DiagnoseTokenSuggestion = {
  token: string;
  count: number;
};

/** POST /api/diagnose の成功レスポンス */
export type DiagnoseResponse = {
  title: string;
  source: RankingSource | "all";
  entriesAnalyzed: number;
  score: number;
  verdict: DiagnoseVerdict;
  matchedTokens: DiagnoseMatchedToken[];
  similar: DiagnoseSimilarItem[];
  suggestedTitleTokens: DiagnoseTokenSuggestion[];
  suggestedTags: DiagnoseTokenSuggestion[];
};
