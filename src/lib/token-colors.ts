import type { TokenField } from "@/lib/analyzer";

/**
 * トークンクラウド用：最頻出を基準に不透明度だけを変える（常時アニメーションは使わない）。
 * opacity = 0.35 + 0.65 * (count / maxCount)
 */
export function opacityForTokenCloud(count: number, maxCount: number): number {
  if (maxCount <= 0) return 1;
  const r = Math.max(0, Math.min(1, count / maxCount));
  return 0.35 + 0.65 * r;
}

/** クラウド上のベース色（頻度は opacityForTokenCloud 側で表現） */
export function hslBaseForTokenCloud(field: TokenField): string {
  if (field === "titleTokens") return "hsl(38, 82%, 58%)";
  if (field === "synopsisTokens") return "hsl(188, 78%, 56%)";
  return "hsl(350, 78%, 60%)";
}

/** フィールドと頻度で HSL を生成（頻度が高いほど濃く鮮やかに） */
export function hslForTokenField(
  field: TokenField,
  count: number,
  minC: number,
  maxC: number
): string {
  const t = maxC === minC ? 0.5 : Math.max(0, Math.min(1, (count - minC) / (maxC - minC)));
  if (field === "titleTokens") {
    const s = 55 + t * 40;
    const l = 62 - t * 18;
    return `hsl(38, ${s}%, ${l}%)`;
  }
  if (field === "synopsisTokens") {
    const s = 50 + t * 45;
    const l = 58 - t * 16;
    return `hsl(188, ${s}%, ${l}%)`;
  }
  const s = 52 + t * 42;
  const l = 58 - t * 17;
  return `hsl(350, ${s}%, ${l}%)`;
}
