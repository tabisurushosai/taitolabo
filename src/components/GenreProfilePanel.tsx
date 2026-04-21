"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { TokenDetailModal } from "@/components/TokenDetailModal";
import {
  coOccurringTokens,
  countTokenWorksDeduped,
  getFieldTokens,
  type TokenField,
} from "@/lib/analyzer";
import { computeGenreProfile, type GenreProfileTopRank } from "@/lib/genreProfile";
import { formatTitleAnatomyTokenShareText } from "@/lib/share-text";
import { dedupeRankingEntriesByWork } from "@/lib/rankingDedupe";
import type { RankingEntry, RankingSource } from "@/lib/types";

const TOP_RANK_OPTIONS: GenreProfileTopRank[] = [10, 20, 30, 50];

const cardReveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-32px" },
  transition: { duration: 0.4, ease: "easeOut" },
} as const;

const contentFade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: "easeInOut" },
} as const;

function formatPoints(n: number): string {
  return `${Math.round(n).toLocaleString("ja-JP")} pt`;
}

function profileSignature(entries: RankingEntry[], filterLabel: string, topRank: number): string {
  const n = Math.min(12, entries.length);
  const head = entries.slice(0, n).map((e) => `${e.rank}:${e.ncode ?? ""}:${e.title.slice(0, 24)}`);
  return `${filterLabel}|${topRank}|${entries.length}|${head.join("\u001f")}`;
}

type ModalSelection = { token: string; field: TokenField } | null;

export type GenreProfilePanelProps = {
  entries: RankingEntry[];
  filterLabel: string;
  selectedSource: RankingSource | null;
  selectedGenre: string | null;
};

export function GenreProfilePanel({
  entries,
  filterLabel,
  selectedSource,
  selectedGenre,
}: GenreProfilePanelProps) {
  const [topRank, setTopRank] = useState<GenreProfileTopRank>(10);
  const [modal, setModal] = useState<ModalSelection>(null);

  const profile = useMemo(() => computeGenreProfile(entries, topRank), [entries, topRank]);
  const profileContentKey = useMemo(
    () => profileSignature(entries, filterLabel, topRank),
    [entries, filterLabel, topRank],
  );

  const workCounts = useMemo(() => {
    if (!modal) return new Map<string, number>();
    return countTokenWorksDeduped(entries, modal.field);
  }, [entries, modal]);

  const { minCount, maxCount } = useMemo(() => {
    const vals = [...workCounts.values()];
    if (vals.length === 0) return { minCount: 0, maxCount: 0 };
    return { minCount: Math.min(...vals), maxCount: Math.max(...vals) };
  }, [workCounts]);

  const coOccurrenceTop10 = useMemo(() => {
    if (!modal) return [];
    return Array.from(coOccurringTokens(entries, modal.field, modal.token).entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [entries, modal]);

  const containingCount = useMemo(() => {
    if (!modal) return 0;
    return workCounts.get(modal.token) ?? 0;
  }, [modal, workCounts]);

  const appearingWorks = useMemo(() => {
    if (!modal) return [];
    const matched = entries.filter((e) => getFieldTokens(e, modal.field).includes(modal.token));
    return dedupeRankingEntriesByWork(matched);
  }, [entries, modal]);

  const shareText = useMemo(() => {
    if (!modal) return "";
    return formatTitleAnatomyTokenShareText({
      token: modal.token,
      field: modal.field,
      selectedSource,
      selectedGenre,
      coOccurrence: coOccurrenceTop10.map(([t, c]) => ({ token: t, count: c })),
    });
  }, [modal, selectedSource, selectedGenre, coOccurrenceTop10]);

  if (entries.length < 10) {
    return (
      <motion.div
        {...cardReveal}
        className="flex min-h-[7rem] w-full max-w-full flex-col items-center justify-center overflow-x-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center text-sm text-slate-500 sm:p-6"
        role="status"
      >
        データが不足しています
      </motion.div>
    );
  }

  return (
    <motion.div
      {...cardReveal}
      className="w-full max-w-full overflow-x-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:p-6"
    >
      <div className="mb-4 flex w-full min-w-0 flex-col gap-3 border-b border-slate-800/90 pb-4 sm:min-h-[2.75rem] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <h2 className="min-w-0 max-w-full break-words text-base font-semibold leading-snug text-slate-100 sm:text-lg">
          {filterLabel} の特徴
        </h2>
        <label className="flex w-full min-w-0 max-w-full flex-col gap-2 sm:w-auto sm:max-w-md sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-x-2 sm:gap-y-1">
          <span className="shrink-0 text-sm text-slate-400">集計範囲</span>
          <div className="flex w-full min-w-0 max-w-full items-center gap-2 sm:w-auto sm:max-w-[min(100%,14rem)]">
            <select
              value={topRank}
              onChange={(e) => setTopRank(Number(e.target.value) as GenreProfileTopRank)}
              className="min-h-[2.75rem] min-w-0 max-w-full flex-1 basis-0 rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1.5 text-sm text-slate-200 shadow-inner focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/40 sm:min-h-0 sm:max-w-[11rem] sm:flex-none sm:basis-auto"
              aria-label="上位件数で切り替え"
            >
              {TOP_RANK_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  上位 {n}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-sm text-slate-500">位</span>
          </div>
        </label>
      </div>

      <AnimatePresence initial={false} mode="wait">
        <motion.div key={profileContentKey} {...contentFade}>
          <p className="mb-4 max-w-full text-xs leading-relaxed text-slate-500">
            頻出語・頻出タグは、上のフィルタに一致した作品のうち
            <strong className="font-medium text-slate-400">順位の上位 {topRank} 位まで</strong>
            を対象に集計しています（集計範囲を変えると更新されます）。
          </p>

          <dl className="flex max-w-full flex-col gap-3 text-sm sm:gap-3">
            <div className="flex min-h-[4.5rem] w-full min-w-0 max-w-full flex-col gap-2 sm:min-h-[4rem] sm:flex-row sm:items-start sm:gap-4">
              <dt className="flex shrink-0 items-center gap-1.5 font-medium text-slate-400 sm:min-h-[2.5rem] sm:w-36 sm:pt-0.5">
                <span aria-hidden>📖</span>
                頻出語
              </dt>
              <dd className="flex min-h-[2.75rem] min-w-0 max-w-full flex-1 flex-wrap content-start gap-1.5 sm:min-h-[2.5rem]">
                {profile.topTokens.map(({ token, count }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setModal({ token, field: "titleTokens" })}
                    className="max-w-full break-words rounded-md border border-slate-700/90 bg-slate-950/50 px-2 py-1 text-left text-slate-200 transition-colors hover:border-amber-500/40 hover:bg-slate-800/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    title={`${token}（${count}）`}
                  >
                    {token}
                  </button>
                ))}
                {profile.topTokens.length === 0 ? (
                  <span className="text-slate-600">—</span>
                ) : null}
              </dd>
            </div>

            <div className="flex min-h-[4.5rem] w-full min-w-0 max-w-full flex-col gap-2 sm:min-h-[4rem] sm:flex-row sm:items-start sm:gap-4">
              <dt className="flex shrink-0 items-center gap-1.5 font-medium text-slate-400 sm:min-h-[2.5rem] sm:w-36 sm:pt-0.5">
                <span aria-hidden>🏷</span>
                頻出タグ
              </dt>
              <dd className="flex min-h-[2.75rem] min-w-0 max-w-full flex-1 flex-wrap content-start gap-1.5 sm:min-h-[2.5rem]">
                {profile.topTags.map(({ tag, count }) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setModal({ token: tag, field: "tags" })}
                    className="max-w-full break-words rounded-md border border-rose-900/50 bg-rose-950/20 px-2 py-1 text-left text-rose-100/95 transition-colors hover:border-rose-500/45 hover:bg-rose-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                    title={`${tag}（${count}）`}
                  >
                    {tag}
                  </button>
                ))}
                {profile.topTags.length === 0 ? (
                  <span className="text-slate-600">—</span>
                ) : null}
              </dd>
            </div>

            <div className="flex min-h-[2.75rem] w-full flex-col gap-1 sm:min-h-[2.5rem] sm:flex-row sm:items-baseline sm:gap-4">
              <dt className="flex shrink-0 items-center gap-1.5 font-medium text-slate-400 sm:w-36">
                <span aria-hidden>✏️</span>
                平均文字数
              </dt>
              <dd className="min-h-[1.5rem] tabular-nums text-slate-200">
                {profile.avgTitleLength.toFixed(1)} 文字
              </dd>
            </div>

            <div className="flex min-h-[2.75rem] w-full flex-col gap-1 sm:min-h-[2.5rem] sm:flex-row sm:items-baseline sm:gap-4">
              <dt className="flex shrink-0 items-center gap-1.5 font-medium text-slate-400 sm:w-36">
                <span aria-hidden>⭐</span>
                平均ポイント
              </dt>
              <dd className="min-h-[1.5rem] max-w-full break-words tabular-nums text-slate-200">
                {formatPoints(profile.avgPoints)}
              </dd>
            </div>

            <div className="flex min-h-[2.75rem] w-full flex-col gap-1 sm:min-h-[2.5rem] sm:flex-row sm:items-baseline sm:gap-4">
              <dt className="flex shrink-0 items-center gap-1.5 font-medium text-slate-400 sm:w-36">
                <span aria-hidden>🏆</span>
                上位{topRank}位平均
              </dt>
              <dd className="min-h-[1.5rem] max-w-full break-words tabular-nums text-slate-200">
                {formatPoints(profile.topRangeAvgPoints)}
              </dd>
            </div>
          </dl>
        </motion.div>
      </AnimatePresence>

      <TokenDetailModal
        isOpen={modal !== null}
        token={modal?.token ?? ""}
        field={modal?.field ?? "titleTokens"}
        containingCount={containingCount}
        minCount={minCount}
        maxCount={maxCount}
        coOccurrenceTop10={coOccurrenceTop10}
        appearingWorks={appearingWorks}
        shareText={shareText}
        presentation="modal"
        onClose={() => setModal(null)}
        onSelectToken={(next) => {
          if (!modal) return;
          setModal({ token: next, field: modal.field });
        }}
      />
    </motion.div>
  );
}
