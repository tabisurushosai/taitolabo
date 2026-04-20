export function SiteFooter() {
  return (
    <footer>
      <div className="mx-auto max-w-6xl px-6 py-8 text-center text-xs text-slate-500">
        <p>
          © 2026 タイトラボ / 本サービスは株式会社ヒナプロジェクト様が提供するものではありません
        </p>
        <p className="mt-2">
          『小説家になろう』は株式会社ヒナプロジェクトの登録商標です
        </p>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed">
          本サイトは「小説家になろう」の作品情報を、なろう小説API（
          <a
            href="https://dev.syosetu.com/"
            className="text-slate-400 underline decoration-slate-600 underline-offset-2 hover:text-amber-400/90"
            target="_blank"
            rel="noopener noreferrer"
          >
            https://dev.syosetu.com/
          </a>
          ）経由で取得しています。各作品の著作権は作者に帰属します。
        </p>

        <div className="mx-auto mt-8 max-w-2xl border-t border-slate-800/80 pt-8">
          <p className="text-slate-400">このサイトは「旅する書斎」が作成しました。</p>
          <ul className="mt-3 flex flex-col items-center gap-2 text-slate-400 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-6 sm:gap-y-2">
            <li>
              <a
                href="https://portfolio-tabisurushosai.vercel.app/"
                className="inline-flex items-center gap-1 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-amber-400/90"
                target="_blank"
                rel="noopener noreferrer"
              >
                ポートフォリオ
              </a>
            </li>
            <li>
              <a
                href="https://kakuyomu.jp/works/2912051596038348923"
                className="inline-flex items-center gap-1 underline decoration-slate-600 underline-offset-2 transition-colors hover:text-amber-400/90"
                target="_blank"
                rel="noopener noreferrer"
              >
                代表作（カクヨム）
              </a>
            </li>
          </ul>
          <p className="mt-4 text-slate-500">感想・要望あれば気軽にどうぞ。</p>
        </div>
      </div>
    </footer>
  );
}
