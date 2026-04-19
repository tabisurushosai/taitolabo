"use client";

import { useCallback, useEffect, useState } from "react";
import { RANKING_SOURCE_LABELS, type RankingSource } from "@/lib/types";

type FileRow = {
  filename: string;
  date: string;
  source: RankingSource;
  entryCount: number;
};

type Props = {
  apiPassword: string;
};

export function KaihatsuRankingsList({ apiPassword }: Props) {
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/rankings", { cache: "no-store" });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok || !json || typeof json !== "object") {
        setLoadError("一覧を読み込めませんでした。");
        return;
      }
      const o = json as { files?: FileRow[] };
      setFiles(Array.isArray(o.files) ? o.files : []);
    } catch {
      setLoadError("一覧を読み込めませんでした。");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`「${filename}」を削除しますか？`)) return;
    setActionError(null);
    setDeleting(filename);
    try {
      const res = await fetch("/api/rankings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, password: apiPassword }),
      });
      const json: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const msg =
          json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "削除に失敗しました。";
        setActionError(msg);
        return;
      }
      await load();
    } catch {
      setActionError("通信に失敗しました。");
    } finally {
      setDeleting(null);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
        {loadError}
      </div>
    );
  }

  if (files === null) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-500">
        読み込み中…
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-8 text-center text-sm text-slate-400">
        data/rankings に JSON がありません。「JSONを検証」タブで追加するか、ローカルでファイルを置いてください。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {actionError}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/40">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">日付</th>
              <th className="min-w-0 px-2 py-3 font-medium">ファイル</th>
              <th className="hidden px-2 py-3 font-medium md:table-cell">ソース</th>
              <th className="px-2 py-3 font-medium">件数</th>
              <th className="w-24 px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {files.map((row) => (
              <tr key={row.filename} className="border-b border-slate-800/80 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-100">{row.date}</td>
                <td className="max-w-[10rem] break-all px-2 py-3 font-mono text-xs text-slate-400 md:max-w-xs">
                  {row.filename}
                </td>
                <td className="hidden max-w-[12rem] truncate px-2 py-3 text-slate-400 md:table-cell">
                  {RANKING_SOURCE_LABELS[row.source]}
                </td>
                <td className="whitespace-nowrap px-2 py-3 tabular-nums text-slate-400">{row.entryCount}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={deleting !== null}
                    onClick={() => void handleDelete(row.filename)}
                    className="rounded-full border border-red-900/50 bg-red-950/30 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:border-red-700/60 hover:bg-red-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting === row.filename ? "削除中…" : "削除"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-slate-500">
        本番（Vercel）では削除がブロックされる場合があります。そのときはリポジトリの{" "}
        <code className="rounded bg-slate-800 px-1">data/rankings/</code> からファイルを消して push してください。
      </p>
    </div>
  );
}
