"use client";

import type {
  DiagnoseResponse,
  DiagnoseTokenField,
  DiagnoseVerdict,
  RankingSource,
} from "@/lib/types";
import { RANKING_SOURCE_LABELS } from "@/lib/types";

type Span = {
  start: number;
  end: number;
  token: string;
  frequency: number;
};

function aggregateMaxFrequency(
  matched: DiagnoseResponse["matchedTokens"]
): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of matched) {
    m.set(x.token, Math.max(m.get(x.token) ?? 0, x.frequency));
  }
  return m;
}

/** 長いトークン優先・左から貪欲に非重複スパンを選ぶ */
function selectNonOverlappingSpans(title: string, freqMap: Map<string, number>): Span[] {
  const candidates: Span[] = [];
  for (const [token, frequency] of Array.from(freqMap.entries())) {
    if (token.length === 0) continue;
    let pos = 0;
    while (pos <= title.length - token.length) {
      const idx = title.indexOf(token, pos);
      if (idx === -1) break;
      candidates.push({
        start: idx,
        end: idx + token.length,
        token,
        frequency,
      });
      pos = idx + 1;
    }
  }
  candidates.sort((a, b) => {
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (lb !== la) return lb - la;
    return a.start - b.start;
  });

  const used = new Array<boolean>(title.length).fill(false);
  const selected: Span[] = [];
  for (const c of candidates) {
    let ok = true;
    for (let i = c.start; i < c.end; i++) {
      if (used[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (let i = c.start; i < c.end; i++) used[i] = true;
    selected.push(c);
  }
  selected.sort((a, b) => a.start - b.start);
  return selected;
}

function freqToAmberBorderClass(freq: number, minF: number, maxF: number): string {
  if (maxF === minF) return "border-amber-400";
  const t = (freq - minF) / (maxF - minF);
  if (t < 0.25) return "border-amber-300";
  if (t < 0.5) return "border-amber-400";
  if (t < 0.75) return "border-amber-500";
  return "border-amber-600";
}

function TitleDissection({
  title,
  matchedTokens,
}: {
  title: string;
  matchedTokens: DiagnoseResponse["matchedTokens"];
}) {
  const freqMap = aggregateMaxFrequency(matchedTokens);
  const spans = selectNonOverlappingSpans(title, freqMap);
  const freqs = spans.map((s) => s.frequency);
  const minF = freqs.length ? Math.min(...freqs) : 0;
  const maxF = freqs.length ? Math.max(...freqs) : 0;

  const idxSpan: (Span | null)[] = new Array(title.length).fill(null);
  for (const s of spans) {
    for (let i = s.start; i < s.end; i++) idxSpan[i] = s;
  }

  const segments: Array<{ text: string; span: Span | null }> = [];
  let i = 0;
  while (i < title.length) {
    const s = idxSpan[i];
    let j = i;
    while (j < title.length && idxSpan[j] === s) j++;
    segments.push({ text: title.slice(i, j), span: s });
    i = j;
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-6 sm:px-8 sm:py-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">入力タイトルの語マッチ</p>
      <p className="break-words text-2xl font-semibold leading-relaxed tracking-wide text-slate-100 sm:text-3xl md:text-4xl">
        {segments.map((seg, idx) => {
          if (!seg.span) {
            return (
              <span key={`plain-${idx}`} className="text-slate-300">
                {seg.text.split("").map((ch, ci) => (
                  <span key={`${idx}-p-${ci}`} className="inline-block">
                    {ch}
                  </span>
                ))}
              </span>
            );
          }
          const borderClass = freqToAmberBorderClass(seg.span.frequency, minF, maxF);
          const tip = `${seg.span.token}: ${seg.span.frequency}件で出現`;
          return (
            <span
              key={`hit-${idx}-${seg.span.start}`}
              title={tip}
              className={`inline-block cursor-default border-b-2 ${borderClass} text-amber-100`}
            >
              {seg.text.split("").map((ch, ci) => (
                <span key={`${idx}-h-${ci}`} className="inline-block">
                  {ch}
                </span>
              ))}
            </span>
          );
        })}
      </p>
      {matchedTokens.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">マッチしたランキングトークンはありません。</p>
      )}
    </div>
  );
}

const VERDICT_RING: Record<
  DiagnoseVerdict,
  { stroke: string; labelClass: string }
> = {
  blue_ocean: { stroke: "stroke-blue-400", labelClass: "text-blue-300" },
  balanced: { stroke: "stroke-green-400", labelClass: "text-green-300" },
  red_leaning: { stroke: "stroke-orange-400", labelClass: "text-orange-300" },
  full_red: { stroke: "stroke-red-400", labelClass: "text-red-300" },
};

function ScoreRingMeter({ score, verdict }: { score: number; verdict: DiagnoseVerdict }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const pct = Math.min(100, Math.max(0, score));
  const dash = (C * pct) / 100;
  const ring = VERDICT_RING[verdict];

  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg
        className="h-full w-full -rotate-90"
        viewBox="0 0 100 100"
        role="img"
        aria-label={`マッチ率スコア ${score} / 100`}
      >
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          className="stroke-slate-800"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          className={ring.stroke}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold tabular-nums text-slate-100">
          {score}
          <span className="text-lg font-semibold text-slate-500">/100</span>
        </span>
      </div>
    </div>
  );
}

/** 類似タイトル内で sharedTokens をハイライト（長い語を優先して非重複） */
function highlightSimilarTitle(text: string, sharedTokens: string[]): Array<{ text: string; hit: boolean }> {
  const tokens = Array.from(new Set(sharedTokens.filter(Boolean))).sort((a, b) => b.length - a.length);
  const candidates: Span[] = [];
  for (const token of tokens) {
    let pos = 0;
    while (pos <= text.length - token.length) {
      const idx = text.indexOf(token, pos);
      if (idx === -1) break;
      candidates.push({ start: idx, end: idx + token.length, token, frequency: 0 });
      pos = idx + 1;
    }
  }
  candidates.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const used = new Array<boolean>(text.length).fill(false);
  const selected: Span[] = [];
  for (const c of candidates) {
    let ok = true;
    for (let i = c.start; i < c.end; i++) {
      if (used[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (let i = c.start; i < c.end; i++) used[i] = true;
    selected.push(c);
  }
  selected.sort((a, b) => a.start - b.start);

  const idxHit: boolean[] = new Array(text.length).fill(false);
  for (const s of selected) {
    for (let i = s.start; i < s.end; i++) idxHit[i] = true;
  }

  const parts: Array<{ text: string; hit: boolean }> = [];
  let i = 0;
  while (i < text.length) {
    const hit = idxHit[i];
    let j = i;
    while (j < text.length && idxHit[j] === hit) j++;
    parts.push({ text: text.slice(i, j), hit });
    i = j;
  }
  return parts;
}

function SimilarTitleRow({ item }: { item: DiagnoseResponse["similar"][number] }) {
  const parts = highlightSimilarTitle(item.title, item.sharedTokens);

  return (
    <li className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
      <div className="text-sm leading-relaxed text-slate-100">
        <span className="text-slate-500">#{item.rank}</span>{" "}
        {parts.map((p, i) =>
          p.hit ? (
            <mark key={i} className="rounded-sm bg-amber-500/25 px-0.5 text-amber-100">
              {p.text}
            </mark>
          ) : (
            <span key={i}>{p.text}</span>
          )
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        <span className="text-slate-400">{item.genre}</span>
        {item.points !== undefined && (
          <span className="tabular-nums text-slate-500">pt/★ {item.points}</span>
        )}
      </div>
    </li>
  );
}

const FIELD_LABELS: Record<DiagnoseTokenField, string> = {
  titleTokens: "タイトル",
  synopsisTokens: "あらすじ",
  tags: "タグ",
};

type Props = {
  result: DiagnoseResponse;
  verdictLabel: string;
  verdictHint: string;
};

export function DiagnoseResultPanel({ result, verdictLabel, verdictHint }: Props) {
  const verdictStyle = VERDICT_RING[result.verdict];

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <TitleDissection title={result.title} matchedTokens={result.matchedTokens} />

      <p className="text-center text-xs text-slate-500 sm:text-left">
        分析対象: <span className="tabular-nums text-slate-400">{result.entriesAnalyzed}</span> 件
        {result.source !== "all" && (
          <>
            {" "}
            （{RANKING_SOURCE_LABELS[result.source as RankingSource]}）
          </>
        )}
      </p>

      <div className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:flex-row sm:items-center sm:gap-10 sm:p-8">
        <ScoreRingMeter score={result.score} verdict={result.verdict} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className={`text-sm font-semibold ${verdictStyle.labelClass}`}>{verdictLabel}</p>
          <p className="text-sm leading-relaxed text-slate-300">{verdictHint}</p>
          <p className="text-xs text-slate-600">マッチ率はコーパス内の出現頻度から算出した指標です。</p>
        </div>
      </div>

      {result.matchedTokens.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-400">マッチ詳細（フィールド別）</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {result.matchedTokens.map((m) => (
              <li key={`${m.token}-${m.field}`}>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/25 bg-amber-500/5 px-2.5 py-1 text-xs text-amber-100/90">
                  {m.token}
                  <span className="text-slate-500">{FIELD_LABELS[m.field]}</span>
                  <span className="tabular-nums text-slate-500">×{m.frequency}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-300">類似タイトル（共通語ハイライト）</h2>
        <ol className="mt-3 space-y-3">
          {result.similar.map((s, i) => (
            <SimilarTitleRow key={`${s.rank}-${i}`} item={s} />
          ))}
        </ol>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">推奨トークン</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-medium text-slate-500">タイトルに足すと効きそうな語</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {result.suggestedTitleTokens.length === 0 ? (
                <li className="text-sm text-slate-600">なし</li>
              ) : (
                result.suggestedTitleTokens.map((r) => (
                  <li key={r.token}>
                    <span className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200">
                      {r.token}
                      <span className="tabular-nums text-slate-500">{r.count}</span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <p className="text-xs font-medium text-slate-500">タグに足すと効きそうな語（投稿設定用）</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {result.suggestedTags.length === 0 ? (
                <li className="text-sm text-slate-600">なし</li>
              ) : (
                result.suggestedTags.map((r) => (
                  <li key={r.token}>
                    <span className="inline-flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-200">
                      {r.token}
                      <span className="tabular-nums text-slate-500">{r.count}</span>
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
