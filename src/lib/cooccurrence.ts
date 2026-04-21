import type { RankingEntry } from "./types";
import { isDisplayableToken } from "./tokenFilter";

export type CooccurrenceTokenField = "titleTokens" | "synopsisTokens" | "tags";

export type CooccurrenceNode = {
  id: string;
  count: number;
};

export type CooccurrenceEdge = {
  source: string;
  target: string;
  weight: number;
};

export type CooccurrenceGraph = {
  nodes: CooccurrenceNode[];
  edges: CooccurrenceEdge[];
};

const MIN_COEDGE_WEIGHT = 2;

function getFieldTokens(entry: RankingEntry, field: CooccurrenceTokenField): string[] {
  const raw = entry[field];
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && isDisplayableToken(t));
}

/** 同一 entry 内でユニーク化した表示可能トークン（順序は安定化のためソート） */
function uniqueTokensForEntry(entry: RankingEntry, field: CooccurrenceTokenField): string[] {
  const seen = new Set<string>();
  for (const t of getFieldTokens(entry, field)) {
    seen.add(t);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "ja"));
}

/** 無向ペアの (source, target)。source < target（文字列比較・日本語ロケール） */
function orderedPair(a: string, b: string): { source: string; target: string } {
  const cmp = a.localeCompare(b, "ja");
  if (cmp < 0) return { source: a, target: b };
  if (cmp > 0) return { source: b, target: a };
  return { source: a, target: b };
}

function edgeKey(source: string, target: string): string {
  return `${source}\0${target}`;
}

/**
 * 共起グラフを構築する。
 * ノードはコーパス全体の出現回数上位 topN のみ。エッジは同一作品内の共起で、重み 2 未満は捨てる。
 */
export function computeCooccurrence(
  entries: RankingEntry[],
  tokenField: CooccurrenceTokenField,
  topN: number = 50
): CooccurrenceGraph {
  const tokenCounts = new Map<string, number>();
  /** 同数のときノード順を安定化するため、初出の entry インデックス（小さいほど先） */
  const firstSeen = new Map<string, number>();

  for (let ei = 0; ei < entries.length; ei += 1) {
    const entry = entries[ei];
    const uniq = uniqueTokensForEntry(entry, tokenField);
    for (const t of uniq) {
      tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
      if (!firstSeen.has(t)) firstSeen.set(t, ei);
    }
  }

  const sortedIds = [...tokenCounts.keys()].sort((a, b) => {
    const ca = tokenCounts.get(a) ?? 0;
    const cb = tokenCounts.get(b) ?? 0;
    if (cb !== ca) return cb - ca;
    const fa = firstSeen.get(a) ?? 0;
    const fb = firstSeen.get(b) ?? 0;
    if (fa !== fb) return fa - fb;
    return a.localeCompare(b, "ja");
  });

  const topIds = new Set(sortedIds.slice(0, Math.max(0, topN)));

  const nodes: CooccurrenceNode[] = sortedIds.slice(0, Math.max(0, topN)).map((id) => ({
    id,
    count: tokenCounts.get(id) ?? 0,
  }));

  const pairWeights = new Map<string, number>();

  for (const entry of entries) {
    const tokens = uniqueTokensForEntry(entry, tokenField).filter((t) => topIds.has(t));
    const k = tokens.length;
    for (let i = 0; i < k; i += 1) {
      for (let j = i + 1; j < k; j += 1) {
        const { source, target } = orderedPair(tokens[i], tokens[j]);
        const key = edgeKey(source, target);
        pairWeights.set(key, (pairWeights.get(key) ?? 0) + 1);
      }
    }
  }

  const edges: CooccurrenceEdge[] = [];
  for (const [key, weight] of pairWeights) {
    if (weight < MIN_COEDGE_WEIGHT) continue;
    const sep = key.indexOf("\0");
    const source = key.slice(0, sep);
    const target = key.slice(sep + 1);
    edges.push({ source, target, weight });
  }

  edges.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    const cs = a.source.localeCompare(b.source, "ja");
    if (cs !== 0) return cs;
    return a.target.localeCompare(b.target, "ja");
  });

  return { nodes, edges };
}

/**
 * 共起回数が閾値未満のエッジを除き、エッジのないノードも除く。
 */
export function filterGraphByThreshold(
  graph: CooccurrenceGraph,
  minEdgeWeight: number
): CooccurrenceGraph {
  const edges = graph.edges.filter((e) => e.weight >= minEdgeWeight);
  const nodeIds = new Set<string>();
  for (const e of edges) {
    nodeIds.add(e.source);
    nodeIds.add(e.target);
  }
  const nodes = graph.nodes.filter((n) => nodeIds.has(n.id));
  return { nodes, edges };
}

/**
 * 出現数上位 maxNodes のノードに絞り、それらの間のエッジのみ残す。
 */
export function limitNodeCount(graph: CooccurrenceGraph, maxNodes: number): CooccurrenceGraph {
  const cap = Math.max(0, maxNodes);
  const sortedNodes = [...graph.nodes].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.id.localeCompare(b.id, "ja");
  });
  const keep = new Set(sortedNodes.slice(0, cap).map((n) => n.id));
  const nodes = sortedNodes.slice(0, cap);
  const edges = graph.edges.filter((e) => keep.has(e.source) && keep.has(e.target));
  const used = new Set<string>();
  for (const e of edges) {
    used.add(e.source);
    used.add(e.target);
  }
  const prunedNodes = nodes.filter((n) => used.has(n.id));
  return { nodes: prunedNodes, edges };
}
