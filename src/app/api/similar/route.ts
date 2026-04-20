import { NextRequest, NextResponse } from "next/server";
import { loadCorpusAndIdf } from "@/lib/corpus";
import { isDisplayableToken } from "@/lib/tokenFilter";
import { isAllowedSimilaritySearchGenre } from "@/lib/similaritySearchGenres";
import { calculateSimilarity, computeIdf } from "@/lib/similarity";
import { tokenize } from "@/lib/serverTokenizer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITLE_MAX = 100;
const CACHE_TTL_MS = 60_000;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 30;

type ErrorCode = "INVALID_INPUT" | "RATE_LIMIT" | "INTERNAL_ERROR";

function jsonError(status: number, message: string, code: ErrorCode) {
  return NextResponse.json({ error: message, code }, { status });
}

/** 制御文字除去・連続空白圧縮・trim */
function sanitizeSimilarTitleInput(raw: string): string {
  const noCtrl = raw.replace(/[\x00-\x1F\x7F]/g, "");
  return noCtrl.replace(/\s+/g, " ").trim();
}

type CacheEntry = { data: Record<string, unknown>; expiresAt: number };
const responseCache = new Map<string, CacheEntry>();

type RateEntry = { count: number; windowStart: number };
const rateByIp = new Map<string, RateEntry>();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first && first.length > 0) return first;
  }
  return "0.0.0.0";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let entry = rateByIp.get(ip);
  if (!entry || now - entry.windowStart >= RATE_WINDOW_MS) {
    entry = { count: 0, windowStart: now };
    rateByIp.set(ip, entry);
  }
  if (entry.count >= RATE_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    if (!checkRateLimit(ip)) {
      return jsonError(
        429,
        "短時間にリクエストが多すぎます。しばらくしてからお試しください。",
        "RATE_LIMIT"
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "JSON の形式が正しくありません。", "INVALID_INPUT");
    }

    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      return jsonError(400, "リクエスト本文が不正です。", "INVALID_INPUT");
    }

    const rawTitle = (body as Record<string, unknown>).title;
    if (typeof rawTitle !== "string") {
      return jsonError(400, "タイトルを文字列で指定してください。", "INVALID_INPUT");
    }

    let title = sanitizeSimilarTitleInput(rawTitle);
    if (title.length === 0) {
      return jsonError(400, "タイトルを入力してください。", "INVALID_INPUT");
    }
    if (title.length > TITLE_MAX) {
      title = title.slice(0, TITLE_MAX);
    }

    const rawGenre = (body as Record<string, unknown>).genre;
    let genreFilter: string | null = null;
    if (rawGenre !== undefined && rawGenre !== null) {
      if (typeof rawGenre !== "string") {
        return jsonError(400, "genre は文字列で指定してください。", "INVALID_INPUT");
      }
      const g = rawGenre.trim();
      if (g !== "" && g.toLowerCase() !== "all") {
        if (!isAllowedSimilaritySearchGenre(g)) {
          return jsonError(400, "指定されたジャンルは利用できません。", "INVALID_INPUT");
        }
        genreFilter = g;
      }
    }

    const cacheKey = `${title}\t${genreFilter ?? "all"}`;
    const cached = responseCache.get(cacheKey);
    if (cached !== undefined && cached.expiresAt > Date.now()) {
      return NextResponse.json(cached.data);
    }
    if (cached !== undefined) {
      responseCache.delete(cacheKey);
    }

    let rawTokens: string[];
    try {
      rawTokens = await tokenize(title);
    } catch (e) {
      console.error("[api/similar] tokenize failed (kuromoji dict path / cold start?)", e);
      return jsonError(500, "内部でエラーが発生しました。時間をおいて再度お試しください。", "INTERNAL_ERROR");
    }
    const tokens = rawTokens.filter(isDisplayableToken);

    let corpus: Awaited<ReturnType<typeof loadCorpusAndIdf>>["corpus"];
    try {
      const loaded = await loadCorpusAndIdf();
      corpus = loaded.corpus;
    } catch (e) {
      console.error("[api/similar] loadCorpusAndIdf failed", e);
      return jsonError(500, "内部でエラーが発生しました。時間をおいて再度お試しください。", "INTERNAL_ERROR");
    }

    const corpusFiltered =
      genreFilter === null ? corpus : corpus.filter((e) => e.genre === genreFilter);
    const idfForSearch = computeIdf(corpusFiltered);
    const results = calculateSimilarity(tokens, corpusFiltered, idfForSearch, 10);

    const payload = {
      tokens,
      results,
      corpusSize: corpusFiltered.length,
    };

    responseCache.set(cacheKey, {
      data: payload as Record<string, unknown>,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json(payload);
  } catch {
    return jsonError(500, "内部でエラーが発生しました。時間をおいて再度お試しください。", "INTERNAL_ERROR");
  }
}
