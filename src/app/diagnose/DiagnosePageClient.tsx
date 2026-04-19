"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { CopyTextButton } from "@/components/CopyTextButton";
import { DiagnoseLoadingSkeleton } from "@/components/DiagnoseLoadingSkeleton";
import { DiagnoseResultPanel } from "@/components/DiagnoseResultPanel";
import { Spinner } from "@/components/Spinner";
import { formatDiagnoseShareText } from "@/lib/share-text";
import {
  RANKING_SOURCE_LABELS,
  type DiagnoseResponse,
  type DiagnoseVerdict,
  type RankingSource,
} from "@/lib/types";

type CompareValue = "all" | RankingSource;

const COMPARE_OPTIONS: Array<{ value: CompareValue; label: string }> = [
  { value: "all", label: "全データ" },
  { value: "narou_daily_total", label: RANKING_SOURCE_LABELS.narou_daily_total },
  { value: "kakuyomu_weekly_total", label: RANKING_SOURCE_LABELS.kakuyomu_weekly_total },
];

function verdictDisplay(v: DiagnoseVerdict): { label: string; hint: string } {
  switch (v) {
    case "blue_ocean":
      return {
        label: "ブルーオーシャン",
        hint: "ランキング語彙との重なりが少なめ。独自性が高い領域です。",
      };
    case "balanced":
      return {
        label: "バランス",
        hint: "流行語と差別化のバランスが取れています。",
      };
    case "red_leaning":
      return {
        label: "レッドオーシャン寄り",
        hint: "ランキングでよく見る語が多めです。差別化の余地あり。",
      };
    case "full_red":
      return {
        label: "完全レッドオーシャン",
        hint: "ランキングの語彙と強く重なっています。埋もれやすい傾向です。",
      };
    default: {
      const _exhaustive: never = v;
      return _exhaustive;
    }
  }
}

function isDiagnoseResponse(x: unknown): x is DiagnoseResponse {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.score !== "number") return false;
  if (typeof o.verdict !== "string") return false;
  if (!Array.isArray(o.matchedTokens) || !Array.isArray(o.similar)) return false;
  if (!Array.isArray(o.suggestedTitleTokens) || !Array.isArray(o.suggestedTags)) return false;
  return true;
}

type AiCommentReason = "api_key_not_set" | "error" | null;

type Props = {
  hasRankingData: boolean;
};

export function DiagnosePageClient({ hasRankingData }: Props) {
  const [titleInput, setTitleInput] = useState("");
  const [compare, setCompare] = useState<CompareValue>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [aiCommentLoading, setAiCommentLoading] = useState(false);
  const [aiComment, setAiComment] = useState<string | null>(null);
  const [aiCommentReason, setAiCommentReason] = useState<AiCommentReason>(null);

  const fetchAiComment = useCallback(async (data: DiagnoseResponse) => {
    setAiCommentLoading(true);
    setAiComment(null);
    setAiCommentReason(null);
    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          verdict: data.verdict,
          score: data.score,
          matchedTokens: data.matchedTokens,
          suggestedTitleTokens: data.suggestedTitleTokens,
          similarTitles: data.similar,
        }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        setAiCommentReason("error");
        return;
      }
      const o = json as { comment?: unknown; reason?: unknown };
      if (typeof o.comment === "string" && o.comment.trim().length > 0) {
        setAiComment(o.comment.trim());
        setAiCommentReason(null);
        return;
      }
      if (o.reason === "api_key_not_set") {
        setAiCommentReason("api_key_not_set");
        return;
      }
      setAiCommentReason("error");
    } catch {
      setAiCommentReason("error");
    } finally {
      setAiCommentLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = titleInput.trim();
    if (!title) {
      setError("タイトルを入力してください。");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setAiComment(null);
    setAiCommentReason(null);
    setAiCommentLoading(false);
    setSubmitted(true);

    try {
      const res = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          source: compare === "all" ? null : compare,
        }),
      });

      const json: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const errObj = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
        if (res.status === 503 && errObj?.code === "no_ranking_data") {
          setError("ランキングデータがありません。データを追加してから再度お試しください。");
          return;
        }
        const msg =
          errObj && typeof errObj.error === "string"
            ? errObj.error
            : `診断に失敗しました（${res.status}）。`;
        setError(msg);
        return;
      }

      if (!isDiagnoseResponse(json)) {
        setError("レスポンスの形式が不正です。");
        return;
      }

      setResult(json);
      void fetchAiComment(json);
    } catch {
      setError("通信に失敗しました。ネットワークを確認してください。");
    } finally {
      setLoading(false);
    }
  };

  const badge = result !== null ? verdictDisplay(result.verdict) : null;

  const shareCopyText = useMemo(() => {
    if (!result) return "";
    const verdictLabel = verdictDisplay(result.verdict).label;
    return formatDiagnoseShareText(result, verdictLabel);
  }, [result]);

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-8">
      <div className="mb-6 sm:mb-8">
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-amber-400/90 transition-colors hover:text-amber-300"
        >
          ← タイトラボに戻る
        </Link>
      </div>

      <header className="mb-8 max-w-3xl sm:mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-amber-400 sm:text-3xl md:text-4xl">タイトル診断</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          あなたのタイトル案を、ランキング上位と照らして解剖します
        </p>
      </header>

      {!hasRankingData && (
        <div className="mb-6 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-4 text-sm leading-relaxed text-amber-100/95 sm:px-5">
          <p className="font-medium text-amber-200">ランキングデータがまだありません</p>
          <p className="mt-2 text-amber-100/80">
            まず{" "}
            <Link href="/admin/ingest" className="font-semibold underline decoration-amber-500/60 underline-offset-2 hover:text-amber-50">
              データ取り込み画面
            </Link>
            で JSON を検証し、<code className="rounded bg-slate-900/80 px-1 text-xs">data/rankings/</code>{" "}
            に保存してからデプロイしてください。
          </p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
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
            disabled={loading}
            className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-slate-100 placeholder:text-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60"
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
            disabled={loading}
            onChange={(e) => setCompare(e.target.value as CompareValue)}
            className="w-full min-w-0 rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base text-slate-100 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-60"
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
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 px-5 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <>
                <Spinner className="h-5 w-5 text-slate-900" />
                診断中…
              </>
            ) : (
              "診断する"
            )}
          </button>
        </div>
      </form>

      {submitted && (
        <section className="mx-auto mt-8 max-w-4xl space-y-6 sm:mt-10" aria-live="polite">
          {loading && (
            <div className="py-2" role="status" aria-live="polite">
              <div className="mb-6 flex justify-center sm:justify-start">
                <Spinner className="h-9 w-9" label="診断結果を計算しています…" />
              </div>
              <DiagnoseLoadingSkeleton />
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              <p>{error}</p>
              {error.includes("ランキングデータがありません") && (
                <p className="mt-3 text-red-200/90">
                  <Link href="/admin/ingest" className="font-semibold underline underline-offset-2 hover:text-red-100">
                    データ取り込み画面へ
                  </Link>
                </p>
              )}
            </div>
          )}

          {!loading && result && badge && (
            <>
              <DiagnoseResultPanel result={result} verdictLabel={badge.label} verdictHint={badge.hint} />

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-slate-300">AI寸評</h2>
                {aiCommentLoading && (
                  <div className="mt-4 flex items-start gap-3" aria-busy>
                    <Spinner className="h-6 w-6 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                      <div className="h-3 w-full max-w-md animate-pulse rounded bg-slate-700" />
                      <div className="h-3 w-full max-w-lg animate-pulse rounded bg-slate-800" />
                      <div className="h-3 w-2/3 max-w-sm animate-pulse rounded bg-slate-800/80" />
                    </div>
                  </div>
                )}
                {!aiCommentLoading && aiComment && (
                  <blockquote className="mt-3 border-l-4 border-amber-400 pl-4 text-sm italic leading-relaxed text-slate-300">
                    {aiComment}
                  </blockquote>
                )}
                {!aiCommentLoading && !aiComment && aiCommentReason === "api_key_not_set" && (
                  <p className="mt-3 text-sm text-slate-500">AI寸評は現在オフです（APIキー未設定）。</p>
                )}
                {!aiCommentLoading && !aiComment && aiCommentReason === "error" && (
                  <p className="mt-3 text-sm text-slate-500">AI寸評は無効です（生成に失敗したか、応答が空でした）。</p>
                )}
              </div>

              <div className="flex justify-center sm:justify-start">
                <CopyTextButton
                  text={shareCopyText}
                  className="rounded-full border border-amber-500/50 bg-amber-500/10 px-5 py-2.5 text-sm font-medium text-amber-200 transition-colors hover:border-amber-400/80 hover:bg-amber-500/20"
                >
                  この結果をコピー
                </CopyTextButton>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
