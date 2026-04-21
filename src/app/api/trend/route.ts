import { NextRequest, NextResponse } from "next/server";
import { computeTrend, type TrendEntry } from "@/lib/trendAnalysis";
import { jsonApiError } from "@/lib/httpApiError";
import { checkInMemoryIpRateLimit, type IpRateBucket } from "@/lib/inMemoryIpRateLimit";
import { getClientIp } from "@/lib/ratelimit";
import { isTrendWeeklySource, loadTrendCorpus } from "@/lib/trendCorpus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SOURCE = "narou_weekly_total";
const CACHE_TTL_MS = 5 * 60 * 1000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

const INSUFFICIENT_MESSAGE =
  "比較に必要なデータが不足しています（最低2週間分のデータが必要）";

type CorpusSize = { current: number; previous: number };

type TrendApiOk = {
  status: "ok";
  rising: TrendEntry[];
  falling: TrendEntry[];
  currentDate: string;
  previousDate: string;
  corpusSize: CorpusSize;
};

type TrendApiInsufficient = {
  status: "insufficient_data";
  rising: [];
  falling: [];
  currentDate: string;
  previousDate: string;
  corpusSize: CorpusSize;
  message: string;
};

type CacheEntry = { body: TrendApiOk | TrendApiInsufficient; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();
const trendRateByIp = new Map<string, IpRateBucket>();

function parseSource(searchParams: URLSearchParams): { ok: true; value: string } | { ok: false } {
  const raw = searchParams.get("source");
  const normalized = raw === null || raw.trim() === "" ? DEFAULT_SOURCE : raw.trim();
  if (!isTrendWeeklySource(normalized)) {
    return { ok: false };
  }
  return { ok: true, value: normalized };
}

function hasTwoWeekCorpus(
  current: { entries: unknown[] } | null,
  previous: { entries: unknown[] } | null
): boolean {
  return (
    current !== null &&
    previous !== null &&
    current.entries.length > 0 &&
    previous.entries.length > 0
  );
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    if (!checkInMemoryIpRateLimit(trendRateByIp, ip, RATE_MAX, RATE_WINDOW_MS)) {
      return jsonApiError(
        429,
        "短時間にリクエストが多すぎます。しばらくしてからお試しください。",
        "RATE_LIMIT"
      );
    }

    const parsed = parseSource(req.nextUrl.searchParams);
    if (!parsed.ok) {
      return jsonApiError(
        400,
        "source は週間ランキング（総合・ジャンル週間）のいずれかを指定してください。",
        "INVALID_INPUT"
      );
    }
    const source = parsed.value;

    const cached = responseCache.get(source);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.body);
    }
    if (cached !== undefined) {
      responseCache.delete(source);
    }

    const { current, previous } = await loadTrendCorpus(source);

    const corpusSize: CorpusSize = {
      current: current?.entries.length ?? 0,
      previous: previous?.entries.length ?? 0,
    };

    const currentDate = current?.date ?? "";
    const previousDate = previous?.date ?? "";

    let body: TrendApiOk | TrendApiInsufficient;

    if (!hasTwoWeekCorpus(current, previous)) {
      body = {
        status: "insufficient_data",
        rising: [],
        falling: [],
        currentDate,
        previousDate,
        corpusSize,
        message: INSUFFICIENT_MESSAGE,
      };
    } else {
      const { rising, falling } = computeTrend(current!.entries, previous!.entries);
      body = {
        status: "ok",
        rising,
        falling,
        currentDate,
        previousDate,
        corpusSize,
      };
    }

    responseCache.set(source, {
      body,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(body);
  } catch (e) {
    console.error("GET /api/trend error:", e);
    return jsonApiError(
      500,
      "内部でエラーが発生しました。時間をおいて再度お試しください。",
      "INTERNAL_ERROR"
    );
  }
}
