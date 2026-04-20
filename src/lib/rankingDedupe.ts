import type { RankingEntry } from "@/lib/types";

/**
 * 表記ゆれ（短編／連載版など）を除いたベースタイトル。
 * ncode が作品ごとに分かれているケースの第2キーにも使う。
 */
export function normalizeBaseTitle(title: string): string {
  let t = title.normalize("NFKC").trim().toLowerCase();
  const suffixes = [
    "【連載版】",
    "（連載版）",
    "〈連載版〉",
    "[連載版]",
    "［連載版］",
    "【短編】",
    "（短編）",
    "〈短編〉",
    "【短篇】",
    "（短篇）",
  ] as const;

  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of suffixes) {
      if (t.endsWith(suf)) {
        t = t.slice(0, -suf.length).trim();
        changed = true;
        break;
      }
    }
  }
  return t;
}

function isBetterRank(a: RankingEntry, b: RankingEntry): boolean {
  if (a.rank < b.rank) return true;
  if (a.rank > b.rank) return false;
  const an = a.ncode?.trim() ?? "";
  const bn = b.ncode?.trim() ?? "";
  if (an.length > 0 && bn.length === 0) return true;
  if (an.length === 0 && bn.length > 0) return false;
  return false;
}

function dedupeByKey(
  entries: readonly RankingEntry[],
  keyFn: (e: RankingEntry) => string
): RankingEntry[] {
  const best = new Map<string, RankingEntry>();
  for (const e of entries) {
    const key = keyFn(e);
    const prev = best.get(key);
    if (prev === undefined || isBetterRank(e, prev)) {
      best.set(key, e);
    }
  }
  return [...best.values()];
}

/** 同一作品の重複判定用キー（ncode 優先、なければ正規化タイトル） */
export function workIdentityKey(e: RankingEntry): string {
  const n = e.ncode?.trim().toLowerCase();
  if (n && n.length > 0) return `n:${n}`;
  const t = normalizeBaseTitle(e.title);
  return `t:${t}`;
}

/**
 * 日間・週間など複数データセットを結合したときに同一作品が複数行になるのをまとめる。
 * 同一キーでは rank が最も小さい行（掲載順位が良い方）を残す。
 *
 * 二段階:
 * 1) ncode が同じ、またはタイトル（表記ゆれ除く）ベースのみでキー
 * 2) 正規化タイトルが同一なら ncode が異なる（短編／連載で別 ncode）も 1 件にまとめる
 */
export function dedupeRankingEntriesByWork(entries: readonly RankingEntry[]): RankingEntry[] {
  const pass1 = dedupeByKey(entries, workIdentityKey);
  return dedupeByKey(pass1, (e) => `t:${normalizeBaseTitle(e.title)}`);
}
