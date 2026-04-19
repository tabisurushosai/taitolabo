import Link from "next/link";

export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-slate-500">
        <p className="mb-4">
          <Link
            href="/kaihatsu"
            className="font-medium text-slate-400 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-amber-400/90"
          >
            ランキング JSON の検証・取り込み（データ取り込み）
          </Link>
        </p>
        <p>
          © 2026 タイトラボ / 本サービスは株式会社ヒナプロジェクトおよびKADOKAWA様が提供するものではありません
        </p>
        <p className="mt-2">
          『小説家になろう』は株式会社ヒナプロジェクトの登録商標です
        </p>
      </div>
    </footer>
  );
}
