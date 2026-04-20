/**
 * Fisher–Yates でシャッフルしたうえで先頭 n 件を返す。
 * n >= arr.length のときはシャッフル後の全件（順序はランダム）。
 */
export function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}
