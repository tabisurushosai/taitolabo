"use client";

import { useMemo, type ReactNode } from "react";
import { useUserSearchedTitle } from "@/components/UserSearchedTitleContext";
import { isInsufficientTitleLengthData, resolveTitleLength, titleCharCount } from "@/lib/titleLength";
import type { RankingEntry } from "@/lib/types";

export type TitleLengthStatsProps = {
  entries: RankingEntry[];
};

/**
 * 5 文字刻みバケット [0,5), [5,10), …, [75,80]（80 超は 75〜80 にまとめる）
 */
function bucketIndex(length: number): number {
  return Math.min(15, Math.floor(length / 5));
}

/** 5 文字幅の帯ラベル（例: 25〜30） */
function bucketLabel(index: number): string {
  const lo = index * 5;
  const hi = lo + 5;
  return `${lo}〜${hi}`;
}

/** 連続する2 帯 [minIdx,maxIdx] を 1 つにまとめた表記（例: 25〜35） */
function mergedBucketLabel(minIdx: number, maxIdx: number): string {
  const lo = minIdx * 5;
  const hi = maxIdx * 5 + 5;
  return `${lo}〜${hi}`;
}

/**
 * ヒストグラムから「よく見る文字数帯」表示を組み立てる。
 * 上位2 帯が隣接すれば結合、否なら「帯A / 帯B」。補足文は上位2 帯の合計%で出し分け。
 */
function computeCommonLengthBand(n: number, counts: Map<number, number>): {
  mainLabel: string;
  pct: number;
  supplement: string;
} | null {
  const sorted = Array.from(counts.entries())
    .filter(([, c]) => c > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0] - b[0];
    });
  if (sorted.length === 0) return null;

  const top = sorted[0]!;
  const second = sorted[1];

  let mainLabel: string;
  let combinedCount: number;
  let repMid: number;

  if (second === undefined) {
    const [idx, c] = top;
    mainLabel = `${bucketLabel(idx)}文字`;
    combinedCount = c;
    repMid = idx * 5 + 2.5;
  } else {
    const [i1, c1] = top;
    const [i2, c2] = second;
    const loI = Math.min(i1, i2);
    const hiI = Math.max(i1, i2);
    combinedCount = c1 + c2;

    if (hiI - loI === 1) {
      mainLabel = `${mergedBucketLabel(loI, hiI)}文字`;
      repMid = (loI * 5 + hiI * 5 + 5) / 2;
    } else {
      const a = Math.min(i1, i2);
      const b = Math.max(i1, i2);
      mainLabel = `${bucketLabel(a)}文字 / ${bucketLabel(b)}文字`;
      repMid = c1 >= c2 ? i1 * 5 + 2.5 : i2 * 5 + 2.5;
    }
  }

  const sumPct = Math.round((combinedCount / n) * 100);
  const repRounded = Math.round(repMid);

  let supplement: string;
  if (sumPct >= 30) {
    supplement = `${repRounded}文字前後に集中`;
  } else if (sumPct >= 20) {
    supplement = `${repRounded}文字前後に緩やかに集中`;
  } else {
    supplement = "文字数は広く分布しています";
  }

  return { mainLabel, pct: sumPct, supplement };
}

function narouWorkUrl(ncode: string | undefined): string | null {
  if (ncode === undefined) return null;
  const n = ncode.trim().toLowerCase();
  if (n === "") return null;
  return `https://ncode.syosetu.com/${n}/`;
}

function truncateTitleDisplay(s: string, max = 30): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export function TitleLengthStats({ entries }: TitleLengthStatsProps) {
  const searched = useUserSearchedTitle();
  const insufficient = useMemo(() => isInsufficientTitleLengthData(entries), [entries]);

  const userLength =
    searched?.userTitle && searched.userTitle.trim() !== ""
      ? titleCharCount(searched.userTitle)
      : null;

  const stats = useMemo(() => {
    if (insufficient) {
      return {
        overallMean: null as number | null,
        top10Mean: null as number | null,
        modeRange: null as {
          mainLabel: string;
          pct: number;
          supplement: string;
          footnoteBandWord: "この帯" | "これらの帯";
        } | null,
        minLen: null as number | null,
        maxLen: null as number | null,
        minWork: null as { title: string; ncode?: string } | null,
        maxWork: null as { title: string; ncode?: string } | null,
      };
    }
    const lens: number[] = [];
    for (const e of entries) {
      const len = resolveTitleLength(e);
      if (len !== null) lens.push(len);
    }
    if (lens.length === 0) {
      return {
        overallMean: null as number | null,
        top10Mean: null as number | null,
        modeRange: null as {
          mainLabel: string;
          pct: number;
          supplement: string;
          footnoteBandWord: "この帯" | "これらの帯";
        } | null,
        minLen: null as number | null,
        maxLen: null as number | null,
        minWork: null as { title: string; ncode?: string } | null,
        maxWork: null as { title: string; ncode?: string } | null,
      };
    }

    const n = lens.length;
    const overallMean = lens.reduce((a, b) => a + b, 0) / n;

    const top10Lens: number[] = [];
    for (const e of entries) {
      const len = resolveTitleLength(e);
      if (len !== null && e.rank >= 1 && e.rank <= 10) {
        top10Lens.push(len);
      }
    }
    const top10Mean =
      top10Lens.length > 0 ? top10Lens.reduce((a, b) => a + b, 0) / top10Lens.length : null;

    const counts = new Map<number, number>();
    for (const tl of lens) {
      const bi = bucketIndex(tl);
      counts.set(bi, (counts.get(bi) ?? 0) + 1);
    }
    const rawBand = computeCommonLengthBand(n, counts);
    const modeRange =
      rawBand !== null
        ? {
            ...rawBand,
            footnoteBandWord: rawBand.mainLabel.includes(" / ") ? ("これらの帯" as const) : ("この帯" as const),
          }
        : null;

    const minLen = Math.min(...lens);
    const maxLen = Math.max(...lens);

    let minWork: { title: string; ncode?: string } | null = null;
    let maxWork: { title: string; ncode?: string } | null = null;
    for (const e of entries) {
      const len = resolveTitleLength(e);
      if (len === null) continue;
      if (maxWork === null && len === maxLen) {
        maxWork = { title: e.title, ncode: e.ncode };
      }
      if (minWork === null && len === minLen) {
        minWork = { title: e.title, ncode: e.ncode };
      }
    }

    return { overallMean, top10Mean, modeRange, minLen, maxLen, minWork, maxWork };
  }, [entries, insufficient]);

  if (insufficient || stats.overallMean === null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-slate-800/80 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-500">
        データが不足しています
      </div>
    );
  }

  const fmt1 = (x: number) => x.toFixed(1);

  return (
    <div className="flex min-w-0 flex-col divide-y divide-slate-800/90 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40">
      {userLength !== null && stats.overallMean !== null ? (
        <div className="p-4 pb-2">
          <UserLengthComparisonCard userLength={userLength} avg={stats.overallMean} />
        </div>
      ) : null}
      <StatRow
        label="全体の平均"
        value={<span className="tabular-nums">{fmt1(stats.overallMean!)}</span>}
        suffix="文字"
      />
      <StatRow
        label="上位10位の平均"
        value={
          stats.top10Mean !== null ? (
            <span className="tabular-nums">{fmt1(stats.top10Mean)}</span>
          ) : (
            <span className="text-slate-600">—</span>
          )
        }
        suffix={stats.top10Mean !== null ? "文字" : undefined}
      />
      <div className="px-4 py-4">
        <p className="text-[11px] leading-snug text-slate-500">よく見る文字数帯</p>
        {stats.modeRange ? (
          <>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{stats.modeRange.supplement}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-amber-300 sm:text-3xl">
              {stats.modeRange.mainLabel}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              （全体の{stats.modeRange.pct}%が{stats.modeRange.footnoteBandWord}）
            </p>
          </>
        ) : (
          <p className="mt-1 text-slate-600">—</p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-1">
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">最長タイトル</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-100 sm:text-3xl">
            {stats.maxLen} <span className="text-base font-medium text-slate-500">文字</span>
          </p>
          {stats.maxWork ? (
            <WorkTitleLine title={stats.maxWork.title} ncode={stats.maxWork.ncode} />
          ) : null}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] text-slate-500">最短タイトル</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-100 sm:text-3xl">
            {stats.minLen} <span className="text-base font-medium text-slate-500">文字</span>
          </p>
          {stats.minWork ? (
            <WorkTitleLine title={stats.minWork.title} ncode={stats.minWork.ncode} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** 類似検索で確定したタイトル案の長さとコーパス平均の比較 */
function UserLengthComparisonCard({ userLength, avg }: { userLength: number; avg: number }) {
  const diff = userLength - avg;
  let tone: "avg" | "short" | "long";
  if (Math.abs(diff) <= 3) tone = "avg";
  else if (userLength < avg - 3) tone = "short";
  else tone = "long";

  const shell =
    tone === "avg"
      ? "border-amber-500/40 bg-amber-500/[0.08]"
      : tone === "short"
        ? "border-orange-500/45 bg-orange-950/45"
        : "border-emerald-500/40 bg-emerald-950/35";

  const detail =
    tone === "avg"
      ? "平均的"
      : tone === "short"
        ? `平均より短い（−${(avg - userLength).toFixed(1)} 文字）`
        : `平均より長い（+${(userLength - avg).toFixed(1)} 文字）`;

  return (
    <div className={`rounded-lg border px-4 py-4 ${shell}`}>
      <p className="text-[11px] font-medium text-slate-500">あなた</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-100 sm:text-3xl">
        {userLength} <span className="text-base font-medium text-slate-500">文字</span>
      </p>
      <p className="mt-2 text-sm tabular-nums text-slate-300">
        平均より {diff >= 0 ? "+" : ""}
        {diff.toFixed(1)} 文字
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">（{detail}）</p>
    </div>
  );
}

/** 最長・最短に代表した1作品のタイトル（ncode があればなろうへ） */
function WorkTitleLine({ title, ncode }: { title: string; ncode?: string }) {
  const display = truncateTitleDisplay(title, 30);
  const href = narouWorkUrl(ncode);
  const quoted = `「${display}」`;

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 flex min-h-[44px] w-full max-w-full items-start gap-1 rounded-md py-2 pl-0.5 pr-1 text-left text-xs leading-snug text-slate-400 underline decoration-slate-600 underline-offset-[3px] [-webkit-tap-highlight-color:transparent] hover:bg-slate-800/30 hover:text-amber-300/90 hover:decoration-amber-500/50 active:bg-slate-800/40 sm:min-h-0 sm:items-baseline sm:py-1.5"
      >
        <span className="min-w-0 flex-1 break-words">{quoted}</span>
        <span className="mt-0.5 shrink-0 text-amber-400/90 sm:mt-0" aria-hidden>
          ↗
        </span>
      </a>
    );
  }

  return (
    <p className="mt-2 min-h-[44px] max-w-full py-2 text-xs leading-snug text-slate-500 sm:min-h-0 sm:py-0">
      {quoted}
    </p>
  );
}

function StatRow({
  label,
  value,
  suffix,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-4 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <p className="min-w-0 shrink-0 text-[11px] leading-snug text-slate-500">{label}</p>
      <p className="min-w-0 text-2xl font-bold tabular-nums text-slate-100 sm:text-right sm:text-3xl">
        {value}
        {suffix ? <span className="ml-1 text-base font-medium text-slate-500">{suffix}</span> : null}
      </p>
    </div>
  );
}
