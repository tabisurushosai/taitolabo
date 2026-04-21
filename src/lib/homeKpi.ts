import { countTokens } from "@/lib/analyzer";
import { dedupeRankingEntriesByWork } from "@/lib/rankingDedupe";
import { filterByMinOccurrence, MIN_TAG_OCCURRENCE, MIN_TOKEN_OCCURRENCE } from "@/lib/tokenFilter";
import type { RankingEntry } from "@/lib/types";

/** titleTokens / synopsisTokens それぞれで最小出現回数を満たす語のユニーク数（和集合） */
export function uniqueTitleAndSynopsisTokenCount(entries: RankingEntry[]): number {
  const titleOk = filterByMinOccurrence(
    countTokens(entries, "titleTokens"),
    MIN_TOKEN_OCCURRENCE
  );
  const synOk = filterByMinOccurrence(
    countTokens(entries, "synopsisTokens"),
    MIN_TOKEN_OCCURRENCE
  );
  return new Set<string>([...titleOk.keys(), ...synOk.keys()]).size;
}

/** 最小出現回数のフィルタ前：タイトル・あらすじに現れる語のユニーク数（和集合） */
export function rawUniqueTitleAndSynopsisTokenCount(entries: RankingEntry[]): number {
  const tm = countTokens(entries, "titleTokens");
  const sm = countTokens(entries, "synopsisTokens");
  return new Set<string>([...tm.keys(), ...sm.keys()]).size;
}

export function uniqueTagTokenCount(entries: RankingEntry[]): number {
  return filterByMinOccurrence(countTokens(entries, "tags"), MIN_TAG_OCCURRENCE).size;
}

export function computeRawUniqueTagCount(entries: RankingEntry[]): number {
  return countTokens(entries, "tags").size;
}

export type HomeHeroKpis = {
  titleCount: number;
  uniqueWordCount: number;
  uniqueTagCount: number;
  rawUniqueWordCount: number;
  rawUniqueTagCount: number;
};

/** ソース・ジャンルで絞り込んだ `entries` に対するヒーロー KPI（tokenFilter 閾値適用済み） */
export function computeHeroKpis(entries: RankingEntry[]): HomeHeroKpis {
  return {
    titleCount: dedupeRankingEntriesByWork(entries).length,
    uniqueWordCount: uniqueTitleAndSynopsisTokenCount(entries),
    uniqueTagCount: uniqueTagTokenCount(entries),
    rawUniqueWordCount: rawUniqueTitleAndSynopsisTokenCount(entries),
    rawUniqueTagCount: computeRawUniqueTagCount(entries),
  };
}
