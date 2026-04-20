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

/**
 * `dedupeRankingEntriesByWork` と同じ同一視で、各エントリが属する「作品」成分の代表インデックス。
 * O(n α(n))。トークンごとに dedupe を繰り返すより集計に利用する。
 */
export function computeEntryFinalWorkRootIndices(entries: readonly RankingEntry[]): Uint32Array {
  const n = entries.length;
  const out = new Uint32Array(n);
  if (n === 0) return out;

  const parent = new Uint32Array(n);
  const rank = new Uint8Array(n);
  for (let i = 0; i < n; i += 1) parent[i] = i;

  function find(i: number): number {
    let r = i;
    while (parent[r] !== r) r = parent[r];
    let p = i;
    while (parent[p] !== r) {
      const nxt = parent[p];
      parent[p] = r;
      p = nxt;
    }
    return r;
  }

  function union(a: number, b: number): void {
    let ra = find(a);
    let rb = find(b);
    if (ra === rb) return;
    if (rank[ra] < rank[rb]) [ra, rb] = [rb, ra];
    parent[rb] = ra;
    if (rank[ra] === rank[rb]) rank[ra] += 1;
  }

  const byWik = new Map<string, number[]>();
  for (let i = 0; i < n; i += 1) {
    const k = workIdentityKey(entries[i]);
    let arr = byWik.get(k);
    if (arr === undefined) {
      arr = [];
      byWik.set(k, arr);
    }
    arr.push(i);
  }
  for (const arr of byWik.values()) {
    if (arr.length < 2) continue;
    for (let j = 1; j < arr.length; j += 1) union(arr[0], arr[j]);
  }

  const rootToMembers = new Map<number, number[]>();
  for (let i = 0; i < n; i += 1) {
    const r = find(i);
    let members = rootToMembers.get(r);
    if (members === undefined) {
      members = [];
      rootToMembers.set(r, members);
    }
    members.push(i);
  }

  const byNormTitle = new Map<string, number[]>();
  for (const members of rootToMembers.values()) {
    let bestIdx = members[0];
    let best = entries[bestIdx];
    for (const idx of members) {
      const e = entries[idx];
      if (isBetterRank(e, best)) {
        best = e;
        bestIdx = idx;
      }
    }
    const tKey = normalizeBaseTitle(entries[bestIdx].title);
    let roots = byNormTitle.get(tKey);
    if (roots === undefined) {
      roots = [];
      byNormTitle.set(tKey, roots);
    }
    roots.push(find(bestIdx));
  }

  for (const roots of byNormTitle.values()) {
    if (roots.length < 2) continue;
    const m0 = rootToMembers.get(roots[0])?.[0];
    if (m0 === undefined) continue;
    for (let j = 1; j < roots.length; j += 1) {
      const mj = rootToMembers.get(roots[j])?.[0];
      if (mj !== undefined) union(m0, mj);
    }
  }

  for (let i = 0; i < n; i += 1) out[i] = find(i);
  return out;
}
