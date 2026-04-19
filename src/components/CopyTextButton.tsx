"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  text: string;
  children: React.ReactNode;
  className?: string;
  /** フォールバック textarea の行数 */
  fallbackRows?: number;
};

export function CopyTextButton({ text, children, className, fallbackRows = 8 }: Props) {
  const [toast, setToast] = useState(false);
  const [fallbackOpen, setFallbackOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const copy = useCallback(async () => {
    setFallbackOpen(false);
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setToast(true);
        return;
      }
      throw new Error("no clipboard");
    } catch {
      setFallbackOpen(true);
      queueMicrotask(() => {
        const el = taRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      });
    }
  }, [text]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(false), 2000);
    return () => window.clearTimeout(t);
  }, [toast]);

  return (
    <div className="relative">
      <button type="button" onClick={copy} className={className}>
        {children}
      </button>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-500/40 bg-slate-900/95 px-4 py-2 text-sm font-medium text-amber-200 shadow-lg shadow-black/40"
        >
          コピーしました
        </div>
      )}

      {fallbackOpen && (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-amber-200/90">
            クリップボードに直接コピーできませんでした。下を選択してコピーしてください。
          </p>
          <textarea
            ref={taRef}
            readOnly
            value={text}
            rows={fallbackRows}
            className="w-full resize-y rounded-lg border border-slate-600 bg-slate-950/90 p-3 font-mono text-xs leading-relaxed text-slate-200"
          />
        </div>
      )}
    </div>
  );
}
