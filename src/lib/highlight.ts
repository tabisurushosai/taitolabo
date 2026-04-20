import { createElement, Fragment, type ReactNode } from "react";

/** 正規表現で解釈される文字をエスケープ */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const MARK_CLASS = "rounded-sm bg-amber-400/30 px-0.5";

/**
 * タイトル内で tokens に含まれる部分をモーダルと同じ見た目のマークで強調する。
 * 大文字小文字は区別しない。長い語を先にマッチ（重なり・部分一致の誤整形を抑える）。
 */
export function highlightTokens(text: string, tokens: readonly string[]): ReactNode[] {
  const unique = [...new Set(tokens.map((t) => t.trim()).filter((t) => t.length > 0))];
  unique.sort((a, b) => b.length - a.length);
  if (unique.length === 0 || text.length === 0) {
    return [text];
  }

  try {
    const pattern = new RegExp(unique.map((t) => escapeRegExp(t)).join("|"), "gi");
    const out: ReactNode[] = [];
    let lastIndex = 0;
    let mi = 0;
    let m: RegExpExecArray | null;
    const copy = new RegExp(pattern.source, pattern.flags);
    while ((m = copy.exec(text)) !== null) {
      const match = m[0];
      if (match.length === 0) {
        if (copy.lastIndex === m.index) copy.lastIndex++;
        continue;
      }
      if (m.index > lastIndex) {
        out.push(text.slice(lastIndex, m.index));
      }
      out.push(
        createElement(
          "mark",
          { key: `hl-${mi++}`, className: MARK_CLASS },
          match
        )
      );
      lastIndex = m.index + match.length;
    }
    if (lastIndex < text.length) {
      out.push(text.slice(lastIndex));
    }
    return out.length > 0 ? out : [text];
  } catch {
    return [text];
  }
}

/** 単一語ハイライト（モーダル用）。複数ノードを Fragment で包む */
export function highlightSingleToken(text: string, token: string): ReactNode {
  const nodes = highlightTokens(text, [token]);
  if (nodes.length === 1) return nodes[0] as ReactNode;
  return createElement(Fragment, null, ...nodes);
}
