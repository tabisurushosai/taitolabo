"use client";

import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center px-4 py-2 sm:px-6 sm:py-0">
        <Link
          href="/"
          className="shrink-0 text-lg font-bold text-amber-400 transition-all duration-200 hover:text-amber-300 sm:text-xl hover:[text-shadow:0_0_18px_rgba(251,191,36,0.55)]"
        >
          タイトラボ
        </Link>
      </div>
    </header>
  );
}
