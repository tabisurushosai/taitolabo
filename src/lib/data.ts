import fs from "fs";
import path from "path";
import { RankingDataset, RankingSource, RankingEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "rankings");

export type RankingFileInfo = {
  filename: string;
  date: string;
  source: RankingSource;
  entryCount: number;
};

/** data/rankings の .json 一覧（日付の新しい順） */
export function listRankingFileInfos(): RankingFileInfo[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const rows: RankingFileInfo[] = [];
  for (const filename of files) {
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf-8");
      const d = JSON.parse(raw) as RankingDataset;
      rows.push({
        filename,
        date: d.date,
        source: d.source,
        entryCount: d.entries.length,
      });
    } catch (e) {
      console.error(`Failed to read ${filename}:`, e);
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function loadAllDatasets(): RankingDataset[] {
  if (!fs.existsSync(DATA_DIR)) return [];
  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  return files
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf-8")) as RankingDataset;
      } catch (e) {
        console.error(`Failed to parse ${f}:`, e);
        return null;
      }
    })
    .filter((d): d is RankingDataset => d !== null);
}

export function loadDatasetsBySource(source: RankingSource): RankingDataset[] {
  return loadAllDatasets().filter((d) => d.source === source);
}

export function loadLatestBySource(source: RankingSource): RankingDataset | null {
  const all = loadDatasetsBySource(source);
  if (all.length === 0) return null;
  return all.sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function getAllEntries(datasets: RankingDataset[]): RankingEntry[] {
  return datasets.flatMap((d) => d.entries);
}

export function getAvailableSources(): RankingSource[] {
  const all = loadAllDatasets();
  return Array.from(new Set(all.map((d) => d.source)));
}

const SAFE_RANKING_JSON = /^[a-zA-Z0-9_.-]+\.json$/;

/**
 * ローカル開発では data/rankings のファイルを削除できる。
 * Vercel 等の本番では FS が読み取り専用のため失敗し、エラーメッセージを返す。
 */
export function deleteRankingFile(
  filename: string
): { ok: true } | { ok: false; error: string } {
  const base = path.basename(filename);
  if (!SAFE_RANKING_JSON.test(base) || base !== filename) {
    return { ok: false, error: "不正なファイル名です。" };
  }
  const full = path.join(DATA_DIR, base);
  if (!fs.existsSync(full)) {
    return { ok: false, error: "ファイルが見つかりません。" };
  }
  try {
    fs.unlinkSync(full);
    return { ok: true };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "EROFS" || err.code === "EPERM" || err.code === "EACCES") {
      return {
        ok: false,
        error:
          "本番環境ではサーバー上のファイルを削除できません。GitHub で data/rankings/ から該当の JSON を削除して push してください。",
      };
    }
    return {
      ok: false,
      error: err.message ? `削除に失敗しました: ${err.message}` : "削除に失敗しました。",
    };
  }
}
