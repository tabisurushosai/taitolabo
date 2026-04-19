import { NextRequest, NextResponse } from "next/server";
import { loadAllDatasets, loadDatasetsBySource } from "@/lib/data";
import {
  calculateCorrelationScore,
  findSimilarEntries,
  suggestAdjacentTokens,
  detectKnownTokensInInput,
} from "@/lib/analyzer";
import { RANKING_SOURCE_LABELS, type RankingSource } from "@/lib/types";

export const dynamic = "force-dynamic";

function isRankingSource(s: string): s is RankingSource {
  return Object.prototype.hasOwnProperty.call(RANKING_SOURCE_LABELS, s);
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
    const b = body as Record<string, unknown>;
    const titleRaw = typeof b.title === "string" ? b.title : "";
    const title = titleRaw.trim();

    let source: RankingSource | undefined;
    if (b.source === null || b.source === undefined || b.source === "") {
      source = undefined;
    } else if (typeof b.source === "string" && isRankingSource(b.source)) {
      source = b.source;
    } else {
      return NextResponse.json({ error: "invalid source" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (title.length > 200) return NextResponse.json({ error: "title too long" }, { status: 400 });

    const datasets = source ? await loadDatasetsBySource(source) : await loadAllDatasets();
    const entries = datasets.flatMap((d) => d.entries);
    if (entries.length === 0) {
      return NextResponse.json(
        { error: "ランキングデータがありません", code: "no_ranking_data" as const },
        { status: 503 }
      );
    }

    const corr = calculateCorrelationScore(title, entries);
    const detected = detectKnownTokensInInput(title, entries);
    const similar = findSimilarEntries(title, entries, 5);
    const suggestTitle = suggestAdjacentTokens(title, entries, "titleTokens", 8);
    const suggestTags = suggestAdjacentTokens(title, entries, "tags", 8);

    let verdict: "blue_ocean" | "balanced" | "red_leaning" | "full_red";
    if (corr.score < 30) verdict = "blue_ocean";
    else if (corr.score < 60) verdict = "balanced";
    else if (corr.score < 85) verdict = "red_leaning";
    else verdict = "full_red";

    return NextResponse.json({
      title,
      source: source ?? "all",
      entriesAnalyzed: entries.length,
      score: corr.score,
      verdict,
      matchedTokens: detected.matched.map((m) => ({
        token: m.token,
        field: m.field,
        frequency: m.frequency,
      })),
      similar: similar.map((s) => ({
        rank: s.entry.rank,
        title: s.entry.title,
        points: s.entry.points,
        genre: s.entry.genre,
        sharedTokens: s.sharedTokens,
      })),
      suggestedTitleTokens: suggestTitle,
      suggestedTags: suggestTags,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
