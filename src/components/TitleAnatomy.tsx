"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TokenDetailModal } from "@/components/TokenDetailModal";
import { type RankingEntry, type RankingSource } from "@/lib/types";
import { formatTitleAnatomyTokenShareText } from "@/lib/share-text";
import { coOccurringTokens, type TokenField } from "@/lib/analyzer";
import { hslForTokenField } from "@/lib/token-colors";

type Props = {
  tokensWithCounts: Array<{ token: string; count: number; field: TokenField }>;
  totalEntries: number;
  entries: RankingEntry[];
  /** data/rankings に JSON が1件も無いとき true（フィルタで 0 件になった場合は false） */
  corpusIsEmpty: boolean;
  selectedSource: RankingSource | null;
  selectedGenre: string | null;
};

type TabId = TokenField;

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "titleTokens", label: "タイトル" },
  { id: "synopsisTokens", label: "あらすじ" },
  { id: "tags", label: "タグ" },
];

/** sqrt スケール: 最小 12px、最大 60px */
function fontSizePxSqrt(count: number, minC: number, maxC: number): number {
  if (maxC === minC) {
    return 12 + Math.sqrt(0.5) * 48;
  }
  const t = Math.max(0, Math.min(1, (count - minC) / (maxC - minC)));
  return 12 + Math.sqrt(t) * 48;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

type SortMode = "count" | "random";

export function TitleAnatomy({
  tokensWithCounts,
  totalEntries,
  entries,
  corpusIsEmpty,
  selectedSource,
  selectedGenre,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("titleTokens");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("count");

  const setTab = (id: TabId) => {
    setActiveTab(id);
    setSelectedToken(null);
  };

  const filtered = useMemo(() => {
    return tokensWithCounts.filter((row) => row.field === activeTab);
  }, [tokensWithCounts, activeTab]);

  const ordered = useMemo(() => {
    if (sortMode === "count") {
      return [...filtered].sort((a, b) => b.count - a.count);
    }
    return shuffle([...filtered]);
  }, [filtered, sortMode]);

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

  const floatDurations = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of ordered) {
      m.set(`${activeTab}:${row.token}`, 3 + Math.random() * 2);
    }
    return m;
  }, [ordered, activeTab]);

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
      {corpusIsEmpty && entries.length === 0 ? (
        <div
          className="flex min-h-[50vh] w-full flex-col items-center justify-center px-6 py-24 text-center text-slate-500"
          role="status"
        >
          <p className="text-base font-medium sm:text-lg">データがまだありません</p>
          <p className="mt-6 max-w-lg text-sm leading-relaxed sm:text-base">
            /kaihatsu からランキングデータを投入すると、ここに解剖結果が表示されます
          </p>
        </div>
      ) : (
        <div className="flex min-h-[60vh] w-full flex-col gap-6">
          <div className="flex min-w-0 w-full flex-col gap-4">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-slate-800 pb-3">
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="表示フィールド">
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
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                <span className="text-xs text-slate-500">並び順</span>
                <button
                  type="button"
                  onClick={() => setSortMode("count")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === "count"
                      ? "bg-slate-700 text-amber-200 ring-1 ring-amber-500/40"
                      : "bg-slate-800/80 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  出現数順
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("random")}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    sortMode === "random"
                      ? "bg-slate-700 text-amber-200 ring-1 ring-amber-500/40"
                      : "bg-slate-800/80 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  ランダム
                </button>
              </div>
            </div>

            <div className="relative min-h-[120px] rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4 sm:p-6" role="tabpanel">
              {ordered.length === 0 ? (
                <p className="text-sm text-slate-500">このタブに表示するトークンがありません。</p>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    className="flex flex-wrap justify-center gap-x-3 gap-y-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    {ordered.map((row, index) => {
                      const isSelected = selectedToken === row.token;
                      const dimOthersSelected = selectedToken !== null && !isSelected;
                      const dimSiblingsHover =
                        hoveredToken !== null && hoveredToken !== row.token && selectedToken === null;
                      const opacity = dimOthersSelected ? 0.3 : dimSiblingsHover ? 0.4 : 1;

                      const fontSize = fontSizePxSqrt(row.count, minCount, maxCount);
                      const color = hslForTokenField(activeTab, row.count, minCount, maxCount);
                      const floatDur = floatDurations.get(`${activeTab}:${row.token}`) ?? 4;

                      let scale = 1;
                      if (isSelected) scale = 1.3;
                      else if (hoveredToken === row.token) scale = 1.15;

                      const stagger = index * 0.03;

                      return (
                        <motion.span
                          key={`${activeTab}-${sortMode}-${row.token}`}
                          className="inline-block will-change-transform"
                          style={{
                            zIndex: isSelected ? 30 : hoveredToken === row.token ? 20 : 1,
                          }}
                          animate={{
                            y: [0, 3, 0, -3, 0],
                          }}
                          transition={{
                            y: {
                              repeat: Infinity,
                              duration: floatDur,
                              ease: "easeInOut",
                            },
                          }}
                        >
                          <motion.button
                            type="button"
                            initial={{ opacity: 0, scale: 0.5, y: 20 }}
                            animate={{
                              opacity,
                              scale,
                              y: 0,
                            }}
                            transition={{
                              opacity: { duration: 0.4, delay: stagger, ease: "easeOut" },
                              scale: { duration: 0.4, delay: stagger, ease: "easeOut" },
                              y: { duration: 0.4, delay: stagger, ease: "easeOut" },
                            }}
                            onClick={() => setSelectedToken(row.token)}
                            onMouseEnter={() => setHoveredToken(row.token)}
                            onMouseLeave={() => setHoveredToken(null)}
                            className={`relative cursor-pointer rounded-lg px-2 py-1 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
                              isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950" : ""
                            }`}
                            style={{
                              fontSize: `${fontSize}px`,
                              color,
                            }}
                            title={`${row.token}（${row.count}）`}
                          >
                            {row.token}
                          </motion.button>
                        </motion.span>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>

          <p className="text-center text-sm text-slate-600">トークンをクリックすると詳細が開きます。</p>
        </div>
      )}

      <TokenDetailModal
        isOpen={selectedToken !== null}
        token={selectedToken ?? ""}
        field={activeTab}
        totalEntries={totalEntries}
        containingCount={containingCount}
        minCount={minCount}
        maxCount={maxCount}
        coOccurrenceTop10={coOccurrenceTop10}
        topTitles={topTitles}
        shareText={tokenShareText}
        onClose={() => setSelectedToken(null)}
        onSelectToken={setSelectedToken}
      />
    </div>
  );
}
