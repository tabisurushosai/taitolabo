"use client";

import Link from "next/link";
import { useState } from "react";
import { DiagnoseIntro } from "@/components/DiagnoseIntro";
import { DiagnoseSamplePreview } from "@/components/DiagnoseSamplePreview";
import { RANKING_SOURCE_LABELS, type RankingSource } from "@/lib/types";

type CompareValue = "all" | RankingSource;

const COMPARE_OPTIONS: Array<{ value: CompareValue; label: string }> = [
  { value: "all", label: "全データ" },
  { value: "narou_daily_total", label: RANKING_SOURCE_LABELS.narou_daily_total },
  { value: "kakuyomu_weekly_total", label: RANKING_SOURCE_LABELS.kakuyomu_weekly_total },
];

type Props = {
  hasRankingData: boolean;
};

export function DiagnosePageClient({ hasRankingData }: Props) {
  const [titleInput, setTitleInput] = useState("");
  const [compare, setCompare] = useState<CompareValue>("all");

  return (
    <main className="min-h-screen p-4 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-amber-400/90 transition-colors hover:text-amber-300"
        >
          ← タイトラボに戻る
        </Link>
      </div>

      <DiagnoseIntro />

      {!hasRankingData && (
        <div className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-amber-100/95 sm:px-5">
          <p className="font-medium text-amber-200">ランキングデータがまだありません</p>
          <p className="mt-2 text-amber-100/80">
            まず{" "}
            <Link href="/kaihatsu" className="font-semibold underline decoration-amber-500/60 underline-offset-2 hover:text-amber-50">
              データ取り込み画面
            </Link>
            で JSON を検証し、<strong className="text-amber-100/95">本番に保存する</strong>
            でランキングデータを登録してください。
          </p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6"
      >
        <div className="space-y-2">
          <label htmlFor="diagnose-title" className="block text-sm font-medium text-slate-300">
            タイトル案
          </label>
          <input
            id="diagnose-title"
            type="text"
            maxLength={100}
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            placeholder="婚約破棄された公爵令嬢の逆襲"
            className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          <p className="text-right text-xs text-slate-600">{titleInput.length} / 100</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="diagnose-compare" className="block text-sm font-medium text-slate-300">
            比較対象
          </label>
          <select
            id="diagnose-compare"
            value={compare}
            onChange={(e) => setCompare(e.target.value as CompareValue)}
            className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-slate-100 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          >
            {COMPARE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            disabled
            aria-disabled
            title="現在開発中です"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 opacity-60 shadow-lg shadow-amber-500/20 sm:w-auto"
          >
            診断する（準備中）
          </button>
        </div>
      </form>

      <DiagnoseSamplePreview />
    </main>
  );
}
