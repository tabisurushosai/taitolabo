import Link from "next/link";

export function EmptyLabInvitationCard() {
  return (
    <section className="mx-auto max-w-2xl px-6 pb-12 pt-2">
      <div className="rounded-2xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 to-transparent p-8 text-center sm:text-left">
        <div className="mb-5 text-5xl" aria-hidden>
          🔬
        </div>
        <h2 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
          ラボはまだ空っぽです
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-400 sm:text-base">
          なろうまたはカクヨムのランキングPDFを用意して、Claudeプロジェクトで JSON
          化してから投入してください
        </p>
        <p className="mt-6">
          <Link
            href="/kaihatsu"
            className="inline-flex rounded-full bg-amber-400/15 px-5 py-2.5 text-sm font-semibold text-amber-300 ring-1 ring-amber-500/40 transition-colors hover:bg-amber-400/25"
          >
            データ取り込みページを開く（検証・一覧）
          </Link>
        </p>
      </div>
    </section>
  );
}
