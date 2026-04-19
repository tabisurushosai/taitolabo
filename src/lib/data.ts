import fs from "fs";
import path from "path";
import { RankingDataset, RankingSource, RankingEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "rankings");

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
