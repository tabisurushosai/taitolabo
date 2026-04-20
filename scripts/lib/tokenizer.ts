import path from "path";
import kuromoji from "kuromoji";

type KuromojiToken = {
  surface_form: string;
  basic_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
};

export type NarouTokenizer = {
  tokenize: (text: string) => KuromojiToken[];
};

let tokenizerPromise: Promise<NarouTokenizer> | null = null;

export function initTokenizer(): Promise<NarouTokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      const dicPath = path.join(process.cwd(), "node_modules/kuromoji/dict");
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer as NarouTokenizer);
      });
    });
  }
  return tokenizerPromise;
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
 * 名詞・動詞・形容詞からトークン抽出。重複は保持。空文字は除去。
 */
export function tokenizeSync(tokenizer: NarouTokenizer, text: string): string[] {
  const raw = text.replace(/\r?\n/g, " ").trim();
  if (!raw) return [];

  const out: string[] = [];
  const tokens = tokenizer.tokenize(raw) as KuromojiToken[];

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

/** 単体利用向け（毎回 tokenizer を解決） */
export async function tokenize(text: string): Promise<string[]> {
  const tz = await initTokenizer();
  return tokenizeSync(tz, text);
}
