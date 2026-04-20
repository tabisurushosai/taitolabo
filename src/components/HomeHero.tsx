"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

type Props = {
  titleCount: number;
  uniqueWordCount: number;
  uniqueTagCount: number;
  /** ホバーで生データ内訳（ブラウザ title） */
  wordBreakdownTooltip?: string;
  tagBreakdownTooltip?: string;
  /** ランキングデータがあり、ヒーロー下にスクロール CTA を出す */
  exploreEnabled?: boolean;
  /** 現在のフィルタでトークンクラウドが表示される（#token-cloud が DOM にある） */
  hasTokenCloud?: boolean;
};

function scrollToAnchor(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function HomeHero({
  titleCount,
  uniqueWordCount,
  uniqueTagCount,
  wordBreakdownTooltip,
  tagBreakdownTooltip,
  exploreEnabled = false,
  hasTokenCloud = false,
}: Props) {
  const isEmpty = titleCount === 0;
  const showExplore = exploreEnabled;

  return (
    <section className="relative min-h-[60vh] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-slate-950" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          background:
            "radial-gradient(ellipse 75% 55% at 50% -5%, rgba(251, 191, 36, 0.22), transparent 58%)",
        }}
      />
      <div className="pointer-events-none absolute -left-[20%] top-0 h-full w-[55%] skew-x-[18deg] bg-gradient-to-br from-amber-400/[0.04] via-amber-500/[0.02] to-transparent" />
      <div className="pointer-events-none absolute -right-[15%] top-0 h-full w-[50%] -skew-x-[14deg] bg-gradient-to-bl from-slate-400/[0.05] via-slate-600/[0.03] to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(15,23,42,0.5)_0%,transparent_40%,transparent_60%,rgba(30,41,59,0.35)_100%)]" />

      <div className="relative z-10 flex min-h-[60vh] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6 pt-10 sm:pt-14">
          <motion.h1
            className="text-center text-6xl font-bold text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.3)] sm:text-7xl md:text-9xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            タイトラボ
          </motion.h1>

          <motion.p
            className="mt-5 max-w-2xl text-center text-lg text-slate-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            なろうランキングを解剖する実験場
          </motion.p>

          <motion.p
            className="mt-4 max-w-xl text-center text-sm leading-relaxed text-slate-500"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            ランキング上位作のタイトル・あらすじ・タグを語単位で分析。流行りの語や被りやすいタイトルが一目で分かります
          </motion.p>

          <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            <StatCell
              caption="件を解剖中"
              value={titleCount}
              showDash={isEmpty}
            />
            <StatCell
              caption="個の頻出語"
              value={uniqueWordCount}
              showDash={isEmpty}
              hint={wordBreakdownTooltip}
            />
            <StatCell
              caption="個の頻出タグ"
              value={uniqueTagCount}
              showDash={isEmpty}
              hint={tagBreakdownTooltip}
            />
          </div>

          {showExplore ? (
            <div className="mt-10 w-full max-w-lg px-1 pb-2 sm:max-w-3xl">
              <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4 sm:gap-y-2">
                {hasTokenCloud ? (
                  <button
                    type="button"
                    onClick={() => scrollToAnchor("token-cloud")}
                    className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-1 rounded-lg border border-transparent px-4 py-3 text-center text-sm text-slate-500 transition-colors hover:border-slate-700/60 hover:bg-slate-900/40 hover:text-amber-400/90 sm:min-h-0 sm:w-auto sm:justify-start sm:px-3 sm:py-2"
                  >
                    <span aria-hidden className="text-slate-600">
                      ↓
                    </span>
                    流行りの語を見る
                  </button>
                ) : null}
                {hasTokenCloud ? (
                  <motion.div
                    className="hidden shrink-0 text-slate-600 sm:inline-flex"
                    aria-hidden
                    animate={{ y: [0, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </motion.div>
                ) : null}
                <button
                  type="button"
                  onClick={() => scrollToAnchor("similarity-check")}
                  className="inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-1 rounded-lg border border-transparent px-4 py-3 text-center text-sm text-slate-500 transition-colors hover:border-slate-700/60 hover:bg-slate-900/40 hover:text-amber-400/90 sm:min-h-0 sm:w-auto sm:justify-start sm:px-3 sm:py-2"
                >
                  <span aria-hidden className="text-slate-600">
                    ↓
                  </span>
                  タイトル類似度をチェック
                </button>
              </div>
              {!hasTokenCloud ? (
                <div className="flex justify-center pb-6 pt-1">
                  <motion.div
                    className="inline-flex text-slate-600"
                    aria-hidden
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14M5 12l7 7 7-7" />
                    </svg>
                  </motion.div>
                </div>
              ) : (
                <div className="pb-6" aria-hidden />
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function StatCell({
  caption,
  value,
  showDash,
  hint,
}: {
  caption: string;
  value: number;
  showDash: boolean;
  hint?: string;
}) {
  const text = useMemo(
    () => (showDash ? "---" : value.toLocaleString("ja-JP")),
    [showDash, value]
  );

  return (
    <div
      className={`flex flex-col items-center text-center${hint ? " cursor-help" : ""}`}
      title={hint}
    >
      <div className="flex min-h-[3.25rem] items-center justify-center sm:min-h-[3.5rem]">
        <motion.span
          key={text}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="inline-block min-w-[10ch] text-center text-5xl font-bold tabular-nums tracking-tight text-amber-300"
          aria-live="polite"
        >
          {showDash ? (
            <span className="text-slate-500">{text}</span>
          ) : (
            text
          )}
        </motion.span>
      </div>
      <p className="mt-2 text-sm text-slate-400">{caption}</p>
    </div>
  );
}
