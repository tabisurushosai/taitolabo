import "./load-env";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { rankingDatasetKey, saveDataset } from "../src/lib/data";
import { getRedis } from "../src/lib/redis";
import { validateDataset } from "../src/lib/validator";
import type { RankingDataset, RankingEntry, RankingSource } from "../src/lib/types";
import { fetchNarouRanking } from "./lib/narou-api";
import { initTokenizer, tokenizeSync } from "./lib/tokenizer";

const argv = process.argv.slice(2);
const PUSH = argv.includes("--push");
const SKIP_IF_EXISTS = argv.includes("--skip-if-exists");

const FAILURE_THRESHOLD = 3;

function hasRedisCredentials(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

const RANKINGS = {
  daily: { order: "dailypoint", pointsField: "daily_point" },
  weekly: { order: "weeklypoint", pointsField: "weekly_point" },
  monthly: { order: "monthlypoint", pointsField: "monthly_point" },
} as const;

const GENRES = {
  total: { code: null as number | null, label: "総合" },
  g101: { code: 101, label: "異世界〔恋愛〕" },
  g102: { code: 102, label: "現実世界〔恋愛〕" },
  g201: { code: 201, label: "ハイファンタジー〔ファンタジー〕" },
  g202: { code: 202, label: "ローファンタジー〔ファンタジー〕" },
} as const;

const GENRE_CODE_TO_JA: Record<number, string> = {
  101: "異世界〔恋愛〕",
  102: "現実世界〔恋愛〕",
  201: "ハイファンタジー〔ファンタジー〕",
  202: "ローファンタジー〔ファンタジー〕",
  301: "純文学〔文芸〕",
  302: "ヒューマンドラマ〔文芸〕",
  303: "歴史〔文芸〕",
  304: "推理〔文芸〕",
  305: "ホラー〔文芸〕",
  306: "アクション〔文芸〕",
  307: "コメディー〔文芸〕",
  401: "VRゲーム〔SF〕",
  402: "宇宙〔SF〕",
  403: "空想科学〔SF〕",
  404: "パニック〔SF〕",
  9901: "童話〔その他〕",
  9902: "詩〔その他〕",
  9903: "エッセイ〔その他〕",
  9904: "リプレイ〔その他〕",
  9999: "その他〔その他〕",
  9801: "ノンジャンル〔ノンジャンル〕",
};

function genreToLabel(code: unknown): string {
  if (typeof code !== "number" || !Number.isFinite(code)) {
    return String(code ?? "");
  }
  return GENRE_CODE_TO_JA[code] ?? String(code);
}

/** API 文字列に混じる HTML エンティティを簡易デコード（外部依存なし）。&amp; は最後。 */
function decodeHtmlEntitiesMinimal(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function synopsisHeadFromStory(story: string): string {
  const normalized = story.replace(/\r?\n/g, " ");
  if (normalized.length <= 180) return normalized;
  return `${normalized.slice(0, 180)}…`;
}

function keywordToTags(keyword: unknown): string[] {
  if (keyword == null) return [];
  const s = String(keyword).trim();
  if (!s) return [];
  return s.split(/[\s　]+/).filter(Boolean);
}

function getPoints(row: Record<string, unknown>, field: string): number {
  const v = row[field];
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 0;
}

/** タイトル文字数（半角・全角スペース除外。記号・絵文字は含む） */
function titleLengthFromTitle(title: string): number {
  return [...title.replace(/[\s　]/g, "")].length;
}

function getNovelType(row: Record<string, unknown>): number {
  const v = row.noveltype ?? row.novel_type;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return 1;
}

function rowToEntry(row: Record<string, unknown>, rank: number, pointsField: string): RankingEntry {
  const title = decodeHtmlEntitiesMinimal(String(row.title ?? ""));
  const story = decodeHtmlEntitiesMinimal(String(row.story ?? ""));
  const genreCode = row.genre;
  const genre =
    typeof genreCode === "number"
      ? genreToLabel(genreCode)
      : genreToLabel(Number(genreCode));

  const novelType = getNovelType(row);
  const lengthVal = row.length;
  const charCount =
    typeof lengthVal === "number"
      ? lengthVal
      : typeof lengthVal === "string"
        ? Number(lengthVal) || 0
        : 0;

  const titleLength = titleLengthFromTitle(title);

  const head = synopsisHeadFromStory(story);
  const ncodeRaw = row.ncode;
  const ncode =
    typeof ncodeRaw === "string" && ncodeRaw.trim() !== ""
      ? ncodeRaw.trim().toLowerCase()
      : undefined;

  return {
    rank,
    title,
    genre,
    tags: keywordToTags(row.keyword),
    ...(ncode !== undefined ? { ncode } : {}),
    synopsisHead: head,
    titleTokens: [],
    synopsisTokens: [],
    points: getPoints(row, pointsField),
    isShort: novelType === 2,
    charCount,
    titleLength,
  };
}

type Combo = {
  source: RankingSource;
  rankingKey: keyof typeof RANKINGS;
  genreKey: keyof typeof GENRES;
};

function buildCombos(): Combo[] {
  const out: Combo[] = [];
  for (const rankingKey of Object.keys(RANKINGS) as (keyof typeof RANKINGS)[]) {
    for (const genreKey of Object.keys(GENRES) as (keyof typeof GENRES)[]) {
      const source = `narou_${rankingKey}_${genreKey}` as RankingSource;
      out.push({ source, rankingKey, genreKey });
    }
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function startedAtLine(): string {
  const d = new Date();
  const utc = d.toISOString().slice(0, 19).replace("T", " ");
  const jst = d.toLocaleString("sv-SE", { timeZone: "Asia/Tokyo" }).replace("T", " ");
  return `Started at: ${utc} UTC (${jst} JST)`;
}

function modeLine(push: boolean, skipIfExists: boolean): string {
  if (!push) return "Mode: fetch only";
  if (skipIfExists) return "Mode: fetch + push (skip-if-exists: on)";
  return "Mode: fetch + push (skip-if-exists: off)";
}

/** 既に当日キーがあれば true。Redis が読めなければ false（取得へ進む）。 */
async function redisDatasetExistsToday(source: RankingSource, date: string): Promise<boolean> {
  try {
    const key = rankingDatasetKey(source, date);
    const v = await getRedis().get(key);
    return v != null;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const runStarted = performance.now();

  if (PUSH && !hasRedisCredentials()) {
    console.error("❌ Redis credentials not found.\n   Set KV_REST_API_URL and KV_REST_API_TOKEN in .env or environment.");
    process.exit(1);
  }

  if (SKIP_IF_EXISTS && !PUSH) {
    console.warn("⚠ --skip-if-exists は --push と併用したときのみ有効です（無視します）。\n");
  }

  const effectiveSkipIfExists = PUSH && SKIP_IF_EXISTS && hasRedisCredentials();

  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const outDir = path.join(process.cwd(), "scripts", "output", "narou");
  await mkdir(outDir, { recursive: true });

  console.log("");
  console.log("================================");
  console.log("Taitolabo Narou Fetch");
  console.log(startedAtLine());
  console.log(`Node version: ${process.version}`);
  console.log(modeLine(PUSH, effectiveSkipIfExists));
  console.log("================================");
  console.log("");

  const tokenizer = await initTokenizer();
  const combos = buildCombos();
  const total = combos.length;

  let succeeded = 0;
  let skipped = 0;
  const failures: Array<{ label: string; reason: string }> = [];
  const apiLatenciesMs: number[] = [];

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    const idx = i + 1;
    const label = `${combo.source}`;

    if (effectiveSkipIfExists) {
      const exists = await redisDatasetExistsToday(combo.source, date);
      if (exists) {
        skipped++;
        console.log(
          `[${String(idx).padStart(2)}/${total}] ${label.padEnd(22)} ... skipped (already exists today)`
        );
        if (i < combos.length - 1) await sleep(1500);
        continue;
      }
    }

    const t0 = performance.now();
    try {
      const rankCfg = RANKINGS[combo.rankingKey];
      const genreCfg = GENRES[combo.genreKey];
      const params: Record<string, string> = { order: rankCfg.order };
      if (genreCfg.code != null) {
        params.genre = String(genreCfg.code);
      }

      const tApi0 = performance.now();
      const raw = await fetchNarouRanking(params);
      const apiMs = performance.now() - tApi0;
      apiLatenciesMs.push(apiMs);

      const rows = raw.slice(1) as Record<string, unknown>[];

      const entries: RankingEntry[] = rows.map((row, j) => {
        const base = rowToEntry(row, j + 1, rankCfg.pointsField);
        const title = base.title;
        const head = base.synopsisHead;
        return {
          ...base,
          titleTokens: tokenizeSync(tokenizer, title),
          synopsisTokens: tokenizeSync(tokenizer, head),
        };
      });

      const dataset: RankingDataset = {
        source: combo.source,
        date,
        entries,
      };

      const v = validateDataset(dataset);
      if (!v.ok) {
        throw new Error(`validateDataset: ${v.errors.join("; ")}`);
      }

      const filePath = path.join(outDir, `${combo.source}.json`);
      await writeFile(filePath, `${JSON.stringify(dataset, null, 2)}\n`, "utf8");

      const totalSec = ((performance.now() - t0) / 1000).toFixed(1);

      let tail: string;
      if (PUSH) {
        try {
          await saveDataset(dataset);
          tail = `ok (${entries.length} entries) → saved (${totalSec}s)`;
        } catch (re) {
          const rmsg = re instanceof Error ? re.message : String(re);
          failures.push({ label, reason: `Redis save: ${rmsg}` });
          tail = `FAILED — Redis save (${rmsg})`;
        }
      } else {
        tail = `ok (${entries.length} entries) (${totalSec}s)`;
      }

      console.log(`[${String(idx).padStart(2)}/${total}] ${label.padEnd(22)} ... ${tail}`);
      if (!tail.startsWith("FAILED")) succeeded++;
      else {
        // already in failures
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push({ label, reason: msg });
      console.log(`[${String(idx).padStart(2)}/${total}] ${label.padEnd(22)} ... FAILED (${msg})`);
    }

    if (i < combos.length - 1) {
      await sleep(1500);
    }
  }

  const totalDurationSec = ((performance.now() - runStarted) / 1000).toFixed(1);
  const avgApiLatencySec =
    apiLatenciesMs.length === 0
      ? "n/a"
      : (apiLatenciesMs.reduce((a, b) => a + b, 0) / apiLatenciesMs.length / 1000).toFixed(1);

  const failedCount = failures.length;

  console.log("");
  console.log("================================");
  console.log("Summary");
  console.log("================================");
  console.log(`Total sources: ${total}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Total duration: ${totalDurationSec}s`);
  console.log(`Average API latency: ${avgApiLatencySec}${avgApiLatencySec === "n/a" ? "" : "s"}`);
  console.log("================================");
  console.log("");

  if (failedCount > 0) {
    console.log("Failed sources:");
    for (const f of failures) {
      console.log(`  - ${f.label}: ${f.reason}`);
    }
    console.log("");
  }

  if (failedCount >= FAILURE_THRESHOLD) {
    console.error(`✗ ${failedCount} or more sources failed. Exit 1.`);
    process.exit(1);
  }

  if (failedCount > 0) {
    console.warn(`⚠ ${failedCount} sources failed but below threshold (${FAILURE_THRESHOLD}). Exit 0.`);
  }

  if (!PUSH) {
    console.log("次の手順:");
    console.log("  1. scripts/output/narou/*.json の中身を1つずつコピー");
    console.log("  2. https://taitolabo.vercel.app/kaihatsu の「データ投入」に貼り付け");
    console.log("  3. 「検証する」→ 投入");
    console.log("");
    console.log("  Redis に直接投入する場合: npm run fetch-narou:push（要 KV_REST_API_URL / KV_REST_API_TOKEN）");
    console.log("");
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
