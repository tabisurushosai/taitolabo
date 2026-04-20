"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { CopyTextButton } from "@/components/CopyTextButton";
import type { RankingEntry } from "@/lib/types";
import { highlightSingleToken } from "@/lib/highlight";
import { pickRandom } from "@/lib/random";
import { hslForTokenField } from "@/lib/token-colors";
import type { TokenField } from "@/lib/analyzer";

export type TokenDetailPresentation = "modal" | "hover";

type Props = {
  isOpen: boolean;
  token: string;
  field: TokenField;
  containingCount: number;
  minCount: number;
  maxCount: number;
  coOccurrenceTop10: Array<[string, number]>;
  /** トークンを含む全作品（モーダル内で開くたびにランダム5件へ間引き） */
  appearingWorks: RankingEntry[];
  shareText: string;
  onClose: () => void;
  onSelectToken: (nextToken: string) => void;
  /** hover: 背景ロックなし・下にふわっと浮かぶ。modal: 従来のオーバーレイ */
  presentation?: TokenDetailPresentation;
  /** ホバー表示時、パネル上に移動しても閉じないためのブリッジ */
  onHoverPanelPointerEnter?: () => void;
  onHoverPanelPointerLeave?: () => void;
};

/** なろう公式の作品 URL（ncode があるときのみ。パスは小文字に統一） */
function narouWorkUrl(ncode: string | undefined): string | null {
  if (ncode === undefined) return null;
  const n = ncode.trim().toLowerCase();
  if (n === "") return null;
  return `https://ncode.syosetu.com/${n}/`;
}

export function TokenDetailModal({
  isOpen,
  token,
  field,
  containingCount,
  minCount,
  maxCount,
  coOccurrenceTop10,
  appearingWorks,
  shareText,
  onClose,
  onSelectToken,
  presentation = "modal",
  onHoverPanelPointerEnter,
  onHoverPanelPointerLeave,
}: Props) {
  const [displayedWorks, setDisplayedWorks] = useState<RankingEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const titleColor = hslForTokenField(field, containingCount, minCount, maxCount);

  const { coMin, coMax } = useMemo(() => {
    if (coOccurrenceTop10.length === 0) return { coMin: 0, coMax: 0 };
    const nums = coOccurrenceTop10.map(([, c]) => c);
    return { coMin: Math.min(...nums), coMax: Math.max(...nums) };
  }, [coOccurrenceTop10]);

  const appearingTotal = appearingWorks.length;

  useLayoutEffect(() => {
    if (!isOpen) {
      setDisplayedWorks([]);
      return;
    }

    if (appearingWorks.length === 0) {
      setDisplayedWorks([]);
      return;
    }

    if (appearingWorks.length < 6) {
      setDisplayedWorks([...appearingWorks]);
      return;
    }

    setDisplayedWorks(pickRandom(appearingWorks, 5));
  }, [isOpen, token, field, appearingWorks]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && presentation === "modal") {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen, presentation]);

  /** ホバー時: トークンからパネルへ移動する途中で閉じないよう、語の mouseLeave では閉じない。外側クリックで閉じる */
  useEffect(() => {
    if (!isOpen || presentation !== "hover") return;
    const onPointerDownCapture = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.closest("[data-token-detail-panel]")) return;
      if (t.closest("[data-token-cloud]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onPointerDownCapture, true);
  }, [isOpen, presentation, onClose]);

  const isHover = presentation === "hover";

  const tree = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key={`token-detail-${presentation}`}
          className={
            isHover
              ? "pointer-events-none fixed inset-0 z-[200] flex items-center justify-center p-4"
              : "fixed inset-0 z-[200] flex items-center justify-center p-4"
          }
          initial={isHover ? false : { opacity: 0 }}
          animate={isHover ? undefined : { opacity: 1 }}
          exit={isHover ? undefined : { opacity: 0 }}
          transition={isHover ? undefined : { duration: 0.2 }}
        >
          {!isHover ? (
            <button
              type="button"
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              aria-label="モーダルを閉じる"
              onClick={onClose}
            />
          ) : null}

          <motion.div
            data-token-detail-panel
            role="dialog"
            aria-modal={isHover ? false : true}
            aria-labelledby="token-detail-title"
            className="relative z-[201] max-h-[85vh] w-[90vw] max-w-2xl overflow-y-auto rounded-2xl border border-amber-400/30 bg-gradient-to-br from-slate-900 to-slate-950 p-8 pt-14 shadow-2xl sm:pt-8"
            style={isHover ? { pointerEvents: "auto" } : undefined}
            variants={
              isHover
                ? {
                    hidden: { opacity: 0, y: 28, scale: 0.96 },
                    show: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
                    },
                    exit: {
                      opacity: 0,
                      y: 18,
                      scale: 0.98,
                      transition: { duration: 0.22, ease: "easeIn" },
                    },
                  }
                : {
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
                  }
            }
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            onPointerEnter={isHover ? onHoverPanelPointerEnter : undefined}
            onPointerLeave={isHover ? onHoverPanelPointerLeave : undefined}
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
                <h3 className="mb-3 flex flex-wrap items-baseline gap-x-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <span>{appearingTotal >= 6 ? "出現作品（ランダム抜粋）" : "出現作品"}</span>
                  {appearingTotal >= 6 ? (
                    <span className="text-[10px] font-normal normal-case tracking-normal text-slate-600">
                      全{appearingTotal}件中5件
                    </span>
                  ) : null}
                </h3>
                {appearingWorks.length === 0 ? (
                  <p className="text-sm text-slate-600">該当作品がありません。</p>
                ) : (
                  <ol className="space-y-4">
                    {displayedWorks.map((e) => {
                      const href = narouWorkUrl(e.ncode);
                      const titleNode = highlightSingleToken(e.title, token);
                      const rowKey = `${e.ncode ?? "no-ncode"}-${e.rank}-${e.title}`;
                      return (
                        <li key={rowKey} className="text-sm leading-relaxed">
                          {href !== null ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-slate-200 outline-none ring-amber-400/30 transition-colors hover:border-amber-500/40 hover:bg-slate-900/60 focus-visible:ring-2"
                              aria-label={`「${e.title}」の『小説家になろう』作品ページを別タブで開く`}
                            >
                              <div className="flex flex-wrap items-baseline gap-2 text-slate-500">
                                <span className="font-mono text-xs tabular-nums text-amber-500/90">#{e.rank}</span>
                                <span className="text-xs">{e.genre}</span>
                              </div>
                              <div className="mt-2 text-base font-medium">
                                <span className="inline-flex max-w-full items-start gap-1.5 text-slate-100 underline decoration-amber-500/40 underline-offset-[3px] transition-colors group-hover:text-amber-200 group-hover:decoration-amber-400/90">
                                  <span className="min-w-0">{titleNode}</span>
                                  <ExternalLink
                                    className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-500 opacity-80 transition-colors group-hover:text-amber-300/90"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </span>
                              </div>
                            </a>
                          ) : (
                            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-slate-200">
                              <div className="flex flex-wrap items-baseline gap-2 text-slate-500">
                                <span className="font-mono text-xs tabular-nums text-amber-500/90">#{e.rank}</span>
                                <span className="text-xs">{e.genre}</span>
                              </div>
                              <div className="mt-2 text-base font-medium text-slate-100">
                                <span className="min-w-0">{titleNode}</span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">作品ページの URL（ncode）がデータにありません</p>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
                {appearingWorks.length > 0 &&
                displayedWorks.some((e) => narouWorkUrl(e.ncode) !== null) ? (
                  <p className="mt-4 text-[11px] leading-relaxed text-slate-600">
                    カード全体をクリックすると『小説家になろう』の作品ページを別タブで開きます
                  </p>
                ) : null}
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(tree, document.body);
}
