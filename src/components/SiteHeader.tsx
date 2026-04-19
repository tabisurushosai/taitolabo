"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV: Array<{
  href: string;
  label: string;
  shortLabel?: string;
}> = [
  { href: "/", label: "タイトラボ" },
  { href: "/diagnose", label: "自分で診断" },
  { href: "/kaihatsu", label: "データ取り込み", shortLabel: "データ" },
];

function navLinkClass(active: boolean) {
  return `rounded-full px-3.5 py-2 text-sm font-medium transition-colors duration-200 sm:px-4 ${
    active
      ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-500/25"
      : "text-slate-400 hover:text-amber-300"
  }`;
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6 sm:py-0">
        <Link
          href="/"
          className="shrink-0 text-lg font-bold text-amber-400 transition-all duration-200 hover:text-amber-300 sm:text-xl hover:[text-shadow:0_0_18px_rgba(251,191,36,0.55)]"
        >
          タイトラボ
        </Link>
        <nav
          className="flex shrink flex-wrap items-center justify-end gap-1.5 sm:gap-2"
          aria-label="メイン"
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/kaihatsu"
                  ? pathname === "/kaihatsu" || pathname.startsWith("/kaihatsu/")
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.shortLabel ? item.label : undefined}
                className={navLinkClass(active)}
              >
                {item.shortLabel ? (
                  <>
                    <span className="sm:hidden">{item.shortLabel}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </>
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
