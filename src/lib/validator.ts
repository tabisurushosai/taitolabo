import { type RankingDataset, type RankingSource } from "./types";

const VALID_SOURCES: RankingSource[] = [
  "narou_daily_total",
  "narou_daily_isekai_ren",
  "narou_daily_humandrama",
  "kakuyomu_weekly_total",
  "kakuyomu_weekly_romcom",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRankingSource(s: string): s is RankingSource {
  return (VALID_SOURCES as readonly string[]).includes(s);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !Number.isNaN(v);
}

export function validateDataset(raw: unknown): { ok: true; data: RankingDataset } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("ルートはオブジェクトである必要があります。");
    return { ok: false, errors };
  }

  const o = raw as Record<string, unknown>;

  if (!("source" in o)) errors.push("source が必須です。");
  else if (!isString(o.source) || !isRankingSource(o.source)) {
    errors.push(`source は次のいずれかである必要があります: ${VALID_SOURCES.join(", ")}`);
  }

  if (!("date" in o)) errors.push("date が必須です。");
  else if (!isString(o.date) || !DATE_RE.test(o.date)) {
    errors.push("date は YYYY-MM-DD 形式の文字列である必要があります。");
  }

  if (!("entries" in o)) errors.push("entries が必須です。");
  else if (!Array.isArray(o.entries)) errors.push("entries は配列である必要があります。");

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const entries = o.entries as unknown[];

  entries.forEach((row, i) => {
    const p = `entries[${i}]`;
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      errors.push(`${p} はオブジェクトである必要があります。`);
      return;
    }
    const e = row as Record<string, unknown>;

    const need = (key: string, check: (v: unknown) => boolean, msg: string) => {
      if (!(key in e)) errors.push(`${p}.${key} が必須です。`);
      else if (!check(e[key])) errors.push(`${p}.${key}: ${msg}`);
    };

    need("rank", isNumber, "number である必要があります。");
    need("title", isString, "string である必要があります。");
    need("titleTokens", isStringArray, "string[] である必要があります。");
    need("genre", isString, "string である必要があります。");
    need("tags", isStringArray, "string[] である必要があります。");
    need("synopsisHead", isString, "string である必要があります。");
    need("synopsisTokens", isStringArray, "string[] である必要があります。");

    if (e.points !== undefined && !isNumber(e.points)) {
      errors.push(`${p}.points: number である必要があります。`);
    }
    if (e.isShort !== undefined && typeof e.isShort !== "boolean") {
      errors.push(`${p}.isShort: boolean である必要があります。`);
    }
    if (e.charCount !== undefined && !isNumber(e.charCount)) {
      errors.push(`${p}.charCount: number である必要があります。`);
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: raw as RankingDataset };
}
