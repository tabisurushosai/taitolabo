/**
 * `tsx scripts/...` 実行時は Next の env 注入がないため、先に dotenv を読む。
 * `import "dotenv/config"` で `.env` を読み、`.env.local` で上書き（ローカル優先）。
 */
import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local"), override: true });
