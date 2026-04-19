import { RankingEntry } from "./types";

export type TokenField = "titleTokens" | "synopsisTokens" | "tags";

const TOKEN_FIELDS: readonly TokenField[] = ["titleTokens", "synopsisTokens", "tags"];

function getFieldTokens(entry: RankingEntry, field: TokenField): string[] {
  return entry[field];
}

/** コーパス全体で、あるフィールドに token が出現する回数 */
function countTokenOccurrencesInField(
  entries: RankingEntry[],
  field: TokenField,
  token: string
): number {
  let n = 0;
  for (const e of entries) {
    for (const t of getFieldTokens(e, field)) {
      if (t === token) n += 1;
    }
  }
  return n;
}

/** コーパス全体で、3フィールド合計の出現回数 */
function countTokenOccurrencesAllFields(entries: RankingEntry[], token: string): number {
  let n = 0;
  for (const field of TOKEN_FIELDS) {
    n += countTokenOccurrencesInField(entries, field, token);
  }
  return n;
}

function collectUniqueTokensMinLength(entries: RankingEntry[], minLen: number): Set<string> {
  const set = new Set<string>();
  for (const e of entries) {
    for (const field of TOKEN_FIELDS) {
      for (const t of getFieldTokens(e, field)) {
        if (t.length >= minLen) set.add(t);
      }
    }
  }
  return set;
}

function normalizeInput(s: string): string {
  return s.normalize("NFKC");
}

/** 入力に対して部分一致する既知トークン（長さ制約つき） */
function findMatchingKnownTokens(
  normalizedInput: string,
  knownTokens: Iterable<string>,
  minLen: number
): string[] {
  const matched: string[] = [];
  for (const token of Array.from(knownTokens)) {
    if (token.length < minLen) continue;
    if (normalizedInput.includes(token)) matched.push(token);
  }
  return matched;
}

function computeUnmatchedCharCount(normalizedInput: string, matchedTokens: readonly string[]): number {
  const n = normalizedInput.length;
  if (n === 0) return 0;
  const covered = new Array<boolean>(n).fill(false);
  for (const token of matchedTokens) {
    if (token.length < 2) continue;
    let start = 0;
    while (start <= n - token.length) {
      const idx = normalizedInput.indexOf(token, start);
      if (idx === -1) break;
      for (let i = 0; i < token.length; i += 1) {
        covered[idx + i] = true;
      }
      start = idx + 1;
    }
  }
  let unmatched = 0;
  for (let i = 0; i < n; i += 1) {
    if (!covered[i]) unmatched += 1;
  }
  return unmatched;
}

export function countTokens(entries: RankingEntry[], field: TokenField): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    for (const t of getFieldTokens(e, field)) {
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return map;
}

export function coOccurringTokens(
  entries: RankingEntry[],
  field: TokenField,
  targetToken: string
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of entries) {
    const tokens = getFieldTokens(e, field);
    if (!tokens.includes(targetToken)) continue;
    for (const t of tokens) {
      if (t === targetToken) continue;
      map.set(t, (map.get(t) ?? 0) + 1);
    }
  }
  return map;
}

const MIN_MATCH_LEN = 2;

export function detectKnownTokensInInput(
  userInput: string,
  entries: RankingEntry[]
): {
  matched: Array<{ token: string; field: TokenField; frequency: number }>;
  unmatchedLength: number;
} {
  const normalized = normalizeInput(userInput);
  const known = collectUniqueTokensMinLength(entries, MIN_MATCH_LEN);
  const matchedTokens = findMatchingKnownTokens(normalized, known, MIN_MATCH_LEN);
  const uniqueMatched = Array.from(new Set(matchedTokens)).sort((a, b) => a.localeCompare(b, "ja"));

  const matched: Array<{ token: string; field: TokenField; frequency: number }> = [];
  for (const token of uniqueMatched) {
    for (const field of TOKEN_FIELDS) {
      const frequency = countTokenOccurrencesInField(entries, field, token);
      if (frequency > 0) {
        matched.push({ token, field, frequency });
      }
    }
  }

  const unmatchedLength = computeUnmatchedCharCount(normalized, uniqueMatched);

  return { matched, unmatchedLength };
}

export function calculateCorrelationScore(
  userInput: string,
  entries: RankingEntry[]
): {
  score: number;
  matchedTokenCount: number;
  totalEntries: number;
} {
  const totalEntries = entries.length;
  if (totalEntries === 0) {
    return { score: 0, matchedTokenCount: 0, totalEntries: 0 };
  }

  const normalized = normalizeInput(userInput);
  const known = collectUniqueTokensMinLength(entries, MIN_MATCH_LEN);
  const matchedList = findMatchingKnownTokens(normalized, known, MIN_MATCH_LEN);
  const uniqueMatched = Array.from(new Set(matchedList));

  let totalFreqSum = 0;
  for (const token of uniqueMatched) {
    totalFreqSum += countTokenOccurrencesAllFields(entries, token);
  }

  const raw = totalFreqSum / totalEntries;
  const score = Math.min(100, Math.round(raw * 100));

  return {
    score,
    matchedTokenCount: uniqueMatched.length,
    totalEntries,
  };
}

function entryAllTokens(entry: RankingEntry): Set<string> {
  const set = new Set<string>();
  for (const field of TOKEN_FIELDS) {
    for (const t of getFieldTokens(entry, field)) {
      if (t.length >= MIN_MATCH_LEN) set.add(t);
    }
  }
  return set;
}

export function findSimilarEntries(
  userInput: string,
  entries: RankingEntry[],
  limit: number = 5
): Array<{
  entry: RankingEntry;
  sharedTokens: string[];
}> {
  const normalized = normalizeInput(userInput);
  const known = collectUniqueTokensMinLength(entries, MIN_MATCH_LEN);
  const inputTokens = new Set(findMatchingKnownTokens(normalized, known, MIN_MATCH_LEN));

  const scored: Array<{ entry: RankingEntry; sharedTokens: string[]; count: number }> = [];
  for (const entry of entries) {
    const entryTokens = entryAllTokens(entry);
    const shared: string[] = [];
    for (const t of Array.from(inputTokens)) {
      if (entryTokens.has(t)) shared.push(t);
    }
    shared.sort((a, b) => a.localeCompare(b, "ja"));
    scored.push({ entry, sharedTokens: shared, count: shared.length });
  }

  scored.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.entry.title.localeCompare(b.entry.title, "ja");
  });

  return scored.slice(0, limit).map(({ entry, sharedTokens }) => ({ entry, sharedTokens }));
}

export function suggestAdjacentTokens(
  userInput: string,
  entries: RankingEntry[],
  field: TokenField,
  limit: number = 10
): Array<{ token: string; count: number }> {
  const normalized = normalizeInput(userInput);
  const counts = countTokens(entries, field);
  const ranked = Array.from(counts.entries())
    .filter(([token]) => token.length >= MIN_MATCH_LEN && !normalized.includes(token))
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0], "ja");
    })
    .slice(0, limit)
    .map(([token, count]) => ({ token, count }));

  return ranked;
}
