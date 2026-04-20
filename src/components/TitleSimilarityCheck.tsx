"use client";

import { ExternalLink, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { useSimilarityCloudBridge } from "@/components/SimilarityCloudBridge";
import { useUserSearchedTitle } from "@/components/UserSearchedTitleContext";
import { highlightTokens } from "@/lib/highlight";
import { SIMILARITY_SEARCH_GENRE_OPTIONS } from "@/lib/similaritySearchGenres";

type SimilarityResultRow = {
  ncode: string;
  title: string;
  genre: string;
  source: string;
  points: number;
  score: number;
  normalizedScore: number;
  matchedTokens: string[];
  rareMatchedTokens: string[];
};

type SimilarApiPayload = {
  tokens: string[];
  results: SimilarityResultRow[];
  corpusSize: number;
};

const HISTORY_KEY = "taitolabo:similar:history";
const HISTORY_MAX = 5;

function narouWorkUrl(ncode: string | undefined): string | null {
  if (ncode === undefined) return null;
  const n = ncode.trim().toLowerCase();
  if (n === "") return null;
  return `https://ncode.syosetu.com/${n}/`;
}

function parseSimilarResponse(data: unknown): SimilarApiPayload | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.tokens) || !o.tokens.every((t) => typeof t === "string")) return null;
  if (!Array.isArray(o.results)) return null;
  if (typeof o.corpusSize !== "number" || !Number.isFinite(o.corpusSize)) return null;

  const results: SimilarityResultRow[] = [];
  for (const item of o.results) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return null;
    const r = item as Record<string, unknown>;
    if (typeof r.ncode !== "string") return null;
    if (typeof r.title !== "string") return null;
    if (typeof r.genre !== "string") return null;
    if (typeof r.source !== "string") return null;
    if (typeof r.points !== "number" || !Number.isFinite(r.points)) return null;
    if (typeof r.score !== "number" || !Number.isFinite(r.score)) return null;
    if (typeof r.normalizedScore !== "number" || !Number.isFinite(r.normalizedScore)) return null;
    if (!Array.isArray(r.matchedTokens) || !r.matchedTokens.every((t) => typeof t === "string")) {
      return null;
    }
    const rareRaw = r.rareMatchedTokens;
    const rareMatchedTokens =
      Array.isArray(rareRaw) && rareRaw.every((t) => typeof t === "string") ? rareRaw : [];
    results.push({
      ncode: r.ncode,
      title: r.title,
      genre: r.genre,
      source: r.source,
      points: r.points,
      score: r.score,
      normalizedScore: r.normalizedScore,
      matchedTokens: r.matchedTokens,
      rareMatchedTokens,
    });
  }

  return { tokens: o.tokens, results, corpusSize: o.corpusSize };
}

function loadHistoryFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function saveHistoryToStorage(titles: string[]) {
  try {
    window.sessionStorage.setItem(HISTORY_KEY, JSON.stringify(titles.slice(0, HISTORY_MAX)));
  } catch {
    /* ignore quota */
  }
}

function pushHistory(title: string): string[] {
  const t = title.trim();
  if (t === "") return loadHistoryFromStorage();
  const prev = loadHistoryFromStorage();
  const next = [t, ...prev.filter((x) => x !== t)].slice(0, HISTORY_MAX);
  saveHistoryToStorage(next);
  return next;
}

type SimilarApiErrorCode = "INVALID_INPUT" | "RATE_LIMIT" | "INTERNAL_ERROR" | "UNKNOWN";

/** UI と連続エラー判定に使う（fetch 失敗は NETWORK のみ） */
type SimilarErrorKind = "INVALID_INPUT" | "RATE_LIMIT" | "INTERNAL_ERROR" | "NETWORK";

function messageForErrorKind(kind: SimilarErrorKind): string {
  switch (kind) {
    case "INVALID_INPUT":
      return "入力内容を確認してください";
    case "RATE_LIMIT":
      return "リクエストが多すぎます。1分ほど待ってからお試しください";
    case "INTERNAL_ERROR":
      return "エラーが発生しました。時間を置いて再度お試しください";
    case "NETWORK":
      return "通信に失敗しました。接続を確認してください";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function parseSimilarApiError(data: unknown): { code: SimilarApiErrorCode } | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  const codeRaw = o.code;
  const code: SimilarApiErrorCode =
    codeRaw === "INVALID_INPUT" || codeRaw === "RATE_LIMIT" || codeRaw === "INTERNAL_ERROR"
      ? codeRaw
      : "UNKNOWN";
  return { code };
}

function apiCodeToErrorKind(code: SimilarApiErrorCode): SimilarErrorKind {
  if (code === "UNKNOWN") return "INTERNAL_ERROR";
  return code;
}

const COOLDOWN_MS = 30_000;
const ERROR_STREAK_MAX = 3;

export function TitleSimilarityCheck() {
  const { setCloudMatchTokens } = useSimilarityCloudBridge();
  const searchedTitle = useUserSearchedTitle();
  const inputId = useId();
  const resultsRegionId = useId();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<SimilarApiPayload | null>(null);
  const [hasCompletedSearch, setHasCompletedSearch] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errorStreakRef = useRef<{ kind: SimilarErrorKind | null; count: number }>({
    kind: null,
    count: 0,
  });
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  /** クールダウン中の残り秒表示用 */
  const [cooldownNow, setCooldownNow] = useState(() => Date.now());
  /** 類似検索のみのジャンル絞り込み（null = すべて）。ページ再読込でリセット */
  const [searchGenre, setSearchGenre] = useState<string | null>(null);

  const fieldRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const cooldownUntilRef = useRef<number | null>(null);

  useEffect(() => {
    setHistory(loadHistoryFromStorage());
  }, []);

  useEffect(() => {
    cooldownUntilRef.current = cooldownUntil;
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil === null) return;
    const tick = () => setCooldownNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil === null) return;
    if (Date.now() >= cooldownUntil) {
      setCooldownUntil(null);
    }
  }, [cooldownUntil, cooldownNow]);

  const clearResults = useCallback(() => {
    setPayload(null);
    setHasCompletedSearch(false);
    setLoading(false);
    setCloudMatchTokens(null);
    setSubmitError(null);
    errorStreakRef.current = { kind: null, count: 0 };
    setCooldownUntil(null);
  }, [setCloudMatchTokens]);

  const registerFailure = useCallback((kind: SimilarErrorKind) => {
    setPayload(null);
    setHasCompletedSearch(false);
    setCloudMatchTokens(null);
    setSubmitError(messageForErrorKind(kind));
    const prev = errorStreakRef.current;
    const nextCount = prev.kind === kind ? prev.count + 1 : 1;
    if (nextCount >= ERROR_STREAK_MAX) {
      errorStreakRef.current = { kind: null, count: 0 };
      queueMicrotask(() => {
        setCooldownUntil(Date.now() + COOLDOWN_MS);
      });
    } else {
      errorStreakRef.current = { kind, count: nextCount };
    }
  }, [setCloudMatchTokens]);

  const submit = useCallback(async () => {
    if (cooldownUntilRef.current !== null && Date.now() < cooldownUntilRef.current) {
      return;
    }
    const title = query.trim();
    if (title.length === 0) return;

    setLoading(true);
    setPayload(null);
    setSubmitError(null);
    try {
      const res = await fetch("/api/similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ...(searchGenre !== null ? { genre: searchGenre } : {}),
        }),
        credentials: "same-origin",
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const parsedErr = parseSimilarApiError(data);
        const kind = parsedErr ? apiCodeToErrorKind(parsedErr.code) : "INTERNAL_ERROR";
        registerFailure(kind);
        console.error("タイトル類似度チェック失敗", { status: res.status, data, code: parsedErr?.code });
        return;
      }
      console.log("タイトル類似度チェック", data);
      const parsed = parseSimilarResponse(data);
      if (parsed) {
        setPayload(parsed);
        setHasCompletedSearch(true);
        setHistory(pushHistory(title));
        setCloudMatchTokens(parsed.tokens);
        setSubmitError(null);
        errorStreakRef.current = { kind: null, count: 0 };
        setCooldownUntil(null);
        searchedTitle?.setUserTitle(title);
      } else {
        registerFailure("INTERNAL_ERROR");
      }
    } catch (e) {
      registerFailure("NETWORK");
      console.error("タイトル類似度チェック失敗", e);
    } finally {
      setLoading(false);
    }
  }, [query, searchGenre, setCloudMatchTokens, registerFailure, searchedTitle]);

  useEffect(() => {
    if (!historyOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (fieldRef.current?.contains(e.target as Node)) return;
      setHistoryOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [historyOpen]);

  const handleClearAll = useCallback(() => {
    setQuery("");
    clearResults();
    setHistoryOpen(false);
    searchedTitle?.setUserTitle(null);
  }, [clearResults, searchedTitle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const sec = sectionRef.current;
      if (!sec) return;
      const ae = document.activeElement;
      if (!(ae instanceof Node) || !sec.contains(ae)) return;
      if (historyOpen) {
        e.preventDefault();
        setHistoryOpen(false);
        return;
      }
      const hasSomething =
        query.trim().length > 0 ||
        payload !== null ||
        submitError !== null ||
        loading ||
        hasCompletedSearch;
      if (hasSomething) {
        e.preventDefault();
        handleClearAll();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [
    historyOpen,
    query,
    payload,
    submitError,
    loading,
    hasCompletedSearch,
    handleClearAll,
  ]);

  const onInputChange = (next: string) => {
    setQuery(next);
    if (next.trim() === "") {
      clearResults();
    }
  };

  const inCooldown =
    cooldownUntil !== null && cooldownNow < cooldownUntil;
  const cooldownRemainingSec =
    cooldownUntil !== null ? Math.max(0, Math.ceil((cooldownUntil - cooldownNow) / 1000)) : 0;

  /** エラー表示中は検索結果ブロックを出さない */
  const showResultsBlock = submitError === null && (loading || hasCompletedSearch);

  return (
    <section
      ref={sectionRef}
      className="relative z-10 min-w-0 rounded-2xl border border-slate-800/90 bg-slate-900/60 p-4 shadow-lg shadow-black/20 sm:p-6"
      aria-labelledby="similarity-check-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2
          id="similarity-check-heading"
          className="min-w-0 text-lg font-semibold tracking-tight text-amber-400 sm:text-xl"
        >
          タイトル類似度チェック
        </h2>
        <p className="w-full max-w-full text-left text-xs leading-relaxed text-slate-500 sm:max-w-sm sm:w-auto sm:text-right">
          <a
            href="#token-cloud"
            className="inline-flex min-h-[44px] items-center py-2 text-amber-400/90 underline decoration-amber-500/40 underline-offset-2 hover:text-amber-300 sm:min-h-0 sm:py-0"
          >
            トークンクラウドへ
          </a>
          <span className="block sm:inline sm:before:content-['・']">
            検索後、クラウド内の一致語を枠で示します（タイトル／あらすじ／タグの各タブ）
          </span>
        </p>
      </div>

      <div className="mt-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-stretch">
        <form
          className="flex min-w-0 w-full flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div ref={fieldRef} className="relative min-w-0 w-full flex-1 sm:min-w-0 sm:basis-0">
            <input
              id={inputId}
              type="text"
              name="title"
              value={query}
              onChange={(e) => onInputChange(e.target.value)}
              onFocus={() => {
                if (history.length > 0) setHistoryOpen(true);
              }}
              placeholder="例: 戦国時代の農村に転生したら無双ゲームのUIが表示されてるんだが？"
              maxLength={100}
              disabled={loading}
              autoComplete="off"
              className={`min-h-[44px] w-full rounded-xl border border-slate-700/90 bg-slate-950/70 py-2.5 text-sm text-slate-100 outline-none ring-amber-400/0 transition-[border-color,box-shadow] focus:border-amber-500/50 focus:ring-2 focus:ring-amber-400/35 disabled:opacity-60 ${
                query.trim().length > 0 ? "pl-4 pr-12" : "px-4"
              }`}
              aria-label="類似度を調べるタイトル"
            />
            {query.length > 0 ? (
              <button
                type="button"
                onClick={handleClearAll}
                className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 touch-manipulation items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                aria-label="入力と検索結果をクリア"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden />
              </button>
            ) : null}

            {historyOpen && history.length > 0 ? (
              <ul
                id={`${inputId}-history`}
                className="absolute left-0 right-0 z-20 mt-1 max-h-52 w-full max-w-[min(100%,calc(100vw-2rem))] overflow-auto overflow-x-hidden rounded-xl border border-slate-700/90 bg-slate-950 py-1 shadow-xl shadow-black/40"
              >
                {history.map((h) => (
                  <li key={h} className="min-w-0">
                    <button
                      type="button"
                      className="w-full min-w-0 px-3 py-2 text-left text-sm break-words text-slate-200 hover:bg-slate-800/90 focus:bg-slate-800/90 focus:outline-none"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setQuery(h);
                        setHistoryOpen(false);
                      }}
                    >
                      {h}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={loading || inCooldown}
            className="min-h-[48px] w-full shrink-0 touch-manipulation rounded-xl border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-sm font-semibold text-amber-200 shadow-md shadow-amber-900/20 transition-colors hover:border-amber-400/70 hover:bg-amber-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[44px] sm:w-auto sm:px-6 sm:py-2.5"
          >
            {loading ? "検索中…" : inCooldown ? `再試行まで ${cooldownRemainingSec}秒` : "検索"}
          </button>
        </form>
      </div>

      <div className="mt-5 w-full min-w-0">
        <p className="mb-2 text-[11px] font-medium text-slate-500">検索対象ジャンル</p>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label="類似検索の対象ジャンル"
        >
          {SIMILARITY_SEARCH_GENRE_OPTIONS.map((opt) => {
            const selected =
              (searchGenre === null && opt.value === null) ||
              (searchGenre !== null && opt.value === searchGenre);
            return (
              <button
                key={opt.value ?? "all"}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={loading}
                onClick={() => setSearchGenre(opt.value)}
                className={`min-h-[40px] touch-manipulation rounded-full border px-3 py-2 text-left text-xs font-medium leading-snug transition-colors disabled:opacity-50 sm:min-h-0 sm:py-1.5 ${
                  selected
                    ? "border-amber-500/45 bg-amber-500/10 text-amber-100"
                    : "border-slate-700/80 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:bg-slate-800/40"
                }`}
              >
                {opt.chipLabel}
              </button>
            );
          })}
        </div>
      </div>

      {submitError !== null ? (
        <div className="mt-2 space-y-1" role="alert" aria-live="polite">
          <p className="text-xs leading-relaxed text-red-400/95">{submitError}</p>
          {inCooldown ? (
            <p className="text-[11px] leading-relaxed text-red-400/75">
              30秒後に再試行できます
              {cooldownRemainingSec > 0 ? `（あと ${cooldownRemainingSec} 秒）` : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {showResultsBlock && (
        <div
          id={resultsRegionId}
          className="mt-5 min-h-0 border-t border-slate-800/80 pt-5"
          role="region"
          aria-label="類似検索の結果"
        >
          {loading && !payload ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">解析中…</p>
              <div className="h-4 w-2/3 max-w-md animate-pulse rounded-md bg-slate-800/80" />
              <div className="h-24 rounded-xl border border-slate-800/60 bg-slate-950/40" />
              <div className="h-24 rounded-xl border border-slate-800/60 bg-slate-950/40" />
            </div>
          ) : null}

          {!loading && hasCompletedSearch && payload ? (
            <>
              {payload.tokens.length > 0 ? (
                <p className="text-sm text-slate-500">
                  「{payload.tokens.join("、")}」で照合中
                </p>
              ) : (
                <p className="text-sm text-slate-500">特徴語が抽出できませんでした</p>
              )}

              {payload.tokens.length === 0 ? null : payload.results.length === 0 ? (
                <p className="mt-4 text-sm text-slate-400" role="status" aria-live="polite">
                  似たタイトルは見つかりませんでした
                </p>
              ) : (
                <>
                  <ol className="mt-4 space-y-4" aria-live="polite" aria-relevant="additions text">
                    {payload.results.map((row, index) => {
                      const rank = index + 1;
                      const href = row.source.startsWith("narou_") ? narouWorkUrl(row.ncode) : null;
                      const titleHighlighted = highlightTokens(row.title, row.matchedTokens);

                      const metaRow = (
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-xs tabular-nums text-amber-500/90">#{rank}</span>
                          <span className="rounded border border-slate-700/80 bg-slate-800/50 px-2 py-0.5 text-xs text-slate-400">
                            {row.genre}
                          </span>
                          <span className="text-xs tabular-nums text-slate-500">{row.matchedTokens.length}語一致</span>
                        </div>
                      );

                      const rareLine =
                        row.rareMatchedTokens.length > 0 ? (
                          <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-relaxed text-amber-200/85">
                            <Sparkles
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/90"
                              strokeWidth={2}
                              aria-hidden
                            />
                            <span>希少一致: {row.rareMatchedTokens.join("、")}</span>
                          </p>
                        ) : null;

                      return (
                        <li key={`${row.ncode}-${row.source}-${rank}`}>
                          {href !== null ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group block rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-slate-200 outline-none ring-amber-400/30 transition-colors hover:border-amber-500/40 hover:bg-slate-900/60 focus-visible:ring-2"
                              aria-label={`「${row.title}」の『小説家になろう』作品ページを別タブで開く`}
                            >
                              {metaRow}
                              <div className="mt-2 text-base font-medium">
                                <span className="inline-flex max-w-full items-start gap-1.5 text-slate-100 underline decoration-amber-500/40 underline-offset-[3px] transition-colors group-hover:text-amber-200 group-hover:decoration-amber-400/90">
                                  <span className="min-w-0 break-words">{titleHighlighted}</span>
                                  <ExternalLink
                                    className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-500 opacity-80 transition-colors group-hover:text-amber-300/90"
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </span>
                              </div>
                              {rareLine}
                            </a>
                          ) : (
                            <div className="rounded-xl border border-slate-800/80 bg-slate-950/50 p-4 text-slate-200">
                              {metaRow}
                              <div className="mt-2 text-base font-medium text-slate-100">
                                <span className="min-w-0 break-words">{titleHighlighted}</span>
                              </div>
                              {rareLine}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                  {payload.results.length > 0 &&
                  payload.results.every((r) => r.matchedTokens.length === 1) ? (
                    <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-600">
                      弱い一致です。特徴語を増やして再検索すると精度が上がります
                    </p>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
