import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import type { DiagnoseVerdict } from "@/lib/types";

const MODEL = "claude-haiku-4-5-20251001";

const VERDICT_JA: Record<DiagnoseVerdict, string> = {
  blue_ocean: "ブルーオーシャン",
  balanced: "バランス",
  red_leaning: "レッドオーシャン寄り",
  full_red: "完全レッドオーシャン",
};

function isDiagnoseVerdict(s: string): s is DiagnoseVerdict {
  return s in VERDICT_JA;
}

type CommentRequestBody = {
  title?: string;
  verdict?: string;
  score?: number;
  matchedTokens?: Array<{ token: string }>;
  suggestedTitleTokens?: Array<{ token: string }>;
  similarTitles?: Array<{ title: string }>;
};

const client =
  typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

export async function POST(req: NextRequest) {
  if (!client || !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { comment: null as string | null, reason: "api_key_not_set" as const },
      { status: 200 }
    );
  }

  try {
    const body = (await req.json()) as CommentRequestBody;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const verdictRaw = typeof body.verdict === "string" ? body.verdict : "";
    const score = typeof body.score === "number" ? body.score : 0;
    const matchedTokens = Array.isArray(body.matchedTokens) ? body.matchedTokens : [];
    const suggestedTitleTokens = Array.isArray(body.suggestedTitleTokens) ? body.suggestedTitleTokens : [];
    const similarTitles = Array.isArray(body.similarTitles) ? body.similarTitles : [];

    const verdictLabel = isDiagnoseVerdict(verdictRaw) ? VERDICT_JA[verdictRaw] : verdictRaw || "不明";

    const matchedStr =
      matchedTokens.length > 0
        ? matchedTokens
            .map((m) => (m && typeof m.token === "string" ? m.token : ""))
            .filter(Boolean)
            .join(", ")
        : "なし";
    const suggestStr =
      suggestedTitleTokens.length > 0
        ? suggestedTitleTokens
            .slice(0, 5)
            .map((s) => (s && typeof s.token === "string" ? s.token : ""))
            .filter(Boolean)
            .join(", ")
        : "なし";
    const similarStr =
      similarTitles.length > 0
        ? similarTitles
            .slice(0, 2)
            .map((s) => (s && typeof s.title === "string" ? s.title : ""))
            .filter(Boolean)
            .join(" / ")
        : "なし";

    const prompt = `あなたはなろう・カクヨムのランキング事情に詳しいアドバイザーです。
以下のタイトル案について、ランキングデータに基づいた診断結果を踏まえて、100文字前後の率直な寸評を日本語で1つ書いてください。

ユーザーのタイトル案: ${title}
マッチ率スコア: ${score}/100 (判定: ${verdictLabel})
含まれている頻出語: ${matchedStr}
足すと効きそうな語: ${suggestStr}
類似タイトル例: ${similarStr}

注意：
- 褒めるだけでも貶すだけでもなく、データに基づいた具体的な示唆を1点
- 煽りすぎず、丁寧すぎず、雑談っぽく
- 100文字前後、1段落、絵文字なし`;

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });

    const comment = resp.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json(
      { comment: comment || null, reason: null as string | null },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { comment: null as string | null, reason: "error" as const },
      { status: 200 }
    );
  }
}
