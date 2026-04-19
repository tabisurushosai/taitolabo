import { NextResponse } from "next/server";
import { deleteRankingFile, listRankingFileInfos } from "@/lib/data";

export const dynamic = "force-dynamic";

const PASSWORD = process.env.KAIHATSU_PASSWORD ?? "0379";

export async function GET() {
  try {
    return NextResponse.json({ files: listRankingFileInfos() });
  } catch {
    return NextResponse.json({ error: "一覧の取得に失敗しました。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  let body: { password?: string; filename?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON が不正です。" }, { status: 400 });
  }
  if (body.password !== PASSWORD) {
    return NextResponse.json({ error: "パスワードが違います。" }, { status: 401 });
  }
  if (!body.filename || typeof body.filename !== "string") {
    return NextResponse.json({ error: "filename が必要です。" }, { status: 400 });
  }
  const result = deleteRankingFile(body.filename);
  if (!result.ok) {
    const status = result.error.includes("本番環境") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true });
}
