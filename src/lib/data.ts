import { getRedis } from "./redis";
import type { RankingDataset, RankingEntry, RankingSource } from "./types";

const INDEX_KEY = "rankings:index";

const datasetKey = (source: RankingSource, date: string) => `ranking:${source}:${date}`;

/** SET に格納するメンバーは Redis の dataset キー文字列そのもの（パース不要） */
export async function listDatasetKeys(): Promise<string[]> {
  const keys = await getRedis().smembers(INDEX_KEY);
  if (!Array.isArray(keys)) return [];
  return keys as string[];
}

/** Redis のデータセットキー（例: ranking:narou_daily_total:2026-04-19）から1件取得 */
export async function getDataset(redisKey: string): Promise<RankingDataset | null> {
  try {
    const r = await getRedis().get<RankingDataset>(redisKey);
    if (r == null || typeof r !== "object" || !Array.isArray((r as RankingDataset).entries)) {
      return null;
    }
    return r as RankingDataset;
  } catch {
    return null;
  }
}

export async function loadAllDatasets(): Promise<RankingDataset[]> {
  const keys = await listDatasetKeys();
  if (keys.length === 0) return [];
  const results = await getRedis().mget<RankingDataset[]>(...keys);
  if (results == null) return [];
  const arr = Array.isArray(results) ? results : [results];
  return arr.filter((d): d is RankingDataset => d != null && typeof d === "object" && Array.isArray((d as RankingDataset).entries));
}

export async function loadDatasetsBySource(source: RankingSource): Promise<RankingDataset[]> {
  const all = await loadAllDatasets();
  return all.filter((d) => d.source === source);
}

export async function loadLatestBySource(source: RankingSource): Promise<RankingDataset | null> {
  const list = await loadDatasetsBySource(source);
  if (list.length === 0) return null;
  return list.sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** 保存した日時（ISO 8601 UTC）を返す */
export async function saveDataset(dataset: RankingDataset): Promise<string> {
  const key = datasetKey(dataset.source, dataset.date);
  const savedAt = new Date().toISOString();
  const payload: RankingDataset = {
    source: dataset.source,
    date: dataset.date,
    entries: dataset.entries,
    savedAt,
  };
  await getRedis().set(key, payload);
  await getRedis().sadd(INDEX_KEY, key);
  return savedAt;
}

export async function deleteDataset(source: RankingSource, date: string): Promise<void> {
  const key = datasetKey(source, date);
  const indexEntry = key;
  await getRedis().del(key);
  await getRedis().srem(INDEX_KEY, indexEntry);
}

export async function getAllEntries(): Promise<RankingEntry[]> {
  const datasets = await loadAllDatasets();
  return datasets.flatMap((d) => d.entries);
}

export async function getAvailableSources(): Promise<RankingSource[]> {
  const all = await loadAllDatasets();
  return Array.from(new Set(all.map((d) => d.source)));
}
