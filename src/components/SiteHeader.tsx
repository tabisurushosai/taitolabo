"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "タイトラボ" },
  { href: "/diagnose", label: "自分で診断" },
  { href: "/admin/ingest", label: "データ追加" },
] as const;

function linkClass(active: boolean) {
  return `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
    active
      ? "bg-amber-400/15 text-amber-300 ring-1 ring-amber-500/40"
      : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200"
  }`;
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-amber-400 transition-colors hover:text-amber-300"
        >
          タイトラボ
        </Link>
        <nav className="flex flex-wrap gap-1.5 sm:gap-2" aria-label="メイン">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link key={item.href} href={item.href} className={linkClass(active)}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
