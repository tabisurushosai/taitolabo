"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CopyTextButton } from "@/components/CopyTextButton";
import { RANKING_SOURCE_LABELS, type RankingEntry, type RankingSource } from "@/lib/types";
import { formatTitleAnatomyTokenShareText } from "@/lib/share-text";
import { coOccurringTokens, type TokenField } from "@/lib/analyzer";

type Props = {
  tokensWithCounts: Array<{ token: string; count: number; field: TokenField }>;
  totalEntries: number;
  entries: RankingEntry[];
  availableSources: RankingSource[];
  selectedSource: RankingSource | null;
  genreOptions: string[];
  selectedGenre: string | null;
};

type TabId = TokenField;

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "titleTokens", label: "タイトル" },
  { id: "synopsisTokens", label: "あらすじ" },
  { id: "tags", label: "タグ" },
];

/** text-sm 相当 〜 text-5xl 相当（px） */
const FONT_MIN_PX = 14;
const FONT_MAX_PX = 48;

function interpolateCount(
  count: number,
  minCount: number,
  maxCount: number
): number {
  if (maxCount === minCount) return 0.5;
  return (count - minCount) / (maxCount - minCount);
}

function fontSizePx(count: number, minCount: number, maxCount: number): number {
  const t = interpolateCount(count, minCount, maxCount);
  return FONT_MIN_PX + t * (FONT_MAX_PX - FONT_MIN_PX);
}

function listHref(source: RankingSource | null, genre: string | null): string {
  const sp = new URLSearchParams();
  if (source !== null) sp.set("source", source);
  if (genre !== null && genre.length > 0) sp.set("genre", genre);
  const q = sp.toString();
  return q ? `/?${q}` : "/";
}

const filterLinkClass = (active: boolean) =>
  `inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20" : "bg-slate-800/90 text-slate-300 hover:bg-slate-700"
  }`;

function countEntriesWithToken(
  list: RankingEntry[],
  field: TokenField,
  token: string
): number {
  let n = 0;
  for (const e of list) {
    if (e[field].includes(token)) n += 1;
  }
  return n;
}

function topTitlesByRank(
  list: RankingEntry[],
  field: TokenField,
  token: string,
  limit: number
): RankingEntry[] {
  return list
    .filter((e) => e[field].includes(token))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
}

export function TitleAnatomy({
  tokensWithCounts,
  totalEntries,
  entries,
  availableSources,
  selectedSource,
  genreOptions,
  selectedGenre,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("titleTokens");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const setTab = (id: TabId) => {
    setActiveTab(id);
    setSelectedToken(null);
  };

  const filtered = useMemo(() => {
    return tokensWithCounts
      .filter((row) => row.field === activeTab)
      .sort((a, b) => b.count - a.count);
  }, [tokensWithCounts, activeTab]);

  const { minCount, maxCount } = useMemo(() => {
    if (filtered.length === 0) return { minCount: 0, maxCount: 0 };
    let minV = Infinity;
    let maxV = -Infinity;
    for (const row of filtered) {
      if (row.count < minV) minV = row.count;
      if (row.count > maxV) maxV = row.count;
    }
    return { minCount: minV, maxCount: maxV };
  }, [filtered]);

  const coOccurrenceMap = useMemo(() => {
    if (!selectedToken) return new Map<string, number>();
    return coOccurringTokens(entries, activeTab, selectedToken);
  }, [entries, activeTab, selectedToken]);

  const coOccurrenceTop10 = useMemo(() => {
    return Array.from(coOccurrenceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [coOccurrenceMap]);

  const containingCount = useMemo(() => {
    if (!selectedToken) return 0;
    return countEntriesWithToken(entries, activeTab, selectedToken);
  }, [entries, activeTab, selectedToken]);

  const topTitles = useMemo(() => {
    if (!selectedToken) return [];
    return topTitlesByRank(entries, activeTab, selectedToken, 3);
  }, [entries, activeTab, selectedToken]);

  const tokenShareText = useMemo(() => {
    if (!selectedToken) return "";
    return formatTitleAnatomyTokenShareText({
      token: selectedToken,
      field: activeTab,
      totalEntries,
      containingCount,
      selectedSource,
      selectedGenre,
      coOccurrence: coOccurrenceTop10.map(([t, c]) => ({ token: t, count: c })),
    });
  }, [
    selectedToken,
    activeTab,
    totalEntries,
    containingCount,
    selectedSource,
    selectedGenre,
    coOccurrenceTop10,
  ]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 sm:p-5">
        <p className="text-base font-semibold text-slate-100">
          <span className="tabular-nums text-amber-400">{totalEntries}</span>
          件のタイトルを解剖中
        </p>

        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-end lg:gap-8">
          <div className="min-w-0 flex-1 space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">ソース</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={listHref(null, selectedGenre)}
                className={filterLinkClass(selectedSource === null)}
                scroll={false}
              >
                全ソース
              </Link>
              {availableSources.map((src) => (
                <Link
                  key={src}
                  href={listHref(src, selectedGenre)}
                  className={filterLinkClass(selectedSource === src)}
                  scroll={false}
                >
                  {RANKING_SOURCE_LABELS[src]}
                </Link>
              ))}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">ジャンル</span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={listHref(selectedSource, null)}
                className={filterLinkClass(selectedGenre === null)}
                scroll={false}
              >
                全ジャンル
              </Link>
              {genreOptions.map((g) => (
                <Link
                  key={g}
                  href={listHref(selectedSource, g)}
                  className={filterLinkClass(selectedGenre === g)}
                  scroll={false}
                  title={g}
                >
                  {g}
                </Link>
              ))}
            </div>
          </div>

          <div className="shrink-0">
            <Link
              href="/"
              className="inline-flex items-center rounded-full border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:border-amber-500/50 hover:text-amber-200"
              scroll={false}
            >
              リセット
            </Link>
          </div>
        </div>
      </div>

      <div className="flex min-h-[60vh] flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3" role="tablist" aria-label="表示フィールド">
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(tab.id)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                      : "bg-slate-800/90 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div
            className="flex flex-wrap content-start gap-x-3 gap-y-4 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 sm:p-6"
            role="tabpanel"
          >
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500">このタブに表示するトークンがありません。</p>
            ) : (
              filtered.map((row) => {
                const selected = selectedToken === row.token;
                return (
                  <button
                    key={`${activeTab}-${row.token}`}
                    type="button"
                    onClick={() => setSelectedToken(row.token)}
                    className={`inline-block cursor-pointer rounded-lg px-2 py-1 text-amber-400 transition-transform duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] hover:z-10 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                      selected ? "ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950" : ""
                    }`}
                    style={{
                      fontSize: `${fontSizePx(row.count, minCount, maxCount)}px`,
                      fontWeight: 600,
                    }}
                    title={`${row.token}（${row.count}）`}
                  >
                    {row.token}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 self-start rounded-2xl border border-slate-800 bg-slate-900/50 p-4 lg:sticky lg:top-8 lg:w-80">
          {selectedToken === null ? (
            <>
              <p className="text-sm leading-relaxed text-slate-500">
                トークンをクリックすると、共起語や該当作品が表示されます。
              </p>
              <div className="mt-4 min-h-[120px] rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40" />
              <p className="mt-3 text-xs text-slate-600">集計対象: {totalEntries} エントリ</p>
            </>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="min-w-0 flex-1 break-words text-2xl font-bold leading-tight text-amber-300">
                  {selectedToken}
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedToken(null)}
                  className="shrink-0 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
                  aria-label="選択を解除"
                >
                  <span className="text-xl leading-none" aria-hidden>
                    ×
                  </span>
                </button>
              </div>

              <p className="text-sm text-slate-300">
                このトークンを含む作品数：
                <span className="font-semibold tabular-nums text-amber-400">
                  {" "}
                  {containingCount}
                </span>
                <span className="text-slate-500"> / 全{totalEntries}件中</span>
              </p>

              <CopyTextButton
                text={tokenShareText}
                fallbackRows={6}
                className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:border-amber-500/50 hover:text-amber-100"
              >
                この語の統計をコピー
              </CopyTextButton>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">共起 TOP10</h3>
                {coOccurrenceTop10.length === 0 ? (
                  <p className="text-xs text-slate-600">他に共起するトークンはありません。</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {coOccurrenceTop10.map(([tok, cnt]) => (
                      <li key={tok}>
                        <button
                          type="button"
                          onClick={() => setSelectedToken(tok)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-200 transition-colors hover:border-amber-400/70 hover:bg-amber-500/20"
                        >
                          <span>{tok}</span>
                          <span className="tabular-nums text-slate-400">{cnt}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  該当タイトル（rank 上位3件）
                </h3>
                {topTitles.length === 0 ? (
                  <p className="text-xs text-slate-600">該当作品がありません。</p>
                ) : (
                  <ol className="list-decimal space-y-2 pl-4 text-sm text-slate-200">
                    {topTitles.map((e) => (
                      <li key={`${e.rank}-${e.title}`} className="marker:text-amber-500/80">
                        <span className="text-slate-500">#{e.rank}</span> {e.title}
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              <p className="text-xs text-slate-600">集計対象: {totalEntries} エントリ</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
