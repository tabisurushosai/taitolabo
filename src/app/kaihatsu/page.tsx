"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useState } from "react";
import { CopyTextButton } from "@/components/CopyTextButton";
import { validateDataset } from "@/lib/validator";
import type { RankingDataset } from "@/lib/types";
import { KaihatsuRankingsList } from "./KaihatsuRankingsList";

const KAIHATSU_SESSION_KEY = "kaihatsu_unlocked";
const KAIHATSU_PASSWORD = "0379";

const PLACEHOLDER = `{
  "source": "narou_daily_total",
  "date": "2026-04-19",
  "entries": [
    {
      "rank": 1,
      "title": "サンプルタイトル",
      "titleTokens": ["サンプル", "タイトル"],
      "author": "作者名",
      "points": 1234,
      "genre": "異世界〔恋愛〕",
      "tags": ["タグ1", "タグ2"],
      "synopsisHead": "あらすじの冒頭テキスト…",
      "synopsisTokens": ["キーワード1", "キーワード2"],
      "isShort": true
    }
  ]
}`;

function countTokensInEntries(
  data: RankingDataset,
  field: "titleTokens" | "synopsisTokens" | "tags"
): number {
  let n = 0;
  for (const e of data.entries) {
    n += e[field].length;
  }
  return n;
}

type TabId = "ingest" | "list";

export default function KaihatsuPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordWrong, setPasswordWrong] = useState(false);
  const [tab, setTab] = useState<TabId>("ingest");

  useLayoutEffect(() => {
    try {
      if (sessionStorage.getItem(KAIHATSU_SESSION_KEY) === "1") {
        setUnlocked(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const [text, setText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[] | null>(null);
  const [validData, setValidData] = useState<RankingDataset | null>(null);

  const prettyJson = useMemo(() => {
    if (!validData) return "";
    return JSON.stringify(validData, null, 2);
  }, [validData]);

  const suggestedFilename = useMemo(() => {
    if (!validData) return "";
    return `${validData.source}_${validData.date}.json`;
  }, [validData]);

  const stats = useMemo(() => {
    if (!validData) return null;
    return {
      entries: validData.entries.length,
      titleTokens: countTokensInEntries(validData, "titleTokens"),
      synopsisTokens: countTokensInEntries(validData, "synopsisTokens"),
      tags: countTokensInEntries(validData, "tags"),
    };
  }, [validData]);

  const sampleTitles = useMemo(() => {
    if (!validData) return [];
    return validData.entries.slice(0, 3).map((e) => e.title);
  }, [validData]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === KAIHATSU_PASSWORD) {
      try {
        sessionStorage.setItem(KAIHATSU_SESSION_KEY, "1");
      } catch {
        /* ignore */
      }
      setUnlocked(true);
      setPasswordWrong(false);
      setPassword("");
    } else {
      setPasswordWrong(true);
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

  if (!unlocked) {
    return (
      <main className="flex min-h-screen min-w-0 flex-col items-center justify-center p-4">
        <form
          onSubmit={handlePasswordSubmit}
          className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/50 p-6 shadow-xl shadow-black/20"
        >
          <label htmlFor="kaihatsu-password" className="block text-center text-sm font-medium text-slate-300">
            パスワードを入力してください
          </label>
          <input
            id="kaihatsu-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordWrong(false);
            }}
            className="mt-4 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-slate-100 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
          {passwordWrong && <p className="mt-3 text-center text-sm text-red-400">パスワードが違います</p>}
          <button
            type="submit"
            className="mt-5 w-full rounded-full bg-amber-400 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-300"
          >
            送信
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen min-w-0 p-4 sm:p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm font-medium text-amber-400/90 hover:text-amber-300">
          ← タイトラボに戻る
        </Link>
      </div>

      <div className="mx-auto max-w-3xl min-w-0 space-y-6">
        <header>
          <h1 className="text-2xl font-bold leading-tight text-amber-400 sm:text-3xl">開発しちゃいよう</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            ランキングデータを投入する内部ツールです。Claude Opus で PDF→JSON 変換したものをここに貼り付けてください。正しい形式か検証後、
            <code className="rounded bg-slate-800 px-1 text-amber-200/90">data/rankings/</code>{" "}
            に保存するファイル内容を出力します。
          </p>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-1">
          <button
            type="button"
            onClick={() => setTab("ingest")}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "ingest"
                ? "border-b-2 border-amber-400 text-amber-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            JSONを検証
          </button>
          <button
            type="button"
            onClick={() => setTab("list")}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === "list"
                ? "border-b-2 border-amber-400 text-amber-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            取り込み一覧・削除
          </button>
        </div>

        {tab === "list" && <KaihatsuRankingsList apiPassword={KAIHATSU_PASSWORD} />}

        {tab === "ingest" && (
          <>
        <div className="space-y-2">
          <label htmlFor="ingest-json" className="block text-sm font-medium text-slate-300">
            JSON
          </label>
          <textarea
            id="ingest-json"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            spellCheck={false}
            className="min-h-96 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/80 p-4 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:border-amber-500/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>

        <button
          type="button"
          onClick={handleValidate}
          className="rounded-full bg-amber-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/20 transition-colors hover:bg-amber-300"
        >
          検証する
        </button>

        {parseError && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            <p className="font-medium">パースエラー</p>
            <p className="mt-1">{parseError}</p>
          </div>
        )}

        {validationErrors && validationErrors.length > 0 && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            <p className="font-medium">検証エラー</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {validationErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validData && stats && (
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
            <p className="text-sm font-semibold text-emerald-400">検証OK</p>

            <div>
              <h2 className="text-sm font-semibold text-slate-300">統計サマリ</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-300">
                <li>
                  <span className="tabular-nums text-amber-400">{stats.entries}</span> エントリ
                </li>
                <li>
                  タイトルトークン合計: <span className="tabular-nums text-slate-200">{stats.titleTokens}</span> 件
                </li>
                <li>
                  あらすじトークン合計: <span className="tabular-nums text-slate-200">{stats.synopsisTokens}</span>{" "}
                  件
                </li>
                <li>
                  タグ合計: <span className="tabular-nums text-slate-200">{stats.tags}</span> 件
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-300">タイトル（先頭3件）</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
                {sampleTitles.map((t, i) => (
                  <li key={`${i}-${t.slice(0, 24)}`}>{t}</li>
                ))}
              </ol>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-300">保存ファイル名の提案</h2>
              <code className="mt-2 flex flex-wrap break-all rounded-lg bg-slate-950 px-3 py-2 text-sm text-amber-200">
                {suggestedFilename}
              </code>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-slate-300">保存用 JSON</h2>
                <CopyTextButton
                  text={prettyJson}
                  fallbackRows={12}
                  className="rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-200 transition-colors hover:border-amber-400/80 hover:bg-amber-500/20"
                >
                  コピー
                </CopyTextButton>
              </div>
              <pre className="mt-3 max-h-96 overflow-auto rounded-xl border border-slate-800 bg-slate-950/80 p-4 font-mono text-xs leading-relaxed text-slate-200">
                {prettyJson}
              </pre>
            </div>

            <p className="text-sm text-slate-400">
              このファイル名で
              <code className="mx-1 rounded bg-slate-800 px-1 text-amber-200/90">data/rankings/</code>
              に保存してください（ローカルでファイルを作成し、内容を貼り付けまたは上書き）。
            </p>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm leading-relaxed text-slate-500">
          <p className="font-medium text-slate-400">本番（Vercel）について</p>
          <p className="mt-2">
            本番環境のファイルシステムは読み取り専用のため、サーバーからこの JSON を
            <code className="mx-1 rounded bg-slate-800 px-1 text-slate-400">data/rankings/</code>
            に直接書き込むことはしません。ローカルでファイルを作成し、
            <code className="mx-1 rounded bg-slate-800 px-1 text-slate-400">git commit</code>
            してからデプロイする運用を想定しています。
          </p>
        </div>
          </>
        )}
      </div>
    </main>
  );
}
