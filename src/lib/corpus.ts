import { computeIdf, type CorpusEntry } from "@/lib/similarity";
import type { RankingEntry } from "@/lib/types";
import { getDataset, listDatasetKeys } from "@/lib/data";

export const CORPUS_CACHE_TTL_MS = 5 * 60 * 1000;

type CorpusIdfCache = {
  corpus: CorpusEntry[];
  idf: Map<string, number>;
  expiresAt: number;
} | null;

let corpusIdfCache: CorpusIdfCache = null;

function entryPoints(e: RankingEntry): number {
  return typeof e.points === "number" && !Number.isNaN(e.points) ? e.points : 0;
}

function toCorpusEntry(entry: RankingEntry, source: string): CorpusEntry {
  return {
    ncode: entry.ncode!.trim().toLowerCase(),
    title: entry.title,
    titleTokens: entry.titleTokens,
    genre: entry.genre,
    source,
    points: entryPoints(entry),
  };
}

async function fetchCorpusEntries(): Promise<CorpusEntry[]> {
  let keys: string[];
  try {
    keys = await listDatasetKeys();
  } catch {
    return [];
  }

  if (keys.length === 0) return [];

  const datasets = await Promise.all(keys.map((k) => getDataset(k)));
  /** ncode → 最も points が高い行（同点は先に採用した方を維持） */
  const best = new Map<string, { entry: RankingEntry; source: string }>();

  for (let i = 0; i < datasets.length; i += 1) {
    const ds = datasets[i];
    if (ds == null) continue;
    const source = ds.source;
    for (const e of ds.entries) {
      const raw = e.ncode?.trim();
      if (raw === undefined || raw === "") continue;
      const ncode = raw.toLowerCase();
      const pts = entryPoints(e);
      const prev = best.get(ncode);
      if (prev === undefined || pts > entryPoints(prev.entry)) {
        best.set(ncode, { entry: e, source });
      }
    }
  }

  const out: CorpusEntry[] = [];
  for (const [, { entry, source }] of best) {
    out.push(toCorpusEntry(entry, source));
  }
  out.sort((a, b) => a.ncode.localeCompare(b.ncode, "ja"));
  return out;
}

/**
 * コーパスと IDF を同一 TTL でキャッシュする。再取得時は両方まとめて更新。
 * Redis 失敗時は空コーパス＋空 IDF（throw しない）。
 */
export async function loadCorpusAndIdf(): Promise<{
  corpus: CorpusEntry[];
  idf: Map<string, number>;
}> {
  const now = Date.now();
  if (corpusIdfCache !== null && corpusIdfCache.expiresAt > now) {
    return { corpus: corpusIdfCache.corpus, idf: corpusIdfCache.idf };
  }

  try {
    const corpus = await fetchCorpusEntries();
    const idf = computeIdf(corpus);
    corpusIdfCache = { corpus, idf, expiresAt: now + CORPUS_CACHE_TTL_MS };
    return { corpus, idf };
  } catch {
    return { corpus: [], idf: new Map<string, number>() };
  }
}

/**
 * Redis の全ランキングデータセットから ncode ユニークのコーパスを構築する。
 * 5 分 TTL のモジュールキャッシュあり（`loadCorpusAndIdf` と共有）。
 */
export async function loadCorpus(): Promise<CorpusEntry[]> {
  const { corpus } = await loadCorpusAndIdf();
  return corpus;
}
