"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { validateDataset } from "@/lib/validator";
import type { RankingDataset, RankingSource } from "@/lib/types";
import { RANKING_SOURCE_LABELS } from "@/lib/types";
import { KaihatsuToast } from "./KaihatsuToast";

const KAIHATSU_SESSION_KEY = "kaihatsu_unlocked";
const KAIHATSU_ATTEMPTS_KEY = "kaihatsu_attempts";
const KAIHATSU_LOCKED_UNTIL_KEY = "kaihatsu_locked_until";
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 10 * 60 * 1000;

const CORRECT_PASSWORD = "Zx7Kq9mPvB3nTfWs";

const PLACEHOLDER = `{
  "source": "narou_daily_total",
  "date": "2026-04-19",
  "entries": [
    {
      "rank": 1,
      "title": "サンプルタイトル",
      "titleTokens": ["サンプル", "タイトル"],
      "points": 1234,
      "genre": "異世界〔恋愛〕",
      "tags": ["タグ1", "タグ2"],
      "synopsisHead": "あらすじの冒頭テキスト…",
      "synopsisTokens": ["キーワード1", "キーワード2"],
      "isShort": true
    }
  ]
}`;

type DatasetSummary = {
  source: RankingSource;
  date: string;
  entriesCount: number;
};

export default function KaihatsuPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [validData, setValidData] = useState<RankingDataset | null>(null);

  const [saving, setSaving] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [datasets, setDatasets] = useState<DatasetSummary[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [toast, setToast] = useState<{ message: string; variant: "success" | "error" } | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(KAIHATSU_SESSION_KEY) === "1") {
        setUnlocked(true);
        return;
      }
      const legacyLock = sessionStorage.getItem("kaihatsu_lock_until");
      if (legacyLock) {
        sessionStorage.setItem(KAIHATSU_LOCKED_UNTIL_KEY, legacyLock);
        sessionStorage.removeItem("kaihatsu_lock_until");
      }
      const savedAttempts = Number(sessionStorage.getItem(KAIHATSU_ATTEMPTS_KEY) ?? 0);
      setAttempts(Number.isFinite(savedAttempts) ? savedAttempts : 0);
      const savedLock = Number(sessionStorage.getItem(KAIHATSU_LOCKED_UNTIL_KEY) ?? 0);
      if (Number.isFinite(savedLock) && savedLock > Date.now()) {
        setLockedUntil(savedLock);
      } else if (savedLock > 0) {
        sessionStorage.removeItem(KAIHATSU_LOCKED_UNTIL_KEY);
        sessionStorage.removeItem(KAIHATSU_ATTEMPTS_KEY);
        setAttempts(0);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= lockedUntil) {
        setLockedUntil(null);
        try {
          sessionStorage.removeItem(KAIHATSU_LOCKED_UNTIL_KEY);
          sessionStorage.removeItem(KAIHATSU_ATTEMPTS_KEY);
        } catch {
          /* ignore */
        }
        setAttempts(0);
        setErrorMessage(null);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const res = await fetch("/api/rankings", { cache: "no-store" });
      if (res.status === 429) {
        setToast({
          message: "一覧の取得がレート制限されています。しばらくしてから再度お試しください。",
          variant: "error",
        });
        setDatasets([]);
        return;
      }
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== "object") {
        setDatasets([]);
        return;
      }
      const o = json as { datasets?: DatasetSummary[] };
      setDatasets(Array.isArray(o.datasets) ? o.datasets : []);
    } catch {
      setDatasets([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) void fetchList();
  }, [unlocked, fetchList]);

  const isLocked = lockedUntil !== null && lockedUntil > now;
  const remainingSec =
    isLocked && lockedUntil !== null
      ? Math.max(0, Math.ceil((lockedUntil - now) / 1000))
      : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (password === CORRECT_PASSWORD) {
      try {
        sessionStorage.removeItem(KAIHATSU_ATTEMPTS_KEY);
        sessionStorage.removeItem(KAIHATSU_LOCKED_UNTIL_KEY);
        sessionStorage.removeItem("kaihatsu_lock_until");
        sessionStorage.setItem(KAIHATSU_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      setLockedUntil(null);
      setAttempts(0);
      setUnlocked(true);
      setErrorMessage(null);
      setPassword("");
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      try {
        sessionStorage.setItem(KAIHATSU_ATTEMPTS_KEY, String(newAttempts));
      } catch {
        /* ignore */
      }
      if (newAttempts >= MAX_ATTEMPTS) {
        const lockUntil = Date.now() + LOCK_DURATION_MS;
        setLockedUntil(lockUntil);
        try {
          sessionStorage.setItem(KAIHATSU_LOCKED_UNTIL_KEY, String(lockUntil));
        } catch {
          /* ignore */
        }
        setErrorMessage("試行回数オーバー。10分後に再試行してください。");
      } else {
        setErrorMessage(`パスワードが違います（${MAX_ATTEMPTS - newAttempts}回まで試行可能）`);
      }
      setPassword("");
    }
  };

  const handleValidate = () => {
    setParseError(null);
    setValidationErrors(null);
    setValidData(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "JSON のパースに失敗しました。");
      return;
    }

    const result = validateDataset(parsed);
    if (!result.ok) {
      setValidationErrors(result.errors);
      return;
    }
    setValidData(result.data);
  };

  const handleSave = async () => {
    if (!validData) return;
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validData),
      });
      const json: unknown = await res.json().catch(() => null);
      if (res.status === 429) {
        setToast({
          message: "保存がレート制限されています。1分後に再度お試しください。",
          variant: "error",
        });
        return;
      }
      if (!res.ok) {
        const errMsg =
          json && typeof json === "object" && "error" in json
            ? String((json as { error: unknown }).error)
            : "unknown";
        setToast({ message: `保存失敗: ${errMsg}`, variant: "error" });
        return;
      }
      setText("");
      setValidData(null);
      setValidationErrors(null);
      setParseError(null);
      setToast({ message: "保存しました", variant: "success" });
      await fetchList();
    } catch {
      setToast({ message: "保存失敗: 通信エラー", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: DatasetSummary) => {
    if (!window.confirm(`「${RANKING_SOURCE_LABELS[row.source]}」${row.date} を削除しますか？`)) return;
    const key = `${row.source}:${row.date}`;
    setDeleting(key);
    setToast(null);
    try {
      const res = await fetch(
        `/api/rankings/${encodeURIComponent(row.source)}/${encodeURIComponent(row.date)}`,
        { method: "DELETE" }
      );
      if (res.status === 429) {
        setToast({
          message: "削除がレート制限されています。1分後に再度お試しください。",
          variant: "error",
        });
        return;
      }
      if (!res.ok) {
        const json: unknown = await res.json().catch(() => null);
        const errMsg =
          json && typeof json === "object" && "error" in json
            ? String((json as { error: unknown }).error)
            : res.statusText;
        setToast({ message: `削除失敗: ${errMsg}`, variant: "error" });
        return;
      }
      setToast({ message: "削除しました", variant: "success" });
      await fetchList();
    } catch {
      setToast({ message: "削除失敗: 通信エラー", variant: "error" });
    } finally {
      setDeleting(null);
    }
  };

  if (!unlocked) {
    return (
      <main className="flex min-h-screen min-w-0 flex-col items-center justify-center bg-slate-950 p-4 text-slate-100 sm:p-8">
        <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl shadow-black/20">
          <h1 className="mb-6 text-center text-2xl font-bold text-amber-400">開発しちゃいよう</h1>
          <form onSubmit={handleSubmit}>
            <label htmlFor="kaihatsu-password" className="mb-2 block text-sm text-slate-400">
              パスワードを入力してください
            </label>
            <input
              id="kaihatsu-password"
              type="password"
              autoComplete="off"
              value={password}
              disabled={isLocked}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrorMessage(null);
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errorMessage && (
              <p className="mt-3 text-sm text-rose-400">{errorMessage}</p>
            )}
            {isLocked && (
              <p className="mt-3 text-sm text-rose-400">
                ロック中：あと {Math.floor(remainingSec / 60)}:{String(remainingSec % 60).padStart(2, "0")}
              </p>
            )}
            <button
              type="submit"
              disabled={isLocked}
              className="mt-6 w-full rounded-full bg-amber-400 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              入室
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 bg-slate-950 p-4 text-slate-100 sm:p-8">
      <KaihatsuToast
        message={toast?.message ?? null}
        variant={toast?.variant ?? "success"}
        onDismiss={dismissToast}
      />

      <div className="mb-6">
        <Link href="/" className="text-sm font-medium text-amber-400/90 hover:text-amber-300">
          ← タイトラボに戻る
        </Link>
      </div>

      <div className="mx-auto max-w-4xl min-w-0 space-y-10">
        <header>
          <h1 className="text-2xl font-bold leading-tight text-amber-400 sm:text-3xl">開発しちゃいよう</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            ランキング JSON を検証し、<strong className="text-slate-300">Upstash Redis</strong> に保存します。
          </p>
        </header>

        {/* セクション1: 投入 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">データ投入</h2>
          <div className="mt-4 space-y-2">
            <label htmlFor="ingest-json" className="block text-sm font-medium text-slate-300">
              JSON
            </label>
            <textarea
              id="ingest-json"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              spellCheck={false}
              disabled={saving}
              className="min-h-96 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/80 p-4 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50"
            />
          </div>

          <button
            type="button"
            onClick={handleValidate}
            disabled={saving}
            className="mt-4 rounded-full bg-slate-700 px-6 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-600 disabled:opacity-50"
          >
            検証する
          </button>

          {parseError && (
            <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              <p className="font-medium">パースエラー</p>
              <p className="mt-1">{parseError}</p>
            </div>
          )}

          {validationErrors && validationErrors.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              <p className="font-medium">検証エラー</p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {validData && (
            <div className="mt-6 space-y-4 border-t border-slate-800 pt-6">
              <p className="text-sm font-semibold text-emerald-400">検証OK — 本番に保存できます</p>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-full bg-amber-400 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition-opacity hover:bg-amber-300 disabled:opacity-50"
              >
                {saving ? "保存中…" : "本番に保存する"}
              </button>
            </div>
          )}

          <p className="mt-6 text-xs text-slate-500">保存後、数秒でサイトに反映されます。</p>
        </section>

        {/* セクション2: 一覧 */}
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">投入済みデータセット</h2>

          {listLoading ? (
            <p className="mt-6 text-sm text-slate-500">読み込み中…</p>
          ) : datasets.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">まだデータがありません。</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-500">
                    <th className="py-3 pr-4 font-medium">ソース</th>
                    <th className="py-3 pr-4 font-medium">日付</th>
                    <th className="py-3 pr-4 font-medium">件数</th>
                    <th className="py-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((row) => {
                    const delKey = `${row.source}:${row.date}`;
                    return (
                      <tr key={delKey} className="border-b border-slate-800/80">
                        <td className="py-3 pr-4 text-slate-200">{RANKING_SOURCE_LABELS[row.source]}</td>
                        <td className="py-3 pr-4 tabular-nums text-slate-300">{row.date}</td>
                        <td className="py-3 pr-4 tabular-nums text-slate-400">{row.entriesCount}</td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            disabled={deleting !== null}
                            onClick={() => void handleDelete(row)}
                            className="text-sm text-rose-400 transition-colors hover:text-rose-300 disabled:opacity-50"
                          >
                            {deleting === delKey ? "削除中…" : "削除"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
