"use client";

import { motion } from "framer-motion";
import CountUp from "react-countup";

type Props = {
  titleCount: number;
  uniqueWordCount: number;
  uniqueTagCount: number;
  /** #token-cloud へ誘導する矢印を出すか（データが1件以上あるとき） */
  showTokenCloudAnchor?: boolean;
};

export function HomeHero({
  titleCount,
  uniqueWordCount,
  uniqueTagCount,
  showTokenCloudAnchor = true,
}: Props) {
  const isEmpty = titleCount === 0;

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
            なろう・カクヨムのランキングを解剖する実験場
          </motion.p>

          <div className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-10 sm:grid-cols-3 sm:gap-6">
            <StatCell
              label="件のタイトル"
              value={titleCount}
              countUpDelay={0}
              showDash={isEmpty}
            />
            <StatCell
              label="個のユニーク語"
              value={uniqueWordCount}
              countUpDelay={0.1}
              showDash={isEmpty}
            />
            <StatCell
              label="個のタグ"
              value={uniqueTagCount}
              countUpDelay={0.2}
              showDash={isEmpty}
            />
          </div>

        </div>

        {showTokenCloudAnchor && (
          <div className="flex justify-center pb-8 pt-2">
            <motion.a
              href="#token-cloud"
              className="inline-flex text-slate-500 transition-colors hover:text-slate-400"
              aria-label="トークン一覧へスクロール"
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
                aria-hidden
              >
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </motion.a>
          </div>
        )}
      </div>
    </section>
  );
}

function StatCell({
  label,
  value,
  countUpDelay,
  showDash,
}: {
  label: string;
  value: number;
  countUpDelay: number;
  showDash: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="text-5xl font-bold tabular-nums text-amber-300">
        {showDash ? (
          <span className="text-slate-500">---</span>
        ) : (
          <CountUp
            key={`${value}-${countUpDelay}`}
            end={value}
            duration={2}
            delay={countUpDelay}
            preserveValue
          />
        )}
      </div>
      <p className="mt-2 text-sm text-slate-400">{label}</p>
    </div>
  );
}
