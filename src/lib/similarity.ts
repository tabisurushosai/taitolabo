import { isDisplayableToken } from "@/lib/tokenFilter";

export type CorpusEntry = {
  ncode: string;
  title: string;
  titleTokens: string[];
  genre: string;
  source: string;
  points: number;
};

export type SimilarityResult = {
  ncode: string;
  title: string;
  genre: string;
  source: string;
  points: number;
  score: number;
  normalizedScore: number;
  matchedTokens: string[];
  /** df/N < 5% などの希少語（表示用。IDF 降順） */
  rareMatchedTokens: string[];
};

/**
 * idf(t) = ln(N / df(t))。各エントリの titleTokens は集合として数える（文書内重複は1回）。
 */
export function computeIdf(corpus: CorpusEntry[]): Map<string, number> {
  const N = corpus.length;
  const out = new Map<string, number>();
  if (N === 0) return out;

  const df = new Map<string, number>();
  for (const e of corpus) {
    const seen = new Set(e.titleTokens);
    for (const t of seen) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }

  for (const [t, d] of df) {
    if (d > 0) {
      out.set(t, Math.log(N / d));
    }
  }
  return out;
}

function intersectionTokens(query: Set<string>, titleTokens: readonly string[]): Set<string> {
  const out = new Set<string>();
  const doc = new Set(titleTokens);
  for (const x of query) {
    if (doc.has(x)) out.add(x);
  }
  return out;
}

export function computeDocumentFrequency(corpus: CorpusEntry[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const e of corpus) {
    const seen = new Set(e.titleTokens);
    for (const t of seen) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  return df;
}

/**
 * 文書頻度がコーパスの 5% 未満の語を「希少」とする（matched 内に限定）。
 */
export function pickRareTokens(
  matchedTokens: readonly string[],
  dfMap: Map<string, number>,
  idfMap: Map<string, number>,
  corpusSize: number
): string[] {
  if (corpusSize === 0 || matchedTokens.length === 0) return [];
  const rare = new Set<string>();
  for (const t of matchedTokens) {
    const df = dfMap.get(t) ?? corpusSize;
    if (df / corpusSize < 0.05) {
      rare.add(t);
    }
  }
  return sortMatchedByIdfDesc(rare, idfMap);
}

function sortMatchedByIdfDesc(matched: Set<string>, idfMap: Map<string, number>): string[] {
  return [...matched].sort((t1, t2) => {
    const id1 = idfMap.get(t1) ?? 0;
    const id2 = idfMap.get(t2) ?? 0;
    if (id2 !== id1) return id2 - id1;
    return t1.localeCompare(t2, "ja");
  });
}

/**
 * query は isDisplayableToken でフィルタ後に積集合・スコア計算。
 * normalizedScore は結果集合の max(score) を 100 とした線形スケール。
 */
export function calculateSimilarity(
  queryTokens: string[],
  corpus: CorpusEntry[],
  idfMap: Map<string, number>,
  limit: number = 10
): SimilarityResult[] {
  const filteredQuery = queryTokens.filter(isDisplayableToken);
  if (filteredQuery.length === 0) return [];

  const N = corpus.length;
  const dfMap = computeDocumentFrequency(corpus);
  const querySet = new Set(filteredQuery);

  type Draft = {
    entry: CorpusEntry;
    score: number;
    matchedTokens: string[];
    rareMatchedTokens: string[];
  };

  const drafts: Draft[] = [];

  for (const e of corpus) {
    const matched = intersectionTokens(querySet, e.titleTokens);
    if (matched.size === 0) continue;

    let score = 0;
    for (const tok of matched) {
      score += idfMap.get(tok) ?? 0;
    }
    if (score <= 0) continue;

    const matchedTokens = sortMatchedByIdfDesc(matched, idfMap);
    const rareMatchedTokens = pickRareTokens(matchedTokens, dfMap, idfMap, N);

    drafts.push({ entry: e, score, matchedTokens, rareMatchedTokens });
  }

  drafts.sort((a, b) => {
    const rc = b.rareMatchedTokens.length - a.rareMatchedTokens.length;
    if (rc !== 0) return rc;
    const mc = b.matchedTokens.length - a.matchedTokens.length;
    if (mc !== 0) return mc;
    return b.entry.points - a.entry.points;
  });

  const top = drafts.slice(0, limit);
  const maxScore = top.length > 0 ? Math.max(...top.map((x) => x.score)) : 0;

  return top.map(({ entry, score, matchedTokens, rareMatchedTokens }) => ({
    ncode: entry.ncode,
    title: entry.title,
    genre: entry.genre,
    source: entry.source,
    points: entry.points,
    score,
    normalizedScore: maxScore > 0 ? (score / maxScore) * 100 : 0,
    matchedTokens,
    rareMatchedTokens,
  }));
}
