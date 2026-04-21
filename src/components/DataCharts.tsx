"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CooccurrenceNetworkSection } from "@/components/CooccurrenceNetworkSection";
import { TitleLengthScatter } from "@/components/TitleLengthScatter";
import { TitleLengthStats } from "@/components/TitleLengthStats";
import { TrendSection } from "@/components/TrendSection";
import { useOptionalTitleTokenDetailBridge } from "@/components/TitleTokenDetailBridge";
import { useUserSearchedTitle } from "@/components/UserSearchedTitleContext";
import { titleCharCount } from "@/lib/titleLength";
import { dedupeRankingEntriesByWork, dedupeRankingEntrySourcePairs } from "@/lib/rankingDedupe";
import type { RankingEntry, RankingSource } from "@/lib/types";
import { genreSliceColor } from "@/lib/genreChartColors";
import { shortenGenreLabel, sortGenres } from "@/lib/genreOrder";

/** ダーク背景のツールチップ用（デフォルトの黒文字を避ける） */
const chartTooltipProps = {
  contentStyle: {
    backgroundColor: "rgb(15 23 42 / 0.95)",
    border: "1px solid rgb(51 65 85)",
    borderRadius: "8px",
    fontSize: "12px",
    color: "#e2e8f0",
  },
  itemStyle: { color: "#e2e8f0" },
  labelStyle: { color: "#cbd5e1" },
} as const;

/** ホバー時は扇をわずかに太らせるだけ。SVG テキストは出さない。 */
function genrePieActiveShape(props: unknown) {
  const p = props as Record<string, unknown>;
  const outer = p.outerRadius;
  const outerRadius =
    typeof outer === "number" && !Number.isNaN(outer) ? outer + 3 : outer;
  return (
    <Sector
      {...(props as object)}
      outerRadius={outerRadius as number}
      stroke="rgb(148 163 184 / 0.65)"
      strokeWidth={2}
    />
  );
}

const cardMotion = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45, ease: "easeOut" },
} as const;

function isNarouSource(s: RankingSource): boolean {
  return s.startsWith("narou_");
}

function isKakuyomuSource(s: RankingSource): boolean {
  return s.startsWith("kakuyomu_");
}

/** ランキングソース名の期間部分（ジャンル・サイトを区別しない） */
function periodFromSource(s: RankingSource): "daily" | "weekly" | "monthly" | null {
  if (s.includes("_daily_")) return "daily";
  if (s.includes("_weekly_")) return "weekly";
  if (s.includes("_monthly_")) return "monthly";
  return null;
}

function hasAnyKakuyomuEntry(entrySources: RankingSource[]): boolean {
  return entrySources.some((src) => isKakuyomuSource(src));
}

function avgPoints(list: RankingEntry[]): number {
  const nums = list.map((e) => e.points).filter((p): p is number => typeof p === "number" && !Number.isNaN(p));
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function uniqueTokenTypeCount(list: RankingEntry[]): number {
  const s = new Set<string>();
  for (const e of list) {
    for (const t of e.titleTokens) s.add(t);
    for (const t of e.synopsisTokens) s.add(t);
    for (const t of e.tags) s.add(t);
  }
  return s.size;
}

export type DataChartsProps = {
  entries: RankingEntry[];
  entrySources: RankingSource[];
  selectedSource: RankingSource | null;
  selectedGenre: string | null;
  /**
   * ソース・ジャンル UI フィルタをかける前の全ランキング行（タグ TOP10 の全体俯瞰用）。
   * page では `allDatasets.flatMap((d) => d.entries)` を渡す。
   */
  globalTagOverviewEntries: RankingEntry[];
};

/** `entries` / `entrySources` は page のソース・ジャンルフィルタ済み（FilterBar と同一） */
export function DataChartsSection({
  entries,
  entrySources,
  selectedSource,
  selectedGenre,
  globalTagOverviewEntries,
}: DataChartsProps) {
  return (
    <section
      id="data-overview"
      className="mx-auto max-w-6xl scroll-mt-28 px-4 py-12 sm:px-6 sm:py-16 sm:scroll-mt-32"
    >
      <motion.h2
        className="mb-8 text-2xl font-bold text-slate-100"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        データの全体像
      </motion.h2>
      <DataCharts
        entries={entries}
        entrySources={entrySources}
        selectedSource={selectedSource}
        selectedGenre={selectedGenre}
        globalTagOverviewEntries={globalTagOverviewEntries}
      />
    </section>
  );
}

export function DataCharts({
  entries,
  entrySources,
  selectedSource,
  selectedGenre,
  globalTagOverviewEntries,
}: DataChartsProps) {
  const { entries: chartEntries, sources: chartSources } = useMemo(
    () => dedupeRankingEntrySourcePairs(entries, entrySources),
    [entries, entrySources],
  );

  const tokenDetailBridge = useOptionalTitleTokenDetailBridge();
  const onTrendTokenClick =
    tokenDetailBridge !== null
      ? (token: string) => tokenDetailBridge.requestOpenTitleTokenDetail(token)
      : undefined;

  const searched = useUserSearchedTitle();
  const highlightLength = useMemo(() => {
    const t = searched?.userTitle;
    if (!t || t.trim() === "") return undefined;
    return titleCharCount(t);
  }, [searched?.userTitle]);

  const genreData = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of chartEntries) {
      m.set(e.genre, (m.get(e.genre) ?? 0) + 1);
    }
    const names = sortGenres(Array.from(m.keys()));
    return names.map((name) => ({ name, value: m.get(name)! }));
  }, [chartEntries]);

  const sourceCompareRows = useMemo(() => {
    const narou: RankingEntry[] = [];
    const kaku: RankingEntry[] = [];
    for (let i = 0; i < chartEntries.length; i++) {
      const src = chartSources[i];
      if (!src) continue;
      if (isNarouSource(src)) narou.push(chartEntries[i]);
      else if (isKakuyomuSource(src)) kaku.push(chartEntries[i]);
    }
    return [
      {
        metric: "件数",
        narou: narou.length,
        kakuyomu: kaku.length,
      },
      {
        metric: "平均pt",
        narou: Math.round(avgPoints(narou)),
        kakuyomu: Math.round(avgPoints(kaku)),
      },
      {
        metric: "トークン種類",
        narou: uniqueTokenTypeCount(narou),
        kakuyomu: uniqueTokenTypeCount(kaku),
      },
    ];
  }, [chartEntries, chartSources]);

  const periodAvgRows = useMemo(() => {
    const daily: RankingEntry[] = [];
    const weekly: RankingEntry[] = [];
    const monthly: RankingEntry[] = [];
    for (let i = 0; i < chartEntries.length; i++) {
      const src = chartSources[i];
      if (!src) continue;
      const p = periodFromSource(src);
      if (p === "daily") daily.push(chartEntries[i]);
      else if (p === "weekly") weekly.push(chartEntries[i]);
      else if (p === "monthly") monthly.push(chartEntries[i]);
    }
    return [
      { period: "日間", avg: Math.round(avgPoints(daily)) },
      { period: "週間", avg: Math.round(avgPoints(weekly)) },
      { period: "月間", avg: Math.round(avgPoints(monthly)) },
    ];
  }, [chartEntries, chartSources]);

  const showKakuyomuCompare = hasAnyKakuyomuEntry(chartSources);

  const tagTop10 = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of dedupeRankingEntriesByWork(globalTagOverviewEntries)) {
      const seen = new Set<string>();
      for (const t of e.tags) {
        const k = t.trim();
        if (!k || seen.has(k)) continue;
        seen.add(k);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }, [globalTagOverviewEntries]);

  const total = chartEntries.length;

  if (entries.length === 0) {
    return (
      <div className="space-y-6">
        <motion.div {...cardMotion}>
          <TrendSection
            entries={chartEntries}
            selectedSource={selectedSource}
            selectedGenre={selectedGenre}
            onTokenClick={onTrendTokenClick}
          />
        </motion.div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <motion.div
            {...cardMotion}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6 md:col-span-3"
          >
            <h3 className="mb-1 text-sm font-medium text-slate-200">タイトル文字数 × 順位</h3>
            <p className="mb-4 text-xs text-slate-500">上位作はどの文字数帯に集中しているか</p>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
              <div className="min-w-0 w-full lg:w-[70%]">
                <TitleLengthScatter entries={[]} highlightLength={highlightLength} />
              </div>
              <div className="w-full min-w-0 shrink-0 lg:w-[30%]">
                <TitleLengthStats entries={[]} />
              </div>
            </div>
          </motion.div>
        </div>
        <CooccurrenceNetworkSection
          entries={chartEntries}
          selectedSource={selectedSource}
          selectedGenre={selectedGenre}
        />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <motion.div
          {...cardMotion}
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
        >
        <h3 className="mb-4 text-sm text-slate-400">ジャンル分布</h3>
        <div className="relative mx-auto h-[260px] w-full max-w-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={genreData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={1}
                isAnimationActive
                label={false}
                labelLine={false}
                activeShape={genrePieActiveShape}
              >
                {genreData.map((row) => (
                  <Cell key={row.name} fill={genreSliceColor(row.name)} />
                ))}
              </Pie>
              <Tooltip
                {...chartTooltipProps}
                cursor={false}
                shared={false}
                allowEscapeViewBox={{ x: true, y: true }}
                offset={16}
                wrapperStyle={{
                  outline: "none",
                  pointerEvents: "none",
                }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: 11, maxWidth: "100%" }}
                formatter={(value) => shortenGenreLabel(String(value))}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pb-8">
            <div className="text-center">
              <p className="text-3xl font-bold tabular-nums text-slate-100">{total}</p>
              <p className="text-xs text-slate-500">件</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        {...cardMotion}
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
      >
        {showKakuyomuCompare ? (
          <KakuyomuNarouCompareChart rows={sourceCompareRows} />
        ) : (
          <PeriodAveragePointsChart rows={periodAvgRows} />
        )}
      </motion.div>

      <motion.div
        id="chart-global-tag-top10"
        {...cardMotion}
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
      >
        <h3 className="mb-1 text-sm font-medium text-slate-200">データ全体の頻出タグ TOP10</h3>
        <p className="mb-4 text-xs leading-relaxed text-slate-500">
          フィルタ前の全ランキング対象（投入済みデータセットの全件）から集計しています。
        </p>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={tagTop10}
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              barCategoryGap={4}
            >
              <defs>
                <linearGradient id="tagRoseGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.5)" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis
                type="category"
                dataKey="tag"
                width={100}
                stroke="#94a3b8"
                fontSize={10}
                tickFormatter={(v) => (String(v).length > 10 ? `${String(v).slice(0, 9)}…` : String(v))}
              />
              <Tooltip {...chartTooltipProps} />
              <Bar dataKey="count" fill="url(#tagRoseGrad)" radius={[0, 4, 4, 0]} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
      </div>

      <div className="mt-6 space-y-6">
        <motion.div {...cardMotion}>
          <TrendSection
            entries={chartEntries}
            selectedSource={selectedSource}
            selectedGenre={selectedGenre}
            onTokenClick={onTrendTokenClick}
          />
        </motion.div>
        <motion.div
          {...cardMotion}
          className="overflow-x-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
        >
          <h3 className="mb-1 text-sm font-medium text-slate-200">タイトル文字数 × 順位</h3>
          <p className="mb-4 text-xs text-slate-500">上位作はどの文字数帯に集中しているか</p>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-6">
            <div className="min-w-0 w-full lg:w-[70%]">
              <TitleLengthScatter entries={chartEntries} highlightLength={highlightLength} />
            </div>
            <div className="w-full min-w-0 shrink-0 lg:w-[30%]">
              <TitleLengthStats entries={chartEntries} />
            </div>
          </div>
        </motion.div>
        <CooccurrenceNetworkSection
          entries={chartEntries}
          selectedSource={selectedSource}
          selectedGenre={selectedGenre}
        />
      </div>
    </>
  );
}

/** カクヨムデータ投入時に再表示する（サイト横比較） */
function KakuyomuNarouCompareChart({
  rows,
}: {
  rows: Array<{ metric: string; narou: number; kakuyomu: number }>;
}) {
  return (
    <>
      <h3 className="mb-4 text-sm text-slate-400">ソース別比較（なろう / カクヨム）</h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={rows}
            margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
            barCategoryGap={12}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.5)" horizontal={false} />
            <XAxis type="number" stroke="#94a3b8" fontSize={11} />
            <YAxis type="category" dataKey="metric" width={72} stroke="#94a3b8" fontSize={11} />
            <Tooltip {...chartTooltipProps} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="narou" name="なろう" fill="#fbbf24" radius={[0, 4, 4, 0]} isAnimationActive />
            <Bar dataKey="kakuyomu" name="カクヨム" fill="#22d3ee" radius={[0, 4, 4, 0]} isAnimationActive />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

/** カクヨム未投入時：期間（日/週/月）別の平均ポイント */
function PeriodAveragePointsChart({ rows }: { rows: Array<{ period: string; avg: number }> }) {
  return (
    <>
      <h3 className="mb-4 text-sm text-slate-400">期間別の平均pt</h3>
      <div className="h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.5)" vertical={false} />
            <XAxis dataKey="period" stroke="#94a3b8" fontSize={11} tickLine={false} />
            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => String(v)} width={44} />
            <Tooltip
              {...chartTooltipProps}
              formatter={(value: number) => [`${value} pt`, "平均"]}
            />
            <Bar
              dataKey="avg"
              name="平均pt"
              fill="#fbbf24"
              radius={[4, 4, 0, 0]}
              maxBarSize={56}
              isAnimationActive
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
