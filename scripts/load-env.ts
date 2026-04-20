/**
 * `tsx scripts/...` 実行時は Next の env 注入がないため、先に dotenv を読む。
 * CI（GitHub Actions 等）では secrets 由来の process.env を壊さないよう、
 * ファイルからの読み込みは行わない（dotenv の override が空値で上書きする事故を防ぐ）。
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

if (process.env.CI !== "true") {
  const envPath = resolve(process.cwd(), ".env");
  const envLocalPath = resolve(process.cwd(), ".env.local");

  if (existsSync(envPath)) {
    config({ path: envPath });
  }
  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath, override: true });
  }
}
