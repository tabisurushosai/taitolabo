"use client";

import { motion } from "framer-motion";
import { Scale, Target, TrendingUp } from "lucide-react";

const cards = [
  {
    icon: Target,
    title: "ランキング適合度",
    body: "あなたのタイトルが、なろう・カクヨム両方の上位作品とどれくらい同じ匂いを持っているか、統計的に診断します",
  },
  {
    icon: Scale,
    title: "プラットフォーム判定",
    body: "なろう日間総合の傾向と、カクヨム週間総合の傾向、どちらのランキングと相関が強いか判定。投稿先の参考に",
  },
  {
    icon: TrendingUp,
    title: "人気ポテンシャル",
    body: "類似のタイトルがランキングでどの位置にいるかから、あなたのタイトルの潜在的な読まれやすさを推定",
  },
] as const;

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.12 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export function DiagnoseIntro() {
  return (
    <>
      <section className="mx-auto mb-10 w-full max-w-6xl sm:mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-100">タイトル診断</h1>
        <p className="mt-4 max-w-2xl text-slate-400">
          あなたのタイトル案を、これまでのランキングデータに照らして解剖します
        </p>

        <motion.div
          className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-3 md:gap-6"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
          variants={container}
        >
          {cards.map(({ icon: Icon, title, body }) => (
            <motion.div
              key={title}
              variants={item}
              className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 transition-colors hover:border-amber-400/50"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start md:flex-col">
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-800/80 text-amber-400"
                  aria-hidden
                >
                  <Icon className="h-6 w-6" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-100">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <div className="mb-10 flex justify-center sm:mb-12">
        <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1 text-sm text-amber-300">
          現在、正式版を開発中です。下記はプレビュー版です
        </span>
      </div>
    </>
  );
}
