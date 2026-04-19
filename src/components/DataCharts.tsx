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
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RankingEntry, RankingSource } from "@/lib/types";

const GENRE_COLORS = ["#fbbf24", "#fb7185", "#22d3ee", "#a78bfa", "#34d399", "#f472b6", "#2dd4bf", "#c4b5fd"];

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
};

export function DataChartsSection({ entries, entrySources }: DataChartsProps) {
  if (entries.length === 0) {
    return null;
  }
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <motion.h2
        className="mb-8 text-2xl font-bold text-slate-100"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        データの全体像
      </motion.h2>
      <DataCharts entries={entries} entrySources={entrySources} />
    </section>
  );
}

export function DataCharts({ entries, entrySources }: DataChartsProps) {
  const genreData = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      m.set(e.genre, (m.get(e.genre) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [entries]);

  const sourceCompareRows = useMemo(() => {
    const narou: RankingEntry[] = [];
    const kaku: RankingEntry[] = [];
    for (let i = 0; i < entries.length; i++) {
      const src = entrySources[i];
      if (!src) continue;
      if (isNarouSource(src)) narou.push(entries[i]);
      else if (isKakuyomuSource(src)) kaku.push(entries[i]);
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
  }, [entries, entrySources]);

  const tagTop10 = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of entries) {
      for (const t of e.tags) {
        const k = t.trim();
        if (!k) continue;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
  }, [entries]);

  const total = entries.length;

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      <motion.div
        {...cardMotion}
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
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
              >
                {genreData.map((_, i) => (
                  <Cell key={i} fill={GENRE_COLORS[i % GENRE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15 23 42 / 0.95)",
                  border: "1px solid rgb(51 65 85)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
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
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <h3 className="mb-4 text-sm text-slate-400">ソース別比較（なろう / カクヨム）</h3>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={sourceCompareRows}
              margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
              barCategoryGap={12}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.5)" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" fontSize={11} />
              <YAxis type="category" dataKey="metric" width={72} stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15 23 42 / 0.95)",
                  border: "1px solid rgb(51 65 85)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="narou" name="なろう" fill="#fbbf24" radius={[0, 4, 4, 0]} isAnimationActive />
              <Bar dataKey="kakuyomu" name="カクヨム" fill="#22d3ee" radius={[0, 4, 4, 0]} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <motion.div
        {...cardMotion}
        className="rounded-xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <h3 className="mb-4 text-sm text-slate-400">頻出タグ TOP10</h3>
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
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgb(15 23 42 / 0.95)",
                  border: "1px solid rgb(51 65 85)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="count" fill="url(#tagRoseGrad)" radius={[0, 4, 4, 0]} isAnimationActive />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}
