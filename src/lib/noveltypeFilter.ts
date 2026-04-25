import type { RankingEntry } from "./types";

/**
 * URL クエリ `noveltype` の正規化済み値。
 * - `tanpen`: 短編（`isShort === true`）
 * - `rensai`: 連載（`isShort === false`、なろう `noveltype === 1` に相当）
 * - `all`: 絞り込みなし
 */
export type NoveltypeQuery = "all" | "tanpen" | "rensai";

/**
 * `searchParams.noveltype` 等の生文字列を `NoveltypeQuery` に正規化する。
 *
 * - `'all'` / `'tanpen'` / `'rensai'` の**小文字厳密一致**のみ有効
 * - `undefined`、空文字、それ以外の文字列、および `'All'` や `'TANPEN'` など
 *   大文字・大文字小文字混在はすべて `'all'` にフォールバックする
 */
export function parseNoveltypeQuery(raw: string | undefined): NoveltypeQuery {
  if (raw === "all" || raw === "tanpen" || raw === "rensai") {
    return raw;
  }
  return "all";
}

function entryMatchesNoveltype(e: { isShort?: boolean }, query: NoveltypeQuery): boolean {
  if (query === "all") return true;
  if (query === "tanpen") return e.isShort === true;
  if (query === "rensai") return e.isShort === false;
  return true;
}

/**
 * 作品種別（短編／連載）に応じてエントリ配列を絞り込む。
 *
 * - `query === 'all'`: 入力配列をそのまま返す（参照も同一）
 * - `query === 'tanpen'`: `isShort === true` の行のみ
 * - `query === 'rensai'`: `isShort === false` の行のみ
 * - `isShort === undefined`（古い Redis 行や当該フィールド非対応ソース）は、
 *   `tanpen` / `rensai` の**いずれの絞り込みにも含めない**（§11: 安全側の除外）
 */
export function filterEntriesByNoveltype<T extends { isShort?: boolean }>(
  entries: T[],
  query: NoveltypeQuery,
): T[] {
  if (query === "all") {
    return entries;
  }
  return entries.filter((e) => entryMatchesNoveltype(e, query));
}

/**
 * `entries[i]` と `entrySources[i]` の対応を保ったまま、作品種別で行を残す。
 * チャート用の「行＋元ソース」配列向け。`dedupeRankingEntrySourcePairs` と同様、
 * 長さ不一致のときは即座に例外とする（防御的）。
 *
 * `query === 'all'` のときは、渡された配列をそのまま返す（同じ参照）。
 * `entrySources` の要素型（例: `RankingSource`）は戻り値でも保持する。
 */
export function filterEntrySourcePairsByNoveltype<S extends string = string>(
  entries: RankingEntry[],
  entrySources: S[],
  query: NoveltypeQuery,
): { entries: RankingEntry[]; entrySources: S[] } {
  if (entries.length !== entrySources.length) {
    throw new Error(
      `filterEntrySourcePairsByNoveltype: length mismatch entries=${entries.length} entrySources=${entrySources.length}`,
    );
  }
  if (query === "all") {
    return { entries, entrySources };
  }
  const outE: RankingEntry[] = [];
  const outS: S[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    if (entryMatchesNoveltype(entries[i], query)) {
      outE.push(entries[i]);
      outS.push(entrySources[i]);
    }
  }
  return { entries: outE, entrySources: outS };
}
