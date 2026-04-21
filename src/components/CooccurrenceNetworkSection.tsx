"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";

const CooccurrenceNetworkLazy = dynamic(() => import("@/components/CooccurrenceNetwork"), {
  ssr: false,
  loading: () => (
    <div
      className="flex w-full min-h-[400px] max-w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-950/40 px-3 text-sm text-slate-500 sm:min-h-[500px]"
      role="status"
      aria-live="polite"
    >
      読み込み中…
    </div>
  ),
});
import { TokenDetailModal } from "@/components/TokenDetailModal";
import {
  computeCooccurrence,
  filterGraphByThreshold,
  type CooccurrenceTokenField,
} from "@/lib/cooccurrence";
import { coOccurringTokens, getFieldTokens, type TokenField } from "@/lib/analyzer";
import { dedupeRankingEntriesByWork } from "@/lib/rankingDedupe";
import { formatTitleAnatomyTokenShareText } from "@/lib/share-text";
import type { RankingEntry, RankingSource } from "@/lib/types";

const cardMotion = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.45, ease: "easeOut" },
} as const;

const TABS: { id: CooccurrenceTokenField; label: string }[] = [
  { id: "titleTokens", label: "タイトル" },
  { id: "synopsisTokens", label: "あらすじ" },
  { id: "tags", label: "タグ" },
];

const TOP_N_OPTIONS = [30, 50, 100] as const;
type TopNChoice = (typeof TOP_N_OPTIONS)[number];

const THRESHOLD_OPTIONS = [2, 3, 5] as const;
type ThresholdChoice = (typeof THRESHOLD_OPTIONS)[number];

const HEAVY_NOTE_MS = 6000;

type SectionProps = {
  entries: RankingEntry[];
  selectedSource: RankingSource | null;
  selectedGenre: string | null;
};

export function CooccurrenceNetworkSection({
  entries,
  selectedSource,
  selectedGenre,
}: SectionProps) {
  const [tab, setTab] = useState<CooccurrenceTokenField>("titleTokens");
  const [topN, setTopN] = useState<TopNChoice>(50);
  const [minCooccurrence, setMinCooccurrence] = useState<ThresholdChoice>(2);
  const [heavyNoteVisible, setHeavyNoteVisible] = useState(false);
  const [detailToken, setDetailToken] = useState<string | null>(null);
  const heavyNoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHeavyNoteTimer = () => {
    if (heavyNoteTimerRef.current) {
      clearTimeout(heavyNoteTimerRef.current);
      heavyNoteTimerRef.current = null;
    }
  };

  const selectTopN = (n: TopNChoice) => {
    setTopN(n);
    clearHeavyNoteTimer();
    if (n === 100) {
      setHeavyNoteVisible(true);
      heavyNoteTimerRef.current = setTimeout(() => {
        setHeavyNoteVisible(false);
        heavyNoteTimerRef.current = null;
      }, HEAVY_NOTE_MS);
    } else {
      setHeavyNoteVisible(false);
    }
  };

  useEffect(() => () => clearHeavyNoteTimer(), []);

  const filteredGraph = useMemo(() => {
    if (entries.length === 0) return { nodes: [], edges: [] };
    const base = computeCooccurrence(entries, tab, topN);
    return filterGraphByThreshold(base, minCooccurrence);
  }, [entries, tab, topN, minCooccurrence]);

  const edgeCount = filteredGraph.edges.length;
  const hasEnoughLinks = edgeCount >= 10;

  const field = tab as TokenField;

  const { minCount, maxCount } = useMemo(() => {
    if (filteredGraph.nodes.length === 0) return { minCount: 0, maxCount: 0 };
    const counts = filteredGraph.nodes.map((n) => n.count);
    return { minCount: Math.min(...counts), maxCount: Math.max(...counts) };
  }, [filteredGraph]);

  const coOccurrenceMap = useMemo(() => {
    if (!detailToken) return new Map<string, number>();
    return coOccurringTokens(entries, field, detailToken);
  }, [entries, field, detailToken]);

  const coOccurrenceTop10 = useMemo(() => {
    return Array.from(coOccurrenceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [coOccurrenceMap]);

  const containingCount = useMemo(() => {
    if (!detailToken) return 0;
    const matched = entries.filter((e) => getFieldTokens(e, field).includes(detailToken));
    return dedupeRankingEntriesByWork(matched).length;
  }, [entries, field, detailToken]);

  const appearingWorks = useMemo(() => {
    if (!detailToken) return [];
    const matched = entries.filter((e) => getFieldTokens(e, field).includes(detailToken));
    return dedupeRankingEntriesByWork(matched);
  }, [entries, field, detailToken]);

  const tokenShareText = useMemo(() => {
    if (!detailToken) return "";
    return formatTitleAnatomyTokenShareText({
      token: detailToken,
      field,
      selectedSource,
      selectedGenre,
      coOccurrence: coOccurrenceTop10.map(([t, c]) => ({ token: t, count: c })),
    });
  }, [detailToken, field, selectedSource, selectedGenre, coOccurrenceTop10]);

  const setTabAndClearDetail = (id: CooccurrenceTokenField) => {
    setTab(id);
    setDetailToken(null);
  };

  const handleNetworkNodeClick = useCallback((token: string) => {
    setDetailToken(token);
  }, []);

  return (
    <motion.div
      {...cardMotion}
      className="overflow-x-hidden rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-4 sm:px-6 sm:py-6 md:col-span-3"
    >
      <div className="mb-1 flex min-w-0 max-w-full flex-col gap-3 sm:mb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h3 className="min-w-0 shrink text-sm font-medium text-slate-200">語の共起ネットワーク</h3>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-2 gap-y-2 sm:shrink-0 sm:gap-x-4">
          <div
            className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:gap-2"
            role="radiogroup"
            aria-label="表示ノード数"
          >
            <span className="shrink-0 text-[11px] text-slate-500 sm:text-xs">表示ノード数:</span>
            {TOP_N_OPTIONS.map((n) => {
              const active = topN === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => selectTopN(n)}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/20"
                      : "bg-slate-800/90 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
          <div
            className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5 sm:gap-2"
            role="radiogroup"
            aria-label="最小共起回数"
          >
            <span className="shrink-0 text-[11px] text-slate-500 sm:text-xs">最小共起回数:</span>
            {THRESHOLD_OPTIONS.map((n) => {
              const active = minCooccurrence === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMinCooccurrence(n)}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3 sm:text-xs ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/20"
                      : "bg-slate-800/90 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-500">よく一緒に出てくる語の繋がりを可視化</p>

      <div
        className="mb-4 flex min-w-0 max-w-full flex-wrap gap-1.5 sm:gap-2"
        role="tablist"
        aria-label="共起グラフの対象フィールド"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTabAndClearDetail(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                active
                  ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-slate-800/90 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {heavyNoteVisible ? (
        <p className="mb-2 text-xs text-slate-500">100 を選ぶと描画が遅くなることがあります</p>
      ) : null}

      {hasEnoughLinks ? (
        <>
          <CooccurrenceNetworkLazy
            graph={filteredGraph}
            onNodeTokenClick={handleNetworkNodeClick}
            tokenDetailOpen={detailToken !== null}
          />
          <p className="mt-2 text-center text-xs text-slate-500">
            ノード: {filteredGraph.nodes.length} / エッジ: {filteredGraph.edges.length}
          </p>
        </>
      ) : (
        <p className="py-16 text-center text-sm text-slate-500">語の共起データが不足しています</p>
      )}

      <TokenDetailModal
        isOpen={detailToken !== null}
        token={detailToken ?? ""}
        field={field}
        containingCount={containingCount}
        minCount={minCount}
        maxCount={maxCount}
        coOccurrenceTop10={coOccurrenceTop10}
        appearingWorks={appearingWorks}
        shareText={tokenShareText}
        presentation="modal"
        onClose={() => setDetailToken(null)}
        onSelectToken={(next) => setDetailToken(next)}
      />
    </motion.div>
  );
}
