import { RANKING_SOURCE_LABELS, type DiagnoseMatchedToken, type DiagnoseResponse, type RankingSource } from "@/lib/types";
import type { TokenField } from "@/lib/analyzer";

const TAB_FIELD_JA: Record<TokenField, string> = {
  titleTokens: "タイトル",
  synopsisTokens: "あらすじ",
  tags: "タグ",
};

function compactSourceLabel(source: RankingSource | null): string {
  if (source === null) return "全ソース";
  return RANKING_SOURCE_LABELS[source].replace(/\s+/g, "");
}

/** マッチ語の token → フィールド横断の最大頻度 */
function aggregateMatchedFrequencies(matched: DiagnoseMatchedToken[]): Array<{ token: string; freq: number }> {
  const m = new Map<string, number>();
  for (const x of matched) {
    m.set(x.token, Math.max(m.get(x.token) ?? 0, x.frequency));
  }
  return Array.from(m.entries())
    .map(([token, freq]) => ({ token, freq }))
    .sort((a, b) => b.freq - a.freq || a.token.localeCompare(b.token, "ja"));
}

function truncateTitle(s: string, max = 48): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

/**
 * オープンチャット・LINE 向け診断結果テキスト（先頭絵文字は 📊 のみ）
 */
export function formatDiagnoseShareText(
  result: DiagnoseResponse,
  verdictLabel: string
): string {
  const lines: string[] = [];
  lines.push("📊 タイトル診断");
  lines.push(`「${result.title}」`);
  lines.push(`スコア: ${result.score}/100（${verdictLabel}）`);

  const agg = aggregateMatchedFrequencies(result.matchedTokens);
  const freqPart =
    agg.length > 0
      ? agg.map(({ token, freq }) => `${token}(${freq})`).join(", ")
      : "なし";
  lines.push(`含有頻出語: ${freqPart}`);

  const firstSim = result.similar[0];
  lines.push(
    `類似タイトル上位: ${firstSim ? truncateTitle(firstSim.title, 52) : "なし"}`
  );

  const sug = result.suggestedTitleTokens.slice(0, 8);
  const sugPart =
    sug.length > 0 ? sug.map((s) => s.token).join(", ") : "なし";
  lines.push(`足すと効きそう: ${sugPart}`);

  return lines.join("\n");
}

export type TitleAnatomyShareParams = {
  token: string;
  field: TokenField;
  selectedSource: RankingSource | null;
  selectedGenre: string | null;
  coOccurrence: Array<{ token: string; count: number }>;
};

/**
 * タイトラボ（トークンクラウド）パネル用コピー（先頭絵文字は 🔍 のみ）
 */
export function formatTitleAnatomyTokenShareText(p: TitleAnatomyShareParams): string {
  const scope = compactSourceLabel(p.selectedSource);
  const genrePart = p.selectedGenre ? `・${p.selectedGenre}` : "";
  const fieldJa = TAB_FIELD_JA[p.field];
  const coPart =
    p.coOccurrence.length > 0
      ? p.coOccurrence.map((c) => `${c.token}(${c.count})`).join(", ")
      : "なし";

  const lines: string[] = [];
  lines.push(`🔍 タイトラボ「${p.token}」`);
  lines.push(`出現: ${scope}${genrePart}（${fieldJa}）`);
  lines.push(`共起語: ${coPart}`);

  return lines.join("\n");
}
