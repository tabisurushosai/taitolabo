export const metadata = {
  title: "タイトラボ｜改装中",
  description: "タイトラボは現在メンテナンス中です。",
};

export default function MaintenancePage() {
  return (
    <main className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-3xl font-bold tracking-tight text-amber-400 sm:text-4xl">
          タイトラボ
        </h1>

        <p className="mt-6 text-lg font-semibold text-zinc-200">
          ただいま改装中です
        </p>

        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          データ基盤の調整のため、一時的に休止しています。
          <br />
          準備が整い次第、再開します。
        </p>

        <div className="mx-auto mt-10 h-px w-16 bg-amber-400/40" />

        <p className="mt-6 text-xs text-zinc-500">
          © 2026 タイトラボ / 旅する書斎
        </p>
      </div>
    </main>
  );
}
