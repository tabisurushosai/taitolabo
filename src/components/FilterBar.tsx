"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import CountUp from "react-countup";
import { ChevronDown, ChevronUp } from "lucide-react";
import { RANKING_SOURCE_LABELS, type RankingSource } from "@/lib/types";

export type FilterBarChange = {
  source: RankingSource | null;
  genre: string | null;
};

export type FilterBarProps = {
  sources: RankingSource[];
  genres: string[];
  currentSource: RankingSource | null;
  currentGenre: string | null;
  totalCount: number;
  onChange: (next: FilterBarChange) => void;
};

const pillSelected =
  "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/30";
const pillIdle =
  "bg-transparent text-slate-400 border border-slate-700 hover:border-amber-400/50";

function pillClass(active: boolean) {
  return `inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1.5 text-xs transition-all duration-200 sm:px-4 sm:py-2 sm:text-sm ${
    active ? pillSelected : pillIdle
  }`;
}

const chipRowClass = "flex flex-wrap gap-2";

const labelClass = "text-xs text-slate-500 uppercase tracking-wider";

export function FilterBar({
  sources,
  genres,
  currentSource,
  currentGenre,
  totalCount,
  onChange,
}: FilterBarProps) {
  const filterActive = currentSource !== null || currentGenre !== null;
  /** モバイル・デスクトップ共通: 既定は閉じて 1 行だけ。開いたときだけソース・ジャンル一覧 */
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const applyFilter = useCallback(
    (next: FilterBarChange) => {
      onChange(next);
      setFiltersExpanded(false);
    },
    [onChange]
  );

  const filterSummary = (() => {
    const srcLabel =
      currentSource === null ? "全ソース" : RANKING_SOURCE_LABELS[currentSource];
    const genreLabel = currentGenre === null ? "全ジャンル" : currentGenre;
    return `${srcLabel} · ${genreLabel}`;
  })();

  return (
    <div className="flex flex-col gap-3">
      {/* 常時: 1 行だけ（件数・現在の絞り込み・開閉） */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <p className="min-w-0 flex-1 text-sm leading-snug text-slate-400">
          <span className="tabular-nums font-medium text-slate-200">
            <CountUp end={totalCount} duration={0.55} preserveValue useEasing />
          </span>
          <span className="ml-1">件 · </span>
          <span className="text-slate-500">{filterSummary}</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {filterActive && (
            <button
              type="button"
              onClick={() => applyFilter({ source: null, genre: null })}
              className="rounded-full px-2.5 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-800/80 hover:text-slate-300"
            >
              リセット
            </button>
          )}
          <button
            type="button"
            onClick={() => setFiltersExpanded((v) => !v)}
            className="inline-flex min-h-[40px] min-w-0 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 py-2 text-xs font-medium text-amber-300 transition-colors hover:border-amber-500/50 hover:bg-slate-800 sm:min-h-0 sm:py-1.5"
            aria-expanded={filtersExpanded}
            aria-controls="filter-bar-panel"
            id="filter-bar-toggle"
          >
            {filtersExpanded ? (
              <>
                閉じる
                <ChevronUp className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </>
            ) : (
              <>
                ソース・ジャンル
                <ChevronDown className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>

      {/* 展開時のみ: チップ一覧（スマホは長いときは内部スクロール） */}
      {filtersExpanded ? (
        <div
          id="filter-bar-panel"
          role="region"
          aria-labelledby="filter-bar-toggle"
          className="max-h-[70vh] overflow-y-auto overflow-x-hidden overscroll-contain rounded-lg border border-slate-800/90 bg-slate-950/40 px-3 py-4 sm:max-h-none sm:overflow-visible sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between lg:gap-8">
            <div className="flex min-w-0 flex-1 flex-col gap-5 lg:flex-row lg:flex-wrap lg:gap-8">
              <div className="min-w-0 space-y-2">
                <p className={labelClass}>ソース</p>
                <div className={chipRowClass}>
                  <button
                    type="button"
                    className={pillClass(currentSource === null)}
                    onClick={() => applyFilter({ source: null, genre: currentGenre })}
                  >
                    全ソース
                  </button>
                  {sources.map((src) => (
                    <button
                      key={src}
                      type="button"
                      className={pillClass(currentSource === src)}
                      onClick={() => applyFilter({ source: src, genre: currentGenre })}
                    >
                      {RANKING_SOURCE_LABELS[src]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0 space-y-2">
                <p className={labelClass}>ジャンル</p>
                <div className={chipRowClass}>
                  <button
                    type="button"
                    className={pillClass(currentGenre === null)}
                    onClick={() => applyFilter({ source: currentSource, genre: null })}
                  >
                    全ジャンル
                  </button>
                  {genres.map((g) => (
                    <button
                      key={g}
                      type="button"
                      title={g}
                      className={pillClass(currentGenre === g)}
                      onClick={() => applyFilter({ source: currentSource, genre: g })}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-800/80 pt-3 sm:gap-4 lg:ml-auto lg:border-0 lg:pt-0">
              <p className="text-sm text-slate-400">
                <span className="tabular-nums font-medium text-slate-200">
                  <CountUp end={totalCount} duration={0.55} preserveValue useEasing />
                </span>
                件のタイトルを解剖中
              </p>
              {filterActive && (
                <button
                  type="button"
                  onClick={() => applyFilter({ source: null, genre: null })}
                  className="rounded-full px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-800/80 hover:text-slate-300"
                >
                  × リセット
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type FilterBarWithRouterProps = Omit<FilterBarProps, "onChange">;

export function FilterBarWithRouter(props: FilterBarWithRouterProps) {
  const router = useRouter();

  const onChange = useCallback(
    (next: FilterBarChange) => {
      const sp = new URLSearchParams();
      if (next.source !== null) sp.set("source", next.source);
      if (next.genre !== null && next.genre.length > 0) sp.set("genre", next.genre);
      const q = sp.toString();
      router.push(q ? `/?${q}` : "/", { scroll: false });
    },
    [router]
  );

  return <FilterBar {...props} onChange={onChange} />;
}
