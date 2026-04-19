import type { Metadata } from "next";
import { loadAllDatasets } from "@/lib/data";
import { DiagnosePageClient } from "./DiagnosePageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "タイトル診断 | タイトラボ",
  description: "タイトル案をランキングデータと照らして診断します。",
};

export default async function DiagnosePage() {
  const datasets = await loadAllDatasets();
  const all = datasets.flatMap((d) => d.entries);
  const hasRankingData = all.length > 0;

  return <DiagnosePageClient hasRankingData={hasRankingData} />;
}
