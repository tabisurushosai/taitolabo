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
      </div>
    </section>
  );
}
