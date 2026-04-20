import { NextRequest, NextResponse } from "next/server";
import { loadAllDatasets, saveDataset } from "@/lib/data";
import { getClientIp, readLimiter, writeLimiter } from "@/lib/ratelimit";
import { validateDataset } from "@/lib/validator";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success } = await writeLimiter.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const body: unknown = await req.json();
    const result = validateDataset(body);
    if (!result.ok) {
      return NextResponse.json(
        { error: "validation_failed", details: result.errors },
        { status: 400 }
      );
    }
    const savedAt = await saveDataset(result.data);
    return NextResponse.json({
      ok: true,
      source: result.data.source,
      date: result.data.date,
      entriesCount: result.data.entries.length,
      savedAt,
    });
  } catch (e) {
    console.error("POST /api/rankings error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const { success } = await readLimiter.limit(ip);
  if (!success) {
    return NextResponse.json(
      { error: "rate_limit_exceeded" },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    const datasets = await loadAllDatasets();
    const summary = datasets.map((d) => ({
      source: d.source,
      date: d.date,
      entriesCount: d.entries.length,
      savedAt: d.savedAt,
    }));
    summary.sort((a, b) => b.date.localeCompare(a.date) || a.source.localeCompare(b.source));
    return NextResponse.json({ datasets: summary });
  } catch (e) {
    console.error("GET /api/rankings error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
