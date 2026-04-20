"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { TokenDetailModal } from "@/components/TokenDetailModal";
import { type RankingEntry, type RankingSource } from "@/lib/types";
import { formatTitleAnatomyTokenShareText } from "@/lib/share-text";
import { coOccurringTokens, getFieldTokens, type TokenField } from "@/lib/analyzer";
import { hslBaseForTokenCloud, opacityForTokenCloud } from "@/lib/token-colors";
import { useSimilarityCloudBridge } from "@/components/SimilarityCloudBridge";
import { dedupeRankingEntriesByWork } from "@/lib/rankingDedupe";
import { MIN_WORKS_WITH_TOKEN } from "@/lib/tokenFilter";

type Props = {
  tokensWithCounts: Array<{ token: string; count: number; field: TokenField }>;
  /** クラウド表示から省略したトークン数（フィールド別。0 ならメッセージ非表示） */
  displayOmittedByField: Record<TokenField, number>;
  entries: RankingEntry[];
  /** ランキングコーパスが空のとき true（フィルタで 0 件になった場合は false） */
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

type SortMode = "count" | "random";

export function TitleAnatomy({
  tokensWithCounts,
  displayOmittedByField,
  entries,
  corpusIsEmpty,
  selectedSource,
  selectedGenre,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("titleTokens");
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("count");
  const [narrowViewport, setNarrowViewport] = useState(false);
  const reduceMotion = useReducedMotion();
  const hoverLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { cloudMatchTokens } = useSimilarityCloudBridge();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setNarrowViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const cancelHoverLeaveTimer = () => {
    if (hoverLeaveTimerRef.current !== null) {
      clearTimeout(hoverLeaveTimerRef.current);
      hoverLeaveTimerRef.current = null;
    }
  };

  const scheduleHoverLeave = () => {
    cancelHoverLeaveTimer();
    hoverLeaveTimerRef.current = setTimeout(() => {
      hoverLeaveTimerRef.current = null;
      setHoveredToken(null);
    }, 220);
  };

  useEffect(() => () => cancelHoverLeaveTimer(), []);

  const setTab = (id: TabId) => {
    setActiveTab(id);
    setSelectedToken(null);
    setHoveredToken(null);
    cancelHoverLeaveTimer();
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

  const detailToken = selectedToken ?? hoveredToken;

  const coOccurrenceMap = useMemo(() => {
    if (!detailToken) return new Map<string, number>();
    return coOccurringTokens(entries, activeTab, detailToken);
  }, [entries, activeTab, detailToken]);

  const coOccurrenceTop10 = useMemo(() => {
    return Array.from(coOccurrenceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [coOccurrenceMap]);

  const containingCount = useMemo(() => {
    if (!detailToken) return 0;
    const matched = entries.filter((e) => getFieldTokens(e, activeTab).includes(detailToken));
    return dedupeRankingEntriesByWork(matched).length;
  }, [entries, activeTab, detailToken]);

  /** モーダル「出現作品」用：該当トークンを含む作品（同一 ncode/タイトルは1件にまとめる。表示はモーダル側で抽選） */
  const appearingWorks = useMemo(() => {
    if (!detailToken) return [];
    const matched = entries.filter((e) => getFieldTokens(e, activeTab).includes(detailToken));
    return dedupeRankingEntriesByWork(matched);
  }, [entries, activeTab, detailToken]);

  const tokenShareText = useMemo(() => {
    if (!detailToken) return "";
    return formatTitleAnatomyTokenShareText({
      token: detailToken,
      field: activeTab,
      selectedSource,
      selectedGenre,
      coOccurrence: coOccurrenceTop10.map(([t, c]) => ({ token: t, count: c })),
    });
  }, [detailToken, activeTab, selectedSource, selectedGenre, coOccurrenceTop10]);

  return (
    <div className="space-y-6">
      {corpusIsEmpty && entries.length === 0 ? (
        <div
          className="flex min-h-[50vh] w-full flex-col items-center justify-center px-6 py-24 text-center text-slate-500"
          role="status"
        >
          <p className="text-base font-medium sm:text-lg">データがまだありません</p>
        </div>
      ) : (
        <div className="flex min-h-[60vh] w-full max-w-full flex-col gap-6 overflow-x-hidden">
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
                  作品数順
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

            <div
              data-token-cloud
              className="relative min-h-[120px] max-w-full overflow-x-hidden overflow-y-visible rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3 sm:p-6 [contain:layout_style]"
              role="tabpanel"
            >
              {ordered.length === 0 ? (
                <p className="text-sm text-slate-500">このタブに表示するトークンがありません。</p>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    className="flex max-w-full flex-wrap justify-center gap-x-2 gap-y-3 sm:gap-x-3 sm:gap-y-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    {ordered.map((row, index) => {
                      const isSelected = selectedToken === row.token;
                      const similarityHighlight =
                        cloudMatchTokens !== null && cloudMatchTokens.has(row.token);
                      const dimOthersSelected = selectedToken !== null && !isSelected;
                      const dimSiblingsHover =
                        hoveredToken !== null && hoveredToken !== row.token && selectedToken === null;
                      const interactionDim = dimOthersSelected ? 0.3 : dimSiblingsHover ? 0.4 : 1;

                      const rawSize = fontSizePxSqrt(row.count, minCount, maxCount);
                      const fontSize = narrowViewport ? Math.min(rawSize, 44) : Math.min(rawSize, 56);
                      const color = hslBaseForTokenCloud(activeTab);
                      const freqOpacity = opacityForTokenCloud(row.count, maxCount);
                      const opacity = freqOpacity * interactionDim;

                      return (
                        <motion.span
                          key={`${activeTab}-${sortMode}-${row.token}`}
                          className="inline-block"
                          style={{
                            zIndex: isSelected ? 30 : hoveredToken === row.token ? 20 : 1,
                          }}
                          animate={reduceMotion ? { y: 0 } : { y: [0, -5, 0] }}
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : {
                                  y: {
                                    repeat: Infinity,
                                    duration: 3.6 + (index % 8) * 0.28,
                                    ease: "easeInOut",
                                    delay: (index * 0.11) % 2.6,
                                  },
                                }
                          }
                        >
                          <button
                            type="button"
                            onClick={() => {
                              cancelHoverLeaveTimer();
                              setSelectedToken(row.token);
                            }}
                            onMouseEnter={() => {
                              cancelHoverLeaveTimer();
                              setHoveredToken(row.token);
                            }}
                            className={`relative max-w-[min(100%,92vw)] cursor-pointer touch-manipulation rounded-lg px-2 py-1.5 text-center font-semibold transition-[color,transform,opacity] duration-150 ease-out hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 sm:px-2 sm:py-1 ${
                              isSelected
                                ? "scale-[1.15] ring-2 ring-white ring-offset-2 ring-offset-slate-950"
                                : similarityHighlight
                                  ? "ring-2 ring-amber-400/90 ring-offset-2 ring-offset-slate-950 hover:scale-105"
                                  : "hover:scale-105"
                            }`}
                            style={{
                              fontSize: `${fontSize}px`,
                              color,
                              opacity,
                            }}
                            title={`${row.token}（${row.count}）`}
                          >
                            {row.token}
                          </button>
                        </motion.span>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {displayOmittedByField[activeTab] > 0 ? (
              <p className="text-center text-[11px] leading-relaxed text-slate-600">
                他 {displayOmittedByField[activeTab]}{" "}
                語は表示を省略しています（{MIN_WORKS_WITH_TOKEN}
                件以上の作品に出現）
              </p>
            ) : null}
          </div>

          <p className="text-center text-sm text-slate-600">
            カーソルを合わせると詳細が表示されます。クリックで固定（背景が暗くなります）。
          </p>
        </div>
      )}

      <TokenDetailModal
        isOpen={detailToken !== null}
        token={detailToken ?? ""}
        field={activeTab}
        containingCount={containingCount}
        minCount={minCount}
        maxCount={maxCount}
        coOccurrenceTop10={coOccurrenceTop10}
        appearingWorks={appearingWorks}
        shareText={tokenShareText}
        presentation={selectedToken !== null ? "modal" : "hover"}
        onHoverPanelPointerEnter={cancelHoverLeaveTimer}
        onHoverPanelPointerLeave={scheduleHoverLeave}
        onClose={() => {
          cancelHoverLeaveTimer();
          setSelectedToken(null);
          setHoveredToken(null);
        }}
        onSelectToken={(next) => {
          cancelHoverLeaveTimer();
          setSelectedToken(next);
          setHoveredToken(next);
        }}
      />
    </div>
  );
}
