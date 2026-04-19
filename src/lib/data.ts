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

export async function saveDataset(dataset: RankingDataset): Promise<void> {
  const key = datasetKey(dataset.source, dataset.date);
  await getRedis().set(key, dataset);
  await getRedis().sadd(INDEX_KEY, key);
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
