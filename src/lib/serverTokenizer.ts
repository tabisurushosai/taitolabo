/**
 * Next.js サーバー環境（API Route / Server Actions 等）専用の日本語トークナイザ。
 * クライアントバンドルに含めないこと。
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import kuromoji from "kuromoji";

type KuromojiToken = {
  surface_form: string;
  basic_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
};

/** kuromoji.builder().build() の戻り値 */
type Tokenizer = {
  tokenize: (text: string) => KuromojiToken[];
};

const nodeRequire = createRequire(import.meta.url);

function hasRequiredDictFiles(dictDir: string): boolean {
  return (
    existsSync(path.join(dictDir, "check.dat.gz")) &&
    existsSync(path.join(dictDir, "base.dat.gz"))
  );
}

/**
 * Next.js のバンドルでは require.resolve が (rsc)/ などの仮想パスになり辞書を開けない。
 * まず process.cwd() 配下の node_modules を優先し、無ければ require.resolve にフォールバック。
 */
function resolveDicPath(): string {
  const fromCwd = path.join(process.cwd(), "node_modules", "kuromoji", "dict");
  if (hasRequiredDictFiles(fromCwd)) {
    return fromCwd;
  }
  try {
    const pkgJson = nodeRequire.resolve("kuromoji/package.json");
    const fromResolve = path.join(path.dirname(pkgJson), "dict");
    if (hasRequiredDictFiles(fromResolve)) {
      return fromResolve;
    }
  } catch {
    /* use fromCwd anyway */
  }
  return fromCwd;
}

let builderPromise: Promise<Tokenizer> | null = null;

function getTokenizer(): Promise<Tokenizer> {
  if (!builderPromise) {
    builderPromise = new Promise((resolve, reject) => {
      const dicPath = resolveDicPath();
      if (!hasRequiredDictFiles(dicPath)) {
        reject(
          new Error(
            `kuromoji dict files are missing: ${dicPath} (required: check.dat.gz, base.dat.gz)`
          )
        );
        return;
      }
      kuromoji.builder({ dicPath }).build((err, t) => {
        if (err) reject(err);
        else resolve(t as Tokenizer);
      });
    });
  }
  return builderPromise;
}

const HIRAGANA_BLOCK = /^[\u3040-\u309F]$/;
const NOUN_SUB_EXCLUDE = new Set(["非自立", "代名詞", "数", "接尾"]);

function isLikelyUrlOrNoise(s: string): boolean {
  const t = s.trim();
  if (t.length === 0) return true;
  if (/https?:\/\//i.test(t) || /\bwww\./i.test(t)) return true;
  return false;
}

function majorPos(t: KuromojiToken): { head: string; detail1: string } {
  const raw = t.pos ?? "";
  if (raw.includes(",")) {
    const p = raw.split(",");
    return { head: (p[0] ?? "").trim(), detail1: (p[1] ?? "").trim() };
  }
  return { head: raw.trim(), detail1: (t.pos_detail_1 ?? "").trim() };
}

/**
 * scripts/lib/tokenizer.ts の tokenizeSync と同一ルール:
 * 名詞・動詞・形容詞のみ、非自立/代名詞/数/接尾を除外、
 * 動詞・形容詞は basic_form、名詞は surface_form。
 */
function tokenizeSync(tz: Tokenizer, text: string): string[] {
  const raw = text.replace(/\r?\n/g, " ").trim();
  if (!raw) return [];

  const out: string[] = [];
  const tokens = tz.tokenize(raw) as KuromojiToken[];

  for (const tok of tokens) {
    const surface = tok.surface_form ?? "";
    if (isLikelyUrlOrNoise(surface)) continue;

    const { head, detail1 } = majorPos(tok);

    if (head === "記号" || head === "空白") continue;

    if (HIRAGANA_BLOCK.test(surface)) continue;

    if (head === "名詞") {
      if (NOUN_SUB_EXCLUDE.has(detail1)) continue;
      if (surface.length > 0) out.push(surface);
      continue;
    }

    if (head === "動詞" || head === "形容詞") {
      const w = (tok.basic_form && tok.basic_form !== "*" ? tok.basic_form : surface).trim();
      if (w.length > 0 && !HIRAGANA_BLOCK.test(w)) out.push(w);
    }
  }

  return out.filter((s) => s.length > 0);
}

export async function tokenize(text: string): Promise<string[]> {
  const tz = await getTokenizer();
  return tokenizeSync(tz, text);
}
