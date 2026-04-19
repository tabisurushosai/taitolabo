import Link from "next/link";
import { loadAllDatasets, getAllEntries, getAvailableSources } from "@/lib/data";
import { countTokens, type TokenField } from "@/lib/analyzer";
import { RANKING_SOURCE_LABELS, type RankingEntry, type RankingSource } from "@/lib/types";
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

type SearchParamsInput = {
  source?: string | string[];
  genre?: string | string[];
};

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

  let entries = getAllEntries(datasets);

  const selectedGenre: string | null =
    rawGenre !== undefined && genreOptions.includes(rawGenre) ? rawGenre : null;

  if (selectedGenre !== null) {
    entries = entries.filter((e) => e.genre === selectedGenre);
  }

  const tokensWithCounts = buildTokensWithCounts(entries);
  const availableSources = getAvailableSources();
  const noDataGlobally = allEntriesFlat.length === 0;

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-amber-400 sm:text-3xl md:text-4xl">タイトラボ</h1>
        <p className="mt-2 text-sm text-slate-400">ランキング作品のトークンを、出現数に応じてサイズと色で見せます。</p>
      </header>

      {noDataGlobally && (
        <div className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-amber-100/95 sm:px-5">
          <p className="font-medium text-amber-200">ランキングデータがまだありません</p>
          <p className="mt-2 text-amber-100/80">
            <Link
              href="/admin/ingest"
              className="font-semibold underline decoration-amber-500/60 underline-offset-2 hover:text-amber-50"
            >
              データ取り込み画面
            </Link>
            （<code className="rounded bg-slate-900/80 px-1 text-xs">/admin/ingest</code>
            ）で JSON を検証し、リポジトリの{" "}
            <code className="rounded bg-slate-900/80 px-1 text-xs">data/rankings/</code> に保存してからデプロイしてください。手順はルートの{" "}
            <span className="font-medium text-amber-200">PDF_TO_JSON_PROMPT.md</span> と README を参照してください。
          </p>
        </div>
      )}

      <TitleAnatomy
        tokensWithCounts={tokensWithCounts}
        totalEntries={entries.length}
        entries={entries}
        availableSources={availableSources}
        selectedSource={selectedSource}
        genreOptions={genreOptions}
        selectedGenre={selectedGenre}
      />
    </main>
  );
}
