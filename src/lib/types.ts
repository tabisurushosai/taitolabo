export type RankingSource =
  | "narou_daily_total"
  | "narou_daily_isekai_ren"
  | "narou_daily_humandrama"
  | "kakuyomu_weekly_total"
  | "kakuyomu_weekly_romcom";

export const RANKING_SOURCE_LABELS: Record<RankingSource, string> = {
  narou_daily_total: "なろう 日間総合",
  narou_daily_isekai_ren: "なろう 日間 異世界恋愛",
  narou_daily_humandrama: "なろう 日間 ヒューマンドラマ",
  kakuyomu_weekly_total: "カクヨム 週間総合",
  kakuyomu_weekly_romcom: "カクヨム 週間ラブコメ",
};

export type RankingEntry = {
  rank: number;
  title: string;
  titleTokens: string[]; // 事前抽出：タイトルの名詞・固有語
  author: string;
  points?: number; // なろう pt or カクヨム ★
  genre: string; // 例: "異世界〔恋愛〕"
  tags: string[]; // ユーザー付与タグ
  synopsisHead: string; // あらすじ冒頭そのまま（表示用、150-200文字）
  synopsisTokens: string[]; // 事前抽出：あらすじ冒頭のキーワード
  isShort?: boolean;
  charCount?: number;
};

export type RankingDataset = {
  source: RankingSource;
  date: string; // YYYY-MM-DD
  entries: RankingEntry[];
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
