"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankingEntry } from "@/lib/types";
import { isInsufficientTitleLengthData, resolveTitleLength } from "@/lib/titleLength";
import { genreSliceColor } from "@/lib/genreChartColors";
import { shortenGenreLabel, sortGenres } from "@/lib/genreOrder";

function truncateTitle(s: string, max = 30): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function narouWorkUrl(ncode: string | undefined): string | null {
  if (ncode === undefined) return null;
  const n = ncode.trim().toLowerCase();
  if (n === "") return null;
  return `https://ncode.syosetu.com/${n}/`;
}

type Point = {
  titleLengthPlot: number;
  /** Y 軸用（1〜50 にクリップ） */
  rank: number;
  rankActual: number;
  title: string;
  genre: string;
  titleLength: number;
  ncode?: string;
  /** なろう pt 等。未設定のときは undefined */
  points?: number;
};

type GenreSeries = {
  name: string;
  color: string;
  data: Point[];
};

export type TitleLengthScatterProps = {
  entries: RankingEntry[];
  /** 指定時、この文字数位置に強調の垂直線 */
  highlightLength?: number;
};

function ScatterTooltipBody({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: Point }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const titleLine = truncateTitle(p.title, 72);
  const workHref = narouWorkUrl(p.ncode);
  const ptsLine =
    typeof p.points === "number" && Number.isFinite(p.points)
      ? `${Math.round(p.points)} pt`
      : "—";

  return (
    <div className="max-w-[min(100vw-2rem,22rem)] cursor-default space-y-1.5 px-0.5 py-0.5 text-[12px] leading-snug text-slate-200">
      <div className="font-medium text-slate-50">
        {workHref ? (
          <a
            href={workHref}
            target="_blank"
            rel="noopener noreferrer"
            className="cursor-pointer underline decoration-slate-500 underline-offset-2 hover:text-amber-200 hover:decoration-amber-400/70"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {titleLine}
          </a>
        ) : (
          <span className="whitespace-pre-wrap break-words">{titleLine}</span>
        )}
      </div>
      <p className="text-[11px] text-slate-400">[{p.genre}]</p>
      <p className="text-[11px] text-slate-300">
        <span className="text-slate-500">順位: </span>
        {p.rankActual} / 50
      </p>
      <p className="text-[11px] text-slate-300">
        <span className="text-slate-500">文字数: </span>
        {p.titleLength} 文字
      </p>
      <p className="text-[11px] text-slate-300">
        <span className="text-slate-500">ポイント: </span>
        {ptsLine}
      </p>
    </div>
  );
}

export function TitleLengthScatter({ entries, highlightLength }: TitleLengthScatterProps) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const insufficient = useMemo(() => isInsufficientTitleLengthData(entries), [entries]);

  const { series, avgLength, highlightPlot } = useMemo(() => {
    if (insufficient) {
      return {
        series: [] as GenreSeries[],
        avgLength: null as number | null,
        highlightPlot: null as number | null,
      };
    }

    const valid: Array<{ e: RankingEntry; len: number }> = [];
    for (const e of entries) {
      const len = resolveTitleLength(e);
      if (len !== null) valid.push({ e, len });
    }
    if (valid.length === 0) {
      return { series: [] as GenreSeries[], avgLength: null as number | null, highlightPlot: null as number | null };
    }

    const sumLen = valid.reduce((a, x) => a + x.len, 0);
    const avg = sumLen / valid.length;

    const byGenre = new Map<string, Point[]>();
    for (const { e, len: tl } of valid) {
      const plot = Math.min(80, tl);
      const ra = Math.max(1, e.rank);
      const rankPlot = Math.min(50, ra);
      const pt: Point = {
        titleLengthPlot: plot,
        rank: rankPlot,
        rankActual: e.rank,
        title: e.title,
        genre: e.genre,
        titleLength: tl,
        ncode: e.ncode,
        points: e.points,
      };
      const arr = byGenre.get(e.genre) ?? [];
      arr.push(pt);
      byGenre.set(e.genre, arr);
    }

    const names = sortGenres(Array.from(byGenre.keys()));
    const ser: GenreSeries[] = names.map((name) => ({
      name,
      color: genreSliceColor(name),
      data: byGenre.get(name)!,
    }));

    let hl: number | null = null;
    if (typeof highlightLength === "number" && Number.isFinite(highlightLength) && highlightLength > 0) {
      hl = Math.min(80, highlightLength);
    }

    return { series: ser, avgLength: avg, highlightPlot: hl };
  }, [entries, highlightLength, insufficient]);

  /** プロット件数が 0 のジャンルは散布・凡例に出さない */
  const plottedSeries = useMemo(
    () => series.filter((s) => s.data.length > 0),
    [series]
  );

  const legendCountByDisplayName = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of plottedSeries) {
      m.set(shortenGenreLabel(s.name), s.data.length);
    }
    return m;
  }, [plottedSeries]);

  const chartFrameClass =
    "h-[min(52vh,300px)] w-full sm:h-[360px] lg:h-[400px]";

  if (insufficient) {
    return (
      <div
        className={`flex ${chartFrameClass} items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 px-4 text-center text-sm text-slate-500 sm:px-6`}
      >
        データが不足しています
      </div>
    );
  }

  if (plottedSeries.length === 0) {
    return (
      <div
        className={`flex ${chartFrameClass} items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 px-4 text-center text-sm text-slate-500 sm:px-6`}
      >
        データが不足しています
      </div>
    );
  }

  const chartMargin = narrow
    ? { top: 4, right: 6, left: 0, bottom: 56 }
    : { top: 8, right: 16, left: 8, bottom: 28 };

  return (
    <div className={chartFrameClass}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={chartMargin}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.45)" />
          <XAxis
            type="number"
            dataKey="titleLengthPlot"
            name="タイトル文字数"
            domain={[0, 80]}
            ticks={[0, 20, 40, 60, 80]}
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            label={{ value: "タイトル文字数", position: "bottom", fill: "#94a3b8", fontSize: 11, offset: 0 }}
          />
          <YAxis
            type="number"
            dataKey="rank"
            domain={[1, 50]}
            reversed
            allowDecimals={false}
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            width={narrow ? 28 : 36}
            label={{ value: "順位", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
          />
          {avgLength !== null ? (
            <ReferenceLine
              x={Math.min(80, avgLength)}
              stroke="#fde047"
              strokeDasharray="4 4"
              strokeOpacity={0.75}
            />
          ) : null}
          {highlightPlot !== null && (
            <ReferenceLine
              x={highlightPlot}
              stroke="#facc15"
              strokeWidth={2}
              label={{
                value:
                  typeof highlightLength === "number"
                    ? `あなた: ${highlightLength}文字`
                    : "",
                position: "top",
                fill: "#fde68a",
                fontSize: 11,
              }}
            />
          )}
          {plottedSeries.map((s) => (
            <Scatter
              key={s.name}
              name={shortenGenreLabel(s.name)}
              data={s.data}
              fill={s.color}
              line={false}
              isAnimationActive
              shape={(raw: unknown) => {
                const p = raw as { cx?: number; cy?: number; fill?: string };
                if (p.cx == null || p.cy == null) return <g />;
                return (
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={narrow ? 5 : 6}
                    fill={p.fill}
                    className="cursor-pointer"
                    style={{ cursor: "pointer" }}
                  />
                );
              }}
            />
          ))}
          <Tooltip
            content={<ScatterTooltipBody />}
            cursor={{ strokeDasharray: "3 3" }}
            wrapperStyle={{ outline: "none", cursor: "pointer" }}
            contentStyle={{
              backgroundColor: "rgb(15 23 42 / 0.95)",
              border: "1px solid rgb(51 65 85)",
              borderRadius: "8px",
            }}
          />
          <Legend
            layout="horizontal"
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{
              fontSize: narrow ? 10 : 11,
              lineHeight: 1.35,
              paddingTop: 4,
              width: "100%",
              maxWidth: "100%",
            }}
            formatter={(value) => {
              const label = String(value);
              const n = legendCountByDisplayName.get(label);
              if (n === undefined || n === 0) return label;
              return `${label} (N=${n})`;
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
