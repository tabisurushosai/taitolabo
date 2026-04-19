import { Spinner } from "@/components/Spinner";

export default function Loading() {
  return (
    <div
      className="flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-24"
      role="status"
      aria-live="polite"
      aria-busy
    >
      <Spinner className="h-10 w-10" />
      <p className="text-sm text-slate-400">タイトラボを準備中...</p>
    </div>
  );
}
