import { gunzipSync } from "zlib";

const API_BASE = "https://api.syosetu.com/novelapi/api/";
const USER_AGENT = "taitolabo/1.0 (https://taitolabo.vercel.app)";
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

export type NarouApiRow = Record<string, unknown>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * なろう小説APIを叩き、JSON をパースした配列を返す（先頭の allcount 行はそのまま含む）。
 * slice(1) は呼び出し側。
 */
export async function fetchNarouRanking(searchParams: Record<string, string>): Promise<NarouApiRow[]> {
  const url = new URL(API_BASE);
  url.searchParams.set("out", "json");
  url.searchParams.set("lim", "50");
  url.searchParams.set("gzip", "5");
  url.searchParams.set("of", "t-n-s-k-g-nt-gp-dp-wp-mp-l");
  for (const [k, v] of Object.entries(searchParams)) {
    url.searchParams.set(k, v);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Encoding": "gzip",
        },
      });

      if (res.status >= 400 && res.status < 500) {
        throw new Error(`HTTP ${res.status} ${res.statusText} (no retry)`);
      }

      if (res.status >= 500) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }

      const buf = Buffer.from(await res.arrayBuffer());
      const enc = res.headers.get("content-encoding") ?? "";
      const text =
        enc.includes("gzip") || (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b)
          ? gunzipSync(buf).toString("utf8")
          : buf.toString("utf8");
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error("Response JSON is not an array");
      }
      return parsed as NarouApiRow[];
    } catch (e) {
      lastErr = e;
      const msg = String(e instanceof Error ? e.message : e);
      if (msg.includes("no retry")) throw e;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(BACKOFF_MS[attempt] ?? 4000);
      }
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
