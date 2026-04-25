"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TokenDetailModal } from "@/components/TokenDetailModal";
import { coOccurringTokens, countTokenWorksDeduped, getFieldTokens, type TokenField } from "@/lib/analyzer";
import { dedupeRankingEntriesByWork } from "@/lib/rankingDedupe";
import { formatTitleAnatomyTokenShareText } from "@/lib/share-text";
import type { TrendEntry } from "@/lib/trendAnalysis";
import type { TrendWeeklySource } from "@/lib/trendCorpus";
import type { RankingEntry, RankingSource } from "@/lib/types";

const DEFAULT_SOURCE: TrendWeeklySource = "narou_weekly_total";

/** メインフィルタとは独立した週間トレンド比較の対象 */
const WEEKLY_TREND_TOGGLES: { source: TrendWeeklySource; label: string }[] = [
  { source: "narou_weekly_total", label: "総合" },
  { source: "narou_weekly_g101", label: "異世界〔恋愛〕" },
  { source: "narou_weekly_g102", label: "現実世界〔恋愛〕" },
  { source: "narou_weekly_g201", label: "ハイファンタジー" },
  { source: "narou_weekly_g202", label: "ローファンタジー" },
];
const FIELD: TokenField = "titleTokens";

const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * ローカル日付の「今日」から見た次の火曜（今日が火曜なら来週火曜）。
 * (2 - dow + 7) % 7 === 0 のときは 7 日後。
 */
function getNextTuesdayFromToday(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  const dow = d.getDay();
  let add = (2 - dow + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

function formatDateWithWeekdayJa(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const wd = WEEKDAY_JA[d.getDay()];
  return `${y}-${m}-${day}（${wd}）`;
}

function trendWeeksAccumulatedPercent(payload: TrendApiInsufficient): number {
  const hasCurrent = payload.corpusSize.current > 0;
  const hasPrevious = payload.corpusSize.previous > 0;
  const weeks = (hasCurrent ? 1 : 0) + (hasPrevious ? 1 : 0);
  return Math.min(100, (weeks / 2) * 100);
}

function trendWeeksLabel(payload: TrendApiInsufficient): string {
  const hasCurrent = payload.corpusSize.current > 0;
  const hasPrevious = payload.corpusSize.previous > 0;
  const n = (hasCurrent ? 1 : 0) + (hasPrevious ? 1 : 0);
  return `${n}/2 週分`;
}

type TrendApiOk = {
  status: "ok";
  rising: TrendEntry[];
  falling: TrendEntry[];
  currentDate: string;
  previousDate: string;
  corpusSize: { current: number; previous: number };
};

type TrendApiInsufficient = {
  status: "insufficient_data";
  message: string;
  rising: [];
  falling: [];
  currentDate: string;
  previousDate: string;
  corpusSize: { current: number; previous: number };
};

type FetchState =
  | { kind: "idle" | "loading" }
  | { kind: "error"; message: string }
  | { kind: "insufficient"; payload: TrendApiInsufficient }
  | { kind: "ok"; payload: TrendApiOk };

export type TrendSectionProps = {
  /** 固定する週間ソース（指定時は内部トグルを出さず、この値で fetch のみ） */
  source?: TrendWeeklySource;
  /**
   * 語クリック時。戻り値 true ならこのコンポーネント内のモーダルは開かない（例: トークンクラウド側に委譲）
   */
  onTokenClick?: (token: string) => boolean | void;
  /** トークン詳細モーダル用。未指定のときはモーダル内の共起・作品一覧は空になります */
  entries?: RankingEntry[];
  selectedSource?: RankingSource | null;
  selectedGenre?: string | null;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseTrendPayload(json: unknown): TrendApiOk | TrendApiInsufficient | null {
  if (!isRecord(json)) return null;
  const status = json.status;
  if (status !== "ok" && status !== "insufficient_data") return null;
  const rising = json.rising;
  const falling = json.falling;
  if (!Array.isArray(rising) || !Array.isArray(falling)) return null;
  if (status === "insufficient_data") {
    const message = typeof json.message === "string" ? json.message : "";
    const currentDate = typeof json.currentDate === "string" ? json.currentDate : "";
    const previousDate = typeof json.previousDate === "string" ? json.previousDate : "";
    const corpusSize = isRecord(json.corpusSize) ? json.corpusSize : {};
    const current = typeof corpusSize.current === "number" ? corpusSize.current : 0;
    const previous = typeof corpusSize.previous === "number" ? corpusSize.previous : 0;
    return {
      status: "insufficient_data",
      message,
      rising: [],
      falling: [],
      currentDate,
      previousDate,
      corpusSize: { current, previous },
    };
  }
  const currentDate = typeof json.currentDate === "string" ? json.currentDate : "";
  const previousDate = typeof json.previousDate === "string" ? json.previousDate : "";
  const corpusSize = isRecord(json.corpusSize) ? json.corpusSize : {};
  const cSize = {
    current: typeof corpusSize.current === "number" ? corpusSize.current : 0,
    previous: typeof corpusSize.previous === "number" ? corpusSize.previous : 0,
  };
  const parseEntry = (row: unknown): TrendEntry | null => {
    if (!isRecord(row)) return null;
    const token = typeof row.token === "string" ? row.token : "";
    if (token === "") return null;
    const currentCount = typeof row.currentCount === "number" ? row.currentCount : 0;
    const previousCount = typeof row.previousCount === "number" ? row.previousCount : 0;
    const delta = typeof row.delta === "number" ? row.delta : 0;
    const ratioRaw = row.ratio;
    const ratio =
      typeof ratioRaw === "number" && Number.isFinite(ratioRaw)
        ? ratioRaw
        : Number.POSITIVE_INFINITY;
    return { token, currentCount, previousCount, delta, ratio };
  };
  const risingParsed = rising.map(parseEntry).filter((x): x is TrendEntry => x !== null);
  const fallingParsed = falling.map(parseEntry).filter((x): x is TrendEntry => x !== null);
  return {
    status: "ok",
    rising: risingParsed,
    falling: fallingParsed,
    currentDate,
    previousDate,
    corpusSize: cSize,
  };
}

/** 伸び列: 正の delta の最大（バー正規化用） */
function maxPositiveDelta(rows: TrendEntry[]): number {
  let m = 1;
  for (const r of rows) m = Math.max(m, r.delta);
  return m;
}

/** 下がり列: |delta| の最大 */
function maxAbsNegativeDelta(rows: TrendEntry[]): number {
  let m = 1;
  for (const r of rows) m = Math.max(m, Math.abs(r.delta));
  return m;
}

function trendEntryBadge(
  row: TrendEntry,
  variant: "rising" | "falling"
): "新規" | "急上昇" | "急減" | null {
  if (row.previousCount === 0 && row.currentCount > 0) return "新規";
  if (
    variant === "rising" &&
    row.currentCount >= 5 &&
    Number.isFinite(row.ratio) &&
    row.ratio >= 3
  ) {
    return "急上昇";
  }
  if (variant === "falling" && row.previousCount >= 5 && row.ratio <= 0.3) {
    return "急減";
  }
  return null;
}

type TrendBarRowProps = {
  row: TrendEntry;
  barDenominator: number;
  variant: "rising" | "falling";
  onOpen: (row: TrendEntry) => void;
};

function TrendBarRow({ row, barDenominator, variant, onOpen }: TrendBarRowProps) {
  const pct = Math.min(100, (Math.abs(row.delta) / barDenominator) * 100);
  const barWidthPct = row.delta !== 0 ? Math.max(pct, 4) : 0;
  const deltaLabel = row.delta > 0 ? `+${row.delta}` : String(row.delta);
  const badge = trendEntryBadge(row, variant);

  const barGradientClass =
    variant === "rising"
      ? "bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300"
      : "bg-gradient-to-r from-slate-600 via-slate-500 to-slate-400";

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="group w-full max-w-full min-w-0 touch-manipulation rounded-xl border border-slate-800/90 bg-slate-950/35 px-2.5 py-2.5 text-left transition-colors active:bg-slate-900/55 sm:px-3 sm:hover:border-slate-700/90 sm:hover:bg-slate-900/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/35"
    >
      <div className="flex w-full min-w-0 max-w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-2">
        <div className="flex min-w-0 max-w-full flex-1 items-baseline gap-1.5 sm:gap-2">
          <span className="shrink-0 text-sm font-semibold text-amber-400/90" aria-hidden>
            {variant === "rising" ? "↑" : "↓"}
          </span>
          <span className="min-w-0 max-w-full flex-1 truncate text-[15px] font-semibold leading-snug text-slate-100 sm:text-base sm:group-hover:text-amber-50/95">
            {row.token}
          </span>
        </div>
        <div className="flex w-full min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 sm:w-auto sm:justify-end">
          {badge !== null ? (
            <span
              className={`shrink-0 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide ${
                badge === "新規"
                  ? "border border-emerald-500/35 bg-emerald-500/15 text-emerald-300/95"
                  : badge === "急上昇"
                    ? "border border-amber-400/40 bg-amber-400/15 text-amber-200"
                    : "border border-slate-500/40 bg-slate-600/25 text-slate-300"
              }`}
            >
              {badge}
            </span>
          ) : null}
          <span
            className={`shrink-0 whitespace-nowrap text-[15px] font-bold tabular-nums leading-none sm:text-base ${
              variant === "rising"
                ? "text-emerald-400/95"
                : "text-slate-500 sm:group-hover:text-slate-400"
            }`}
          >
            {deltaLabel}
          </span>
        </div>
      </div>
      <div
        className="mt-2.5 h-2 w-full min-w-0 max-w-full overflow-hidden rounded-full bg-slate-800/80 ring-1 ring-slate-700/30"
        aria-hidden
      >
        <div
          className={`h-full max-w-full min-w-0 rounded-full ${barGradientClass} transition-[width] duration-300 ease-out`}
          style={{ width: `${barWidthPct}%`, maxWidth: "100%" }}
        />
      </div>
    </button>
  );
}

export function TrendSection({
  source: controlledSource,
  onTokenClick,
  entries,
  selectedSource = null,
  selectedGenre = null,
}: TrendSectionProps) {
  const [internalSource, setInternalSource] = useState<TrendWeeklySource>(DEFAULT_SOURCE);
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const [detail, setDetail] = useState<TrendEntry | null>(null);
  /** クライアントのみ（SSR と日付がずれないようマウント後に設定） */
  const [nextTuesdayDisplay, setNextTuesdayDisplay] = useState("");

  const isControlled = controlledSource !== undefined;
  const resolvedSource: string = isControlled ? controlledSource : internalSource;
  const showWeeklyToggle = !isControlled;

  useEffect(() => {
    setDetail(null);
  }, [resolvedSource]);

  useEffect(() => {
    setNextTuesdayDisplay(formatDateWithWeekdayJa(getNextTuesdayFromToday()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setState({ kind: "loading" });
      try {
        const q = new URLSearchParams({ source: resolvedSource });
        const res = await fetch(`/api/trend?${q.toString()}`, { cache: "no-store" });
        const json: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          const err =
            isRecord(json) && typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
          if (!cancelled) setState({ kind: "error", message: err });
          return;
        }
        const parsed = parseTrendPayload(json);
        if (parsed === null) {
          if (!cancelled) setState({ kind: "error", message: "invalid_response" });
          return;
        }
        if (parsed.status === "insufficient_data") {
          if (!cancelled) setState({ kind: "insufficient", payload: parsed });
          return;
        }
        if (!cancelled) setState({ kind: "ok", payload: parsed });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "network_error" });
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [resolvedSource]);

  const titleWorkCounts = useMemo(
    () => (entries && entries.length > 0 ? countTokenWorksDeduped(entries, FIELD) : new Map<string, number>()),
    [entries]
  );

  const { minCount, maxCount } = useMemo(() => {
    const vals = Array.from(titleWorkCounts.values());
    if (vals.length === 0) return { minCount: 0, maxCount: 1 };
    return { minCount: Math.min(...vals), maxCount: Math.max(...vals) };
  }, [titleWorkCounts]);

  const coOccurrenceMap = useMemo(() => {
    if (!detail || !entries || entries.length === 0) return new Map<string, number>();
    return coOccurringTokens(entries, FIELD, detail.token);
  }, [entries, detail]);

  const coOccurrenceTop10 = useMemo(() => {
    return Array.from(coOccurrenceMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [coOccurrenceMap]);

  const containingCount = useMemo(() => {
    if (!detail) return 0;
    if (entries && entries.length > 0) {
      const n = titleWorkCounts.get(detail.token);
      if (n !== undefined) return n;
    }
    return detail.currentCount;
  }, [detail, entries, titleWorkCounts]);

  const appearingWorks = useMemo(() => {
    if (!detail || !entries || entries.length === 0) return [];
    const matched = entries.filter((e) => getFieldTokens(e, FIELD).includes(detail.token));
    return dedupeRankingEntriesByWork(matched);
  }, [entries, detail]);

  const tokenShareText = useMemo(() => {
    if (!detail) return "";
    return formatTitleAnatomyTokenShareText({
      token: detail.token,
      field: FIELD,
      selectedSource,
      selectedGenre,
      coOccurrence: coOccurrenceTop10.map(([t, c]) => ({ token: t, count: c })),
    });
  }, [detail, selectedSource, selectedGenre, coOccurrenceTop10]);

  const openDetail = useCallback(
    (row: TrendEntry) => {
      if (onTokenClick) {
        const handled = onTokenClick(row.token);
        if (handled === true) return;
      }
      setDetail(row);
    },
    [onTokenClick]
  );

  const closeDetail = useCallback(() => setDetail(null), []);

  const maxRisingDelta =
    state.kind === "ok" ? maxPositiveDelta(state.payload.rising) : 1;
  const maxFallingAbs =
    state.kind === "ok" ? maxAbsNegativeDelta(state.payload.falling) : 1;

  return (
    <section
      className="w-full max-w-full min-w-0 overflow-x-hidden rounded-xl border border-slate-800 bg-slate-900/60 px-2.5 py-4 sm:px-6 sm:py-6"
      aria-labelledby="trend-section-heading"
    >
      <header className="mb-4 min-w-0 sm:mb-5">
        <h2
          id="trend-section-heading"
          className="min-w-0 text-balance text-lg font-semibold tracking-tight text-slate-100 sm:text-xl"
        >
          今週のトレンド
        </h2>
        <p className="mt-1.5 min-w-0 text-pretty text-xs leading-relaxed text-slate-500 sm:text-sm">
          先週と比べて伸びている語・下がっている語
        </p>
        {showWeeklyToggle ? (
          <div
            className="mt-3 flex w-full min-w-0 flex-wrap content-start gap-1.5 sm:mt-4 sm:gap-2"
            role="tablist"
            aria-label="週間ランキングの比較対象（メインのソースフィルタとは独立）"
          >
            {WEEKLY_TREND_TOGGLES.map(({ source: src, label }) => {
              const active = internalSource === src;
              return (
                <button
                  key={src}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setInternalSource(src)}
                  className={`touch-manipulation whitespace-nowrap rounded-full px-2 py-1.5 text-[10px] font-medium leading-tight transition-colors active:opacity-90 sm:px-3 sm:py-1 sm:text-xs sm:hover:border-slate-600 sm:hover:bg-slate-800/60 sm:hover:text-slate-300 ${
                    active
                      ? "bg-amber-400 text-slate-950 shadow-sm shadow-amber-500/25"
                      : "border border-slate-700/80 bg-slate-900/50 text-slate-400"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      {state.kind === "loading" || state.kind === "idle" ? (
        <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-6 md:grid-cols-2" aria-busy="true">
          <div className="space-y-3">
            <div className="h-5 w-32 rounded bg-slate-800/80" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-[4.25rem] rounded-xl bg-slate-800/50" />
            ))}
          </div>
          <div className="space-y-3">
            <div className="h-5 w-32 rounded bg-slate-800/80" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={`r-${i}`} className="h-[4.25rem] rounded-xl bg-slate-800/50" />
            ))}
          </div>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <p className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-300/95">
          トレンドを読み込めませんでした（{state.message}）
        </p>
      ) : null}

      {state.kind === "insufficient" ? (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-b from-slate-800/55 via-slate-900/35 to-slate-950/50 px-5 py-6 shadow-inner shadow-amber-950/10 sm:px-7 sm:py-8">
          <p className="text-lg font-semibold tracking-tight text-amber-100/95">📊 トレンド分析 準備中</p>
          <div
            className="mt-3 h-0.5 w-40 max-w-full rounded-full bg-gradient-to-r from-amber-400/80 via-amber-400/40 to-transparent"
            aria-hidden
          />
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            先週と今週のランキングを比較して、
            <br />
            伸びている語・下がっている語を自動表示。
          </p>
          <div className="mt-5 space-y-1.5 text-sm tabular-nums text-slate-500">
            {state.payload.currentDate !== "" ? (
              <p>
                <span className="text-slate-500">現在のデータ:</span>{" "}
                <span className="font-medium text-slate-300">{state.payload.currentDate}</span>
              </p>
            ) : null}
            {nextTuesdayDisplay !== "" ? (
              <p>
                <span className="text-slate-500">次回更新予定:</span>{" "}
                <span className="font-medium text-amber-200/90">{nextTuesdayDisplay}</span>
              </p>
            ) : (
              <p className="flex flex-wrap items-center gap-2 text-slate-600">
                <span>次回更新予定:</span>
                <span className="inline-block h-4 w-36 animate-pulse rounded bg-slate-700/45" aria-hidden />
              </p>
            )}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">週次で自動更新されます</p>
          <div
            className="my-4 h-px w-full bg-gradient-to-r from-transparent via-slate-600/45 to-transparent"
            aria-hidden
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <div
              className="h-2.5 w-full min-w-0 max-w-full overflow-hidden rounded-full bg-slate-800/90 ring-1 ring-slate-700/40"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(trendWeeksAccumulatedPercent(state.payload))}
              aria-label="比較に必要な週数の蓄積状況"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-300 transition-[width] duration-500 ease-out"
                style={{ width: `${trendWeeksAccumulatedPercent(state.payload)}%` }}
              />
            </div>
            <p className="shrink-0 text-center text-xs font-semibold tabular-nums text-amber-200/85 sm:text-right">
              {trendWeeksLabel(state.payload)}
            </p>
          </div>
        </div>
      ) : null}

      {state.kind === "ok" ? (
        <div className="flex w-full min-w-0 max-w-full flex-col flex-wrap gap-8 md:flex-row md:gap-6 lg:gap-10">
          <p className="w-full shrink-0 basis-full text-xs leading-relaxed text-slate-500">
            ※ 上昇／下降リストは週間ランキング全体から集計します。ページ上部の作品種別フィルタは未連動です。
          </p>
          <div className="w-full min-w-0 max-w-full flex-1 basis-full md:min-w-0 md:flex-1 md:basis-[calc(50%-0.75rem)]">
            <h3 className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-amber-200/90">
              <span aria-hidden>🔥</span>
              伸びてる語
            </h3>
            {state.payload.rising.length === 0 ? (
              <p className="text-sm text-slate-500">この週のタイトル語で大きな伸びはまだありません。</p>
            ) : (
              <ul className="space-y-2.5" role="list">
                {state.payload.rising.map((row) => (
                  <li key={row.token} className="min-w-0 max-w-full">
                    <TrendBarRow
                      row={row}
                      barDenominator={maxRisingDelta}
                      variant="rising"
                      onOpen={openDetail}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="w-full min-w-0 max-w-full flex-1 basis-full md:min-w-0 md:flex-1 md:basis-[calc(50%-0.75rem)]">
            <h3 className="mb-3 flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-slate-400">
              <span aria-hidden>❄️</span>
              下がってる語
            </h3>
            {state.payload.falling.length === 0 ? (
              <p className="text-sm text-slate-500">この週のタイトル語で大きな下がりはまだありません。</p>
            ) : (
              <ul className="space-y-2.5" role="list">
                {state.payload.falling.map((row) => (
                  <li key={row.token} className="min-w-0 max-w-full">
                    <TrendBarRow
                      row={row}
                      barDenominator={maxFallingAbs}
                      variant="falling"
                      onOpen={openDetail}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {state.kind === "ok" &&
      state.payload.currentDate !== "" &&
      state.payload.previousDate !== "" ? (
        <p className="mx-auto mt-6 max-w-full px-0.5 text-center text-[10px] leading-snug text-slate-600 tabular-nums sm:text-[11px]">
          {state.payload.currentDate} vs {state.payload.previousDate} の比較
        </p>
      ) : state.kind === "ok" && state.payload.currentDate !== "" ? (
        <p className="mx-auto mt-6 max-w-full px-0.5 text-center text-[10px] tabular-nums text-slate-600 sm:text-[11px]">
          基準日: {state.payload.currentDate}
        </p>
      ) : null}

      <TokenDetailModal
        isOpen={detail !== null}
        token={detail?.token ?? ""}
        field={FIELD}
        containingCount={containingCount}
        minCount={minCount}
        maxCount={maxCount}
        coOccurrenceTop10={coOccurrenceTop10}
        appearingWorks={appearingWorks}
        shareText={tokenShareText}
        presentation="modal"
        onClose={closeDetail}
        onSelectToken={(next) => {
          const pick =
            state.kind === "ok"
              ? [...state.payload.rising, ...state.payload.falling].find((r) => r.token === next)
              : undefined;
          if (pick) setDetail(pick);
          else setDetail({ token: next, currentCount: 0, previousCount: 0, delta: 0, ratio: 0 });
        }}
      />
    </section>
  );
}
