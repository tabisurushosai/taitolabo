/** 診断結果パネルに近いレイアウトのプレースホルダー */
export function DiagnoseLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse space-y-10" aria-hidden>
      <div className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-8 sm:px-8">
        <div className="mb-3 h-3 w-32 rounded bg-slate-700" />
        <div className="space-y-2">
          <div className="h-8 w-full max-w-md rounded bg-slate-800" />
          <div className="h-8 w-4/5 max-w-lg rounded bg-slate-800/80" />
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:flex-row sm:items-center sm:gap-10 sm:p-8">
        <div className="mx-auto h-40 w-40 shrink-0 rounded-full bg-slate-800 sm:mx-0" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-4 w-40 rounded bg-slate-700" />
          <div className="h-3 w-full rounded bg-slate-800" />
          <div className="h-3 w-11/12 rounded bg-slate-800/80" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="h-4 w-48 rounded bg-slate-700" />
        <div className="h-24 rounded-xl border border-slate-800 bg-slate-950/40" />
      </div>
    </div>
  );
}
