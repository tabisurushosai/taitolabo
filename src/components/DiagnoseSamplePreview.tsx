"use client";

const SAMPLE_TITLE_PARTS: Array<{ text: string; borderClass: string }> = [
  { text: "婚約破棄された", borderClass: "border-amber-400" },
  { text: "公爵令嬢の", borderClass: "border-cyan-400" },
  { text: "逆襲", borderClass: "border-rose-400" },
];

const SIMILAR_DUMMY = [
  { title: "嫌われていると思っていた婚約者は、私が婚約解消に同意した瞬間だけ顔を変えた", common: "9件共通語" },
  { title: "婚約者は本物を見極められなかった", common: "6件共通語" },
  { title: "水に流してなんていませんが？", common: "4件共通語" },
];

const R = 42;
const C = 2 * Math.PI * R;

function CircularMeter({
  label,
  primaryText,
  subText,
  percent,
  strokeClass,
}: {
  label: string;
  primaryText: string;
  subText?: string;
  percent: number;
  strokeClass: string;
}) {
  const p = Math.min(100, Math.max(0, percent));
  const offset = C * (1 - p / 100);

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <div className="relative flex h-[112px] w-[112px] items-center justify-center">
        <svg
          width="112"
          height="112"
          viewBox="0 0 100 100"
          className="absolute inset-0 -rotate-90"
          aria-hidden
        >
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            className="text-slate-800"
          />
          <circle
            cx="50"
            cy="50"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            className={strokeClass}
          />
        </svg>
        <div className="pointer-events-none relative z-10 flex flex-col items-center leading-tight">
          <span className="text-base font-bold tabular-nums text-slate-100 sm:text-lg">{primaryText}</span>
          {subText !== undefined && (
            <span className="mt-0.5 text-[10px] text-slate-500">{subText}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function DiagnoseSamplePreview() {
  return (
    <section className="mx-auto mt-10 max-w-4xl sm:mt-12">
      <h2 className="mb-4 text-sm text-slate-500">結果プレビュー（サンプル）</h2>

      <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 p-8">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 select-none text-6xl font-bold text-amber-400/10 rotate-[-15deg]"
          aria-hidden
        >
          SAMPLE
        </div>

        <div className="relative z-10 space-y-10">
          <p className="text-2xl font-bold leading-relaxed text-slate-100">
            {SAMPLE_TITLE_PARTS.map(({ text, borderClass }, i) => (
              <span
                key={i}
                className={`inline border-b-2 pb-0.5 ${borderClass}`}
              >
                {text}
              </span>
            ))}
          </p>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-4">
            <CircularMeter
              label="なろう適合度"
              primaryText="82/100"
              percent={82}
              strokeClass="text-amber-400"
            />
            <CircularMeter
              label="カクヨム適合度"
              primaryText="34/100"
              percent={34}
              strokeClass="text-cyan-400"
            />
            <CircularMeter
              label="人気ポテンシャル"
              primaryText="B+"
              subText="推定"
              percent={72}
              strokeClass="text-rose-400"
            />
          </div>

          <div className="space-y-4 border-t border-slate-800/80 pt-8">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              類似タイトル（サンプル）
            </p>
            <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
              {SIMILAR_DUMMY.map((row) => (
                <li key={row.title} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="min-w-0 flex-1">{row.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{row.common}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm italic text-slate-500">
        ↑は架空のサンプル表示です。実装完了後、ここにあなたの入力に対する実データ分析が表示されます
      </p>
    </section>
  );
}
