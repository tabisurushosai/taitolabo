import { NextRequest, NextResponse } from "next/server";
import { deleteDataset } from "@/lib/data";
import { getClientIp, writeLimiter } from "@/lib/ratelimit";
import type { RankingSource } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_SOURCES: RankingSource[] = [
  "narou_daily_total",
  "narou_weekly_total",
  "kakuyomu_daily_total",
  "kakuyomu_weekly_total",
];

export async function DELETE(
  req: NextRequest,
  { params }: { params: { source: string; date: string } }
) {
  const ip = getClientIp(req.headers);
  const { success } = await writeLimiter.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const source = params.source as RankingSource;
    if (!VALID_SOURCES.includes(source)) {
      return NextResponse.json({ error: "invalid_source" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.date)) {
      return NextResponse.json({ error: "invalid_date" }, { status: 400 });
    }
    await deleteDataset(source, params.date);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/rankings error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
