import type { Metadata } from "next";
import { DiagnosePageClient } from "./DiagnosePageClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "タイトル診断 | タイトラボ",
  description: "タイトル案をランキングデータと照らして診断します。",
};

export default function DiagnosePage() {
  return <DiagnosePageClient />;
}
