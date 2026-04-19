import type { Metadata } from "next";
import { loadAllDatasets, getAllEntries } from "@/lib/data";
import { DiagnosePageClient } from "./DiagnosePageClient";

export const metadata: Metadata = {
  title: "タイトル診断 | タイトラボ",
  description: "タイトル案をランキングデータと照らして診断します。",
};

export default function DiagnosePage() {
  const datasets = loadAllDatasets();
  const all = getAllEntries(datasets);
  const hasRankingData = all.length > 0;

  return <DiagnosePageClient hasRankingData={hasRankingData} />;
}
