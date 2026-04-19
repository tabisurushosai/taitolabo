"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import CountUp from "react-countup";
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
  return `inline-flex items-center justify-center rounded-full px-4 py-2 text-sm transition-all duration-200 ${
    active ? pillSelected : pillIdle
  }`;
}

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

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-6 sm:flex-row sm:flex-wrap sm:gap-8">
          <div className="min-w-0 space-y-2">
            <p className={labelClass}>ソース</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={pillClass(currentSource === null)}
                onClick={() => onChange({ source: null, genre: currentGenre })}
              >
                全ソース
              </button>
              {sources.map((src) => (
                <button
                  key={src}
                  type="button"
                  className={pillClass(currentSource === src)}
                  onClick={() => onChange({ source: src, genre: currentGenre })}
                >
                  {RANKING_SOURCE_LABELS[src]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0 space-y-2">
            <p className={labelClass}>ジャンル</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={pillClass(currentGenre === null)}
                onClick={() => onChange({ source: currentSource, genre: null })}
              >
                全ジャンル
              </button>
              {genres.map((g) => (
                <button
                  key={g}
                  type="button"
                  title={g}
                  className={pillClass(currentGenre === g)}
                  onClick={() => onChange({ source: currentSource, genre: g })}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:ml-auto lg:justify-end">
          <p className="text-sm text-slate-400">
            <span className="tabular-nums font-medium text-slate-200">
              <CountUp
                end={totalCount}
                duration={0.55}
                preserveValue
                useEasing
              />
            </span>
            件のタイトルを解剖中
          </p>
          {filterActive && (
            <button
              type="button"
              onClick={() => onChange({ source: null, genre: null })}
              className="rounded-full px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-800/80 hover:text-slate-300"
            >
              × リセット
            </button>
          )}
        </div>
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
