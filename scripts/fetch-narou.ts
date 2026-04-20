import "./load-env";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { saveDataset } from "../src/lib/data";
import { validateDataset } from "../src/lib/validator";
import type { RankingDataset, RankingEntry, RankingSource } from "../src/lib/types";
import { fetchNarouRanking } from "./lib/narou-api";
import { initTokenizer, tokenizeSync } from "./lib/tokenizer";

const argv = process.argv.slice(2);
const PUSH = argv.includes("--push");

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

async function main(): Promise<void> {
  if (PUSH && !hasRedisCredentials()) {
    console.error("❌ Redis credentials not found.\n   Set KV_REST_API_URL and KV_REST_API_TOKEN in .env or environment.");
    process.exit(1);
  }

  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const outDir = path.join(process.cwd(), "scripts", "output", "narou");
  await mkdir(outDir, { recursive: true });

  const tokenizer = await initTokenizer();
  const combos = buildCombos();
  const failures: string[] = [];
  const redisFailures: string[] = [];
  let ok = 0;
  let redisOk = 0;

  console.log("");

  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    const idx = i + 1;
    const label = `${combo.source}`;

    try {
      const rankCfg = RANKINGS[combo.rankingKey];
      const genreCfg = GENRES[combo.genreKey];
      const params: Record<string, string> = { order: rankCfg.order };
      if (genreCfg.code != null) {
        params.genre = String(genreCfg.code);
      }

      const raw = await fetchNarouRanking(params);
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

      let redisSuffix = "";
      if (PUSH) {
        try {
          await saveDataset(dataset);
          redisOk++;
          redisSuffix = " → saved to Redis";
        } catch (re) {
          const rmsg = re instanceof Error ? re.message : String(re);
          redisFailures.push(`${label}: ${rmsg}`);
          redisSuffix = ` → Redis save FAILED (${rmsg})`;
        }
      }

      console.log(
        `[${String(idx).padStart(2)}/${combos.length}] ${label.padEnd(22)} ... ok  (${entries.length} entries)${redisSuffix}`
      );
      ok++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${label}: ${msg}`);
      console.log(`[${String(idx).padStart(2)}/${combos.length}] ${label.padEnd(22)} ... FAILED (${msg})`);
    }

    if (i < combos.length - 1) {
      await sleep(1500);
    }
  }

  console.log("");
  console.log(`✓ ${ok} files written to scripts/output/narou/`);
  if (PUSH) {
    console.log(`✓ ${redisOk} datasets saved to Redis`);
  }
  const skipped = combos.length - ok;
  console.log(`  (skipped: ${skipped})`);
  console.log("");
  if (!PUSH) {
    console.log("  次の手順:");
    console.log("    1. scripts/output/narou/*.json の中身を1つずつコピー");
    console.log("    2. https://taitolabo.vercel.app/kaihatsu の「データ投入」に貼り付け");
    console.log("    3. 「検証する」→ 投入");
    console.log("");
    console.log("  Redis に直接投入する場合: npm run fetch-narou:push（要 KV_REST_API_URL / KV_REST_API_TOKEN）");
    console.log("");
  }

  if (failures.length > 0) {
    console.error("--- 失敗したコンボ ---");
    for (const f of failures) console.error(f);
    process.exitCode = 1;
  } else if (PUSH && redisFailures.length > 0) {
    console.error("--- Redis 保存に失敗したコンボ ---");
    for (const f of redisFailures) console.error(f);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
