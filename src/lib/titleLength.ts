import type { RankingEntry } from "@/lib/types";

/** タイトル文字数（fetch-narou・散布図の highlight と同一ロジック） */
export function titleCharCount(raw: string): number {
  return [...raw.replace(/[\s　]/g, "")].length;
}

/**
 * 表示用のタイトル文字数。Redis に `titleLength` が無い古いコーパスでは `title` から算出する（fetch-narou と同一規則）。
 */
export function resolveTitleLength(entry: RankingEntry): number | null {
  if (typeof entry.titleLength === "number" && Number.isFinite(entry.titleLength) && entry.titleLength > 0) {
    return entry.titleLength;
  }
  const raw = entry.title?.trim() ?? "";
  if (raw === "") return null;
  const n = titleCharCount(raw);
  return n > 0 ? n : null;
}

/** 散布図・サマリを安定表示するための最低 titleLength 件数 */
export const MIN_TITLE_LENGTH_SAMPLES = 5;

export function countEntriesWithTitleLength(entries: RankingEntry[]): number {
  let n = 0;
  for (const e of entries) {
    if (resolveTitleLength(e) !== null) n++;
  }
  return n;
}

/** entries が空、または有効な titleLength が最低件数未満 */
export function isInsufficientTitleLengthData(entries: RankingEntry[]): boolean {
  return (
    entries.length === 0 || countEntriesWithTitleLength(entries) < MIN_TITLE_LENGTH_SAMPLES
  );
}
