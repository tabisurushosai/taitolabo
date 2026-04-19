import { loadAllDatasets, getAllEntries, getAvailableSources } from "@/lib/data";
import { countTokens, type TokenField } from "@/lib/analyzer";
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
import { TitleAnatomy } from "@/components/TitleAnatomy";

export const dynamic = "force-dynamic";

function buildTokensWithCounts(entries: RankingEntry[]): Array<{
  token: string;
  count: number;
  field: TokenField;
}> {
  const out: Array<{ token: string; count: number; field: TokenField }> = [];

  const pushField = (map: Map<string, number>, field: TokenField) => {
    for (const [token, count] of Array.from(map.entries())) {
      out.push({ token, count, field });
    }
  };

  pushField(countTokens(entries, "titleTokens"), "titleTokens");
  pushField(countTokens(entries, "synopsisTokens"), "synopsisTokens");
  pushField(countTokens(entries, "tags"), "tags");

  return out;
}

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function isRankingSource(s: string): s is RankingSource {
  return Object.prototype.hasOwnProperty.call(RANKING_SOURCE_LABELS, s);
}

function uniqueGenresSorted(entries: RankingEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.genre))).sort((a, b) =>
    a.localeCompare(b, "ja")
  );
}

/** titleTokens と synopsisTokens を合わせたユニーク語数 */
function uniqueTitleAndSynopsisTokenCount(entries: RankingEntry[]): number {
  const s = new Set<string>();
  for (const e of entries) {
    for (const t of e.titleTokens) s.add(t);
    for (const t of e.synopsisTokens) s.add(t);
  }
  return s.size;
}

function uniqueTagTokenCount(entries: RankingEntry[]): number {
  const s = new Set<string>();
  for (const e of entries) {
    for (const t of e.tags) s.add(t);
  }
  return s.size;
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

export default async function Home({ searchParams }: { searchParams: SearchParamsInput }) {
  const rawSource = firstParam(searchParams.source);
  const rawGenre = firstParam(searchParams.genre);

  const allDatasets = loadAllDatasets();
  const allEntriesFlat = getAllEntries(allDatasets);
  const genreOptions = uniqueGenresSorted(allEntriesFlat);

  const selectedSource: RankingSource | null =
    rawSource !== undefined && isRankingSource(rawSource) ? rawSource : null;

  let datasets = allDatasets;
  if (selectedSource !== null) {
    datasets = datasets.filter((d) => d.source === selectedSource);
  }

  const selectedGenre: string | null =
    rawGenre !== undefined && genreOptions.includes(rawGenre) ? rawGenre : null;

  const { entries, entrySources } = getEntriesWithSources(datasets, selectedGenre);

  const tokensWithCounts = buildTokensWithCounts(entries);
  const availableSources = getAvailableSources();
  const noDataGlobally = allEntriesFlat.length === 0;

  const uniqueWordCount = uniqueTitleAndSynopsisTokenCount(entries);
  const uniqueTagCount = uniqueTagTokenCount(entries);

  const hasEntries = entries.length > 0;

  return (
    <main className="min-h-screen">
      <HomeHero
        titleCount={entries.length}
        uniqueWordCount={uniqueWordCount}
        uniqueTagCount={uniqueTagCount}
        showTokenCloudAnchor={hasEntries}
      />

      {noDataGlobally && <EmptyLabInvitationCard />}

      {!noDataGlobally && (
        <section className="sticky top-16 z-20 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md">
          <div className="mx-auto max-w-6xl px-6 py-4">
            <FilterBarWithRouter
              sources={availableSources}
              genres={genreOptions}
              currentSource={selectedSource}
              currentGenre={selectedGenre}
              totalCount={entries.length}
            />
          </div>
        </section>
      )}

      {!noDataGlobally && !hasEntries && (
        <p className="mx-auto max-w-6xl px-6 py-16 text-center text-sm text-slate-500">
          条件に一致するタイトルがありません。フィルタを調整してください。
        </p>
      )}

      {hasEntries && (
        <>
          <div id="token-cloud" className="scroll-mt-28 p-4 sm:scroll-mt-32 sm:p-8">
            <TitleAnatomy
              tokensWithCounts={tokensWithCounts}
              totalEntries={entries.length}
              entries={entries}
              corpusIsEmpty={noDataGlobally}
              selectedSource={selectedSource}
              selectedGenre={selectedGenre}
            />
          </div>

          <DataChartsSection entries={entries} entrySources={entrySources} />
        </>
      )}
    </main>
  );
}
