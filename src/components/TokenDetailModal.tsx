"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CopyTextButton } from "@/components/CopyTextButton";
import type { RankingEntry } from "@/lib/types";
import { hslForTokenField } from "@/lib/token-colors";
import type { TokenField } from "@/lib/analyzer";

type Props = {
  isOpen: boolean;
  token: string;
  field: TokenField;
  totalEntries: number;
  containingCount: number;
  minCount: number;
  maxCount: number;
  coOccurrenceTop10: Array<[string, number]>;
  topTitles: RankingEntry[];
  shareText: string;
  onClose: () => void;
  onSelectToken: (nextToken: string) => void;
};

function highlightTokenInText(text: string, needle: string): ReactNode {
  if (!needle || !text) return text;
  const parts = text.split(needle);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => (
        <span key={`p-${i}`}>
          {part}
          {i < parts.length - 1 ? (
            <span className="rounded-sm bg-amber-400/30 px-0.5">{needle}</span>
          ) : null}
        </span>
      ))}
    </>
  );
}

export function TokenDetailModal({
  isOpen,
  token,
  field,
  totalEntries,
  containingCount,
  minCount,
  maxCount,
  coOccurrenceTop10,
  topTitles,
  shareText,
  onClose,
  onSelectToken,
}: Props) {
  const titleColor = hslForTokenField(field, containingCount, minCount, maxCount);

  const { coMin, coMax } = useMemo(() => {
    if (coOccurrenceTop10.length === 0) return { coMin: 0, coMax: 0 };
    const nums = coOccurrenceTop10.map(([, c]) => c);
    return { coMin: Math.min(...nums), coMax: Math.max(...nums) };
  }, [coOccurrenceTop10]);

  const barPct = totalEntries > 0 ? Math.min(100, (containingCount / totalEntries) * 100) : 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="token-detail-modal"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            aria-label="モーダルを閉じる"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="token-detail-title"
            className="relative z-[101] max-h-[85vh] w-[90vw] max-w-2xl overflow-y-auto rounded-2xl border border-amber-400/30 bg-gradient-to-br from-slate-900 to-slate-950 p-8 pt-14 shadow-2xl sm:pt-8"
            variants={{
              hidden: { opacity: 0, scale: 0.9 },
              show: {
                opacity: 1,
                scale: 1,
                transition: { duration: 0.3, ease: "easeOut" },
              },
              exit: {
                opacity: 0,
                scale: 0.9,
                transition: { duration: 0.2, ease: "easeIn" },
              },
            }}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute right-6 top-6 z-10 flex items-center gap-2">
              <CopyTextButton
                text={shareText}
                fallbackRows={6}
                className="rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200 transition-colors hover:border-amber-400/80 hover:bg-amber-500/20"
              >
                この統計をコピー
              </CopyTextButton>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
                aria-label="閉じる"
              >
                <span className="text-2xl leading-none" aria-hidden>
                  ×
                </span>
              </button>
            </div>

            <h2
              id="token-detail-title"
              className="mb-8 break-words pr-2 pt-2 text-6xl font-bold leading-tight tracking-tight sm:pr-40"
              style={{ color: titleColor }}
            >
              {token}
            </h2>

            <div className="space-y-8">
              <section>
                <p className="text-sm text-slate-400">
                  <span className="tabular-nums text-lg font-semibold text-slate-200">{containingCount}</span>
                  件の作品に登場
                  {totalEntries > 0 && (
                    <span className="text-slate-500">
                      {" "}
                      / 全{totalEntries}件
                    </span>
                  )}
                </p>
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  よく一緒に出る語
                </h3>
                {coOccurrenceTop10.length === 0 ? (
                  <p className="text-sm text-slate-600">他に共起するトークンはありません。</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {coOccurrenceTop10.map(([tok, cnt]) => (
                      <li key={tok}>
                        <button
                          type="button"
                          onClick={() => onSelectToken(tok)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-current bg-slate-950/50 px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-90"
                          style={{ color: hslForTokenField(field, cnt, coMin, coMax) }}
                        >
                          <span>{tok}</span>
                          <span className="tabular-nums opacity-80">{cnt}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">出現作品</h3>
                {topTitles.length === 0 ? (
                  <p className="text-sm text-slate-600">該当作品がありません。</p>
                ) : (
                  <ol className="space-y-4">
                    {topTitles.map((e) => (
                      <li
                        key={`${e.rank}-${e.title}`}
                        className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-sm leading-relaxed text-slate-200"
                      >
                        <div className="flex flex-wrap items-baseline gap-2 text-slate-500">
                          <span className="font-mono text-xs tabular-nums text-amber-500/90">#{e.rank}</span>
                          <span className="text-xs">{e.genre}</span>
                        </div>
                        <p className="mt-2 text-base font-medium text-slate-100">
                          {highlightTokenInText(e.title, token)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
