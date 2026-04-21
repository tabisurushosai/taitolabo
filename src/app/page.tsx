import { Suspense } from "react";
import { loadAllDatasets, getAvailableSources } from "@/lib/data";
import { sortGenres } from "@/lib/genreOrder";
import { sortSources } from "@/lib/sourceOrder";
import { countTokenWorksDeduped, type TokenField } from "@/lib/analyzer";
import { computeHeroKpis } from "@/lib/homeKpi";
import {
  filterByMinOccurrence,
  limitDisplayTokens,
  MIN_TAG_OCCURRENCE,
  MIN_TOKEN_OCCURRENCE,
  MIN_WORKS_WITH_TOKEN,
  type TokenCountPair,
} from "@/lib/tokenFilter";
import {
  RANKING_SOURCE_LABELS,
  type RankingDataset,
  type RankingEntry,
  type RankingSource,
} from "@/lib/types";
import { DataChartsSection } from "@/components/DataCharts";
import { EmptyLabInvitationCard } from "@/components/EmptyLabInvitationCard";
import { FilterBarWithRouter } from "@/components/FilterBar";
import { HomeHero } from "@/components/HomeHero";
import { SimilarityCloudBridgeProvider } from "@/components/SimilarityCloudBridge";
import { UserSearchedTitleProvider } from "@/components/UserSearchedTitleContext";
import { TitleSimilarityCheck } from "@/components/TitleSimilarityCheck";
import { TitleAnatomy } from "@/components/TitleAnatomy";
import Loading from "./loading";

export const dynamic = "force-dynamic";

function mapToTokenCountPairs(map: Map<string, number>): TokenCountPair[] {
  return Array.from(map.entries()).map(([token, count]) => ({ token, count }));
}

function buildTokensWithCounts(entries: RankingEntry[]): {
  tokensWithCounts: Array<{ token: string; count: number; field: TokenField }>;
  displayOmittedByField: Record<TokenField, number>;
} {
  const titleLimited = limitDisplayTokens(
    mapToTokenCountPairs(
      filterByMinOccurrence(countTokenWorksDeduped(entries, "titleTokens"), MIN_WORKS_WITH_TOKEN)
    )
  );
  const synopsisLimited = limitDisplayTokens(
    mapToTokenCountPairs(
      filterByMinOccurrence(countTokenWorksDeduped(entries, "synopsisTokens"), MIN_WORKS_WITH_TOKEN)
    )
  );
  const tagsLimited = limitDisplayTokens(
    mapToTokenCountPairs(filterByMinOccurrence(countTokenWorksDeduped(entries, "tags"), MIN_WORKS_WITH_TOKEN))
  );

  const tokensWithCounts = [
    ...titleLimited.displayed.map((r) => ({ ...r, field: "titleTokens" as const })),
    ...synopsisLimited.displayed.map((r) => ({ ...r, field: "synopsisTokens" as const })),
    ...tagsLimited.displayed.map((r) => ({ ...r, field: "tags" as const })),
  ];

  return {
    tokensWithCounts,
    displayOmittedByField: {
      titleTokens: titleLimited.omitted,
      synopsisTokens: synopsisLimited.omitted,
      tags: tagsLimited.omitted,
    },
  };
}

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function isRankingSource(s: string): s is RankingSource {
  return Object.prototype.hasOwnProperty.call(RANKING_SOURCE_LABELS, s);
}

type SearchParamsInput = {
  source?: string | string[];
  genre?: string | string[];
};

function getEntriesWithSources(
  datasets: RankingDataset[],
  selectedGenre: string | null
): { entries: RankingEntry[]; entrySources: RankingSource[] } {
  const entries: RankingEntry[] = [];
  const entrySources: RankingSource[] = [];
  for (const d of datasets) {
    for (const e of d.entries) {
      if (selectedGenre !== null && e.genre !== selectedGenre) continue;
      entries.push(e);
      entrySources.push(d.source);
    }
  }
  return { entries, entrySources };
}

async function HomeContent({ searchParams }: { searchParams: SearchParamsInput }) {
  const rawSource = firstParam(searchParams.source);
  const rawGenre = firstParam(searchParams.genre);

  const allDatasets = await loadAllDatasets();
  const allEntriesFlat = allDatasets.flatMap((d) => d.entries);
  const genreOptions = sortGenres(Array.from(new Set(allEntriesFlat.map((e) => e.genre))));

  const selectedSource: RankingSource | null =
    rawSource !== undefined && isRankingSource(rawSource) ? rawSource : null;

  let datasets = allDatasets;
  if (selectedSource !== null) {
    datasets = datasets.filter((d) => d.source === selectedSource);
  }

  const selectedGenre: string | null =
    rawGenre !== undefined && genreOptions.includes(rawGenre) ? rawGenre : null;

  const { entries, entrySources } = getEntriesWithSources(datasets, selectedGenre);

  const { tokensWithCounts, displayOmittedByField } = buildTokensWithCounts(entries);
  const availableSources = sortSources(await getAvailableSources());
  const noDataGlobally = allEntriesFlat.length === 0;

  const heroKpis = computeHeroKpis(entries);

  const hasEntries = entries.length > 0;

  const wordKpiTooltip = hasEntries
    ? `全ユニーク語: ${heroKpis.rawUniqueWordCount}個 / ${MIN_TOKEN_OCCURRENCE}回以上出現: ${heroKpis.uniqueWordCount}個`
    : undefined;
  const tagKpiTooltip = hasEntries
    ? `全タグ: ${heroKpis.rawUniqueTagCount}個 / ${MIN_TAG_OCCURRENCE}回以上出現: ${heroKpis.uniqueTagCount}個`
    : undefined;

  return (
    <main className="min-h-screen">
      <HomeHero
        titleCount={heroKpis.titleCount}
        uniqueWordCount={heroKpis.uniqueWordCount}
        uniqueTagCount={heroKpis.uniqueTagCount}
        wordBreakdownTooltip={wordKpiTooltip}
        tagBreakdownTooltip={tagKpiTooltip}
        exploreEnabled={!noDataGlobally}
        hasTokenCloud={hasEntries}
      />

      {noDataGlobally && <EmptyLabInvitationCard />}

      {!noDataGlobally && (
        <SimilarityCloudBridgeProvider>
          {/* 類似検索で確定したタイトル（散布図の highlight・サマリ連動）。RSC のため state はクライアント Provider で保持 */}
          <UserSearchedTitleProvider>
            <section
              id="filter-bar"
              className="scroll-mt-28 border-b border-slate-800 bg-slate-900/50 sm:scroll-mt-32"
            >
              <div className="mx-auto max-w-6xl px-3 py-3 sm:px-6 sm:py-5">
                <FilterBarWithRouter
                  sources={availableSources}
                  genres={genreOptions}
                  currentSource={selectedSource}
                  currentGenre={selectedGenre}
                  totalCount={entries.length}
                />
              </div>
            </section>

            {!hasEntries && (
              <p className="mx-auto max-w-6xl px-6 py-16 text-center text-sm text-slate-500">
                条件に一致するタイトルがありません。フィルタを調整してください。
              </p>
            )}

            {hasEntries && (
              <div
                id="token-cloud"
                className="scroll-mt-28 overflow-x-hidden px-3 py-8 sm:scroll-mt-32 sm:p-8 sm:py-10"
              >
                <TitleAnatomy
                  tokensWithCounts={tokensWithCounts}
                  displayOmittedByField={displayOmittedByField}
                  entries={entries}
                  corpusIsEmpty={noDataGlobally}
                  selectedSource={selectedSource}
                  selectedGenre={selectedGenre}
                />
              </div>
            )}

            <section
              id="similarity-check"
              className="relative z-20 scroll-mt-28 border-b border-slate-800 bg-slate-950/70 pointer-events-auto sm:scroll-mt-32"
            >
              <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
                <TitleSimilarityCheck />
              </div>
            </section>

            {/* entries / entrySources は getEntriesWithSources（ジャンル）＋データセットのソース絞り込み済み。散布図・サマリは FilterBar と同一の配列 */}
            <DataChartsSection
              entries={entries}
              entrySources={entrySources}
              selectedSource={selectedSource}
              selectedGenre={selectedGenre}
            />
          </UserSearchedTitleProvider>
        </SimilarityCloudBridgeProvider>
      )}
    </main>
  );
}

export default function Home({ searchParams }: { searchParams: SearchParamsInput }) {
  return (
    <Suspense fallback={<Loading />}>
      <HomeContent searchParams={searchParams} />
    </Suspense>
  );
}
