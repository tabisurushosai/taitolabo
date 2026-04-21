"use client";

import ForceGraph2D from "react-force-graph-2d";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CooccurrenceGraph } from "@/lib/cooccurrence";

type GraphNode = { id: string; count: number };
type GraphLink = { source: string; target: string; weight: number };

type SimNode = GraphNode & { x?: number; y?: number };

type Props = {
  graph: CooccurrenceGraph;
  graphHeight?: number;
  onNodeTokenClick?: (token: string) => void;
  /** モーダルが閉じたとき、タッチ UI のタップ強調を外すため */
  tokenDetailOpen?: boolean;
};

const LABEL_COLOR = "#ffffff";

const AMBER_DARK = { r: 217, g: 119, b: 6 };
const AMBER_LIGHT = { r: 251, g: 191, b: 36 };

const LINK_RGB = "100, 116, 139";

const MIN_SCREEN_FONT_PX = 11;
const BASE_FONT_WORLD = 14;

const FONT_FAMILY = `ui-sans-serif, "Noto Sans JP", system-ui, sans-serif`;

/** 狭いビューポート or 主入力がタッチ → ホバー強調なし・タップでフォーカス */
function useTouchPrimaryUi(): boolean {
  const [touchPrimary, setTouchPrimary] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px), (pointer: coarse)");
    const sync = () => setTouchPrimary(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return touchPrimary;
}

function nodeFillRgb(count: number, maxCount: number): string {
  const denom = maxCount <= 0 ? 1 : maxCount;
  const t = Math.max(0, Math.min(1, count / denom));
  const r = Math.round(AMBER_DARK.r + (AMBER_LIGHT.r - AMBER_DARK.r) * t);
  const g = Math.round(AMBER_DARK.g + (AMBER_LIGHT.g - AMBER_DARK.g) * t);
  const b = Math.round(AMBER_DARK.b + (AMBER_LIGHT.b - AMBER_DARK.b) * t);
  return `rgb(${r} ${g} ${b})`;
}

function linkEndpointId(end: unknown): string {
  if (typeof end === "string") return end;
  if (end && typeof end === "object" && "id" in end) {
    const id = (end as { id?: unknown }).id;
    if (typeof id === "string") return id;
  }
  return String(end);
}

function buildAdjacency(edges: Array<{ source: string; target: string }>): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const add = (a: string, b: string) => {
    if (!m.has(a)) m.set(a, new Set());
    if (!m.has(b)) m.set(b, new Set());
    m.get(a)!.add(b);
    m.get(b)!.add(a);
  };
  for (const e of edges) {
    add(e.source, e.target);
  }
  return m;
}

function nodeRadiusAndFontSize(
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number
): { r: number; fontSize: number } {
  const label = String(node.id);
  const count = Math.max(1, node.count);
  const baseR = Math.sqrt(count) * 2 + 3;
  const g = Math.max(globalScale, 0.12);
  const fontSize = Math.max(BASE_FONT_WORLD, MIN_SCREEN_FONT_PX) / g;

  ctx.save();
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;
  const halfText = ctx.measureText(label).width / 2;
  ctx.restore();

  const textPadding = fontSize * 0.45;
  const r = Math.max(baseR, halfText + textPadding);
  return { r, fontSize };
}

/** グラフ構造から一度だけ算出（参照は graph に追従） */
function useGraphLayoutStats(graph: CooccurrenceGraph) {
  return useMemo(() => {
    const nodes = graph.nodes;
    const edges = graph.edges;
    let maxNodeCount = 1;
    for (const n of nodes) {
      maxNodeCount = Math.max(maxNodeCount, n.count);
    }
    if (edges.length === 0) {
      return {
        maxNodeCount,
        minLinkWeight: 1,
        maxLinkWeight: 1,
        adjacency: new Map<string, Set<string>>(),
      };
    }
    const ws = edges.map((e) => e.weight);
    return {
      maxNodeCount,
      minLinkWeight: Math.min(...ws),
      maxLinkWeight: Math.max(...ws),
      adjacency: buildAdjacency(edges),
    };
  }, [graph]);
}

export function CooccurrenceNetwork({
  graph,
  graphHeight: graphHeightProp,
  onNodeTokenClick,
  tokenDetailOpen = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const touchPrimary = useTouchPrimaryUi();
  const prevDetailOpenRef = useRef(false);

  const [viewportHeight, setViewportHeight] = useState(500);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [tapFocusId, setTapFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (graphHeightProp !== undefined) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const sync = () => setViewportHeight(mq.matches ? 400 : 500);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [graphHeightProp]);

  const graphHeight = graphHeightProp ?? viewportHeight;
  const [size, setSize] = useState({ width: 800, height: graphHeight });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.clientWidth;
      setSize({ width: Math.max(200, w), height: graphHeight });
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [graphHeight]);

  useEffect(() => {
    setHoveredId(null);
    setTapFocusId(null);
  }, [graph]);

  useEffect(() => {
    const was = prevDetailOpenRef.current;
    prevDetailOpenRef.current = tokenDetailOpen;
    if (touchPrimary && was && !tokenDetailOpen) setTapFocusId(null);
  }, [tokenDetailOpen, touchPrimary]);

  const graphData = useMemo(() => {
    const links: GraphLink[] = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      weight: e.weight,
    }));
    return { nodes: graph.nodes as GraphNode[], links };
  }, [graph]);

  const { maxNodeCount, minLinkWeight, maxLinkWeight, adjacency } = useGraphLayoutStats(graph);

  const nodeCount = graph.nodes.length;
  const cooldownTicks = nodeCount >= 90 ? 50 : nodeCount >= 50 ? 72 : 100;
  const warmupTicks = nodeCount >= 90 ? 32 : 44;

  const focusCenterId = touchPrimary ? tapFocusId : hoveredId;

  const focusNodeIds = useMemo(() => {
    if (!focusCenterId) return null;
    const s = new Set<string>([focusCenterId]);
    for (const n of adjacency.get(focusCenterId) ?? []) s.add(n);
    return s;
  }, [focusCenterId, adjacency]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const fg = fgRef.current;
      if (!fg) return;
      const charge = fg.d3Force("charge") as { strength?: (v?: number) => unknown } | undefined;
      if (charge && typeof charge.strength === "function") {
        charge.strength(-34);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [graphData]);

  const linkWidthFn = useCallback(
    (link: object) => {
      const l = link as GraphLink & { source?: unknown; target?: unknown };
      const w = Math.max(1, Number(l.weight ?? 1));
      const span = maxLinkWeight - minLinkWeight;
      const t = span <= 0 ? 1 : (w - minLinkWeight) / span;
      const base = 0.5 + t * 3.5;
      if (!focusNodeIds) return base;
      const a = linkEndpointId(l.source);
      const b = linkEndpointId(l.target);
      const inFocus = focusNodeIds.has(a) && focusNodeIds.has(b);
      return inFocus ? base : base * 0.45;
    },
    [minLinkWeight, maxLinkWeight, focusNodeIds]
  );

  const linkColorFn = useCallback(
    (link: object) => {
      const l = link as GraphLink & { source?: unknown; target?: unknown };
      const w = Math.max(1, Number(l.weight ?? 1));
      const span = maxLinkWeight - minLinkWeight;
      const t = span <= 0 ? 1 : (w - minLinkWeight) / span;
      const baseAlpha = 0.22 + t * 0.68;
      if (!focusNodeIds) return `rgba(${LINK_RGB},${baseAlpha})`;
      const a = linkEndpointId(l.source);
      const b = linkEndpointId(l.target);
      const inFocus = focusNodeIds.has(a) && focusNodeIds.has(b);
      return inFocus ? `rgba(${LINK_RGB},${0.35 + t * 0.6})` : `rgba(${LINK_RGB},0.2)`;
    },
    [minLinkWeight, maxLinkWeight, focusNodeIds]
  );

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as SimNode;
      const x = n.x;
      const y = n.y;
      if (x === undefined || y === undefined) return;

      const id = String(n.id);
      const { r, fontSize } = nodeRadiusAndFontSize(n, ctx, globalScale);
      const fill = nodeFillRgb(n.count, maxNodeCount);
      const dimmed = focusNodeIds !== null && !focusNodeIds.has(id);
      const isFocusSelf = focusCenterId === id;
      const neighborHighlight =
        focusCenterId !== null && !isFocusSelf && focusNodeIds !== null && focusNodeIds.has(id);

      ctx.save();
      if (dimmed) ctx.globalAlpha = 0.2;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = fill;
      ctx.fill();

      ctx.strokeStyle = "rgba(15, 23, 42, 0.45)";
      ctx.lineWidth = Math.max(0.45 / globalScale, 0.25);
      ctx.stroke();

      if (!dimmed && isFocusSelf) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.lineWidth = Math.max(2.6 / globalScale, 1.15);
        ctx.stroke();
      } else if (!dimmed && neighborHighlight) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.75)";
        ctx.lineWidth = Math.max(1.5 / globalScale, 0.75);
        ctx.stroke();
      }

      ctx.font = `${fontSize}px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = dimmed ? "rgba(226, 232, 240, 0.45)" : LABEL_COLOR;
      ctx.fillText(String(n.id), x, y);

      ctx.restore();
    },
    [maxNodeCount, focusNodeIds, focusCenterId]
  );

  const nodePointerAreaPaint = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as SimNode;
      const x = n.x;
      const y = n.y;
      if (x === undefined || y === undefined) return;
      const { r } = nodeRadiusAndFontSize(n, ctx, globalScale);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
    },
    []
  );

  const onNodeHover = useCallback(
    (node: { id?: string | number } | null) => {
      if (touchPrimary) return;
      if (!node || node.id === undefined || node.id === null) {
        setHoveredId(null);
        return;
      }
      setHoveredId(String(node.id));
    },
    [touchPrimary]
  );

  const onNodeClick = useCallback(
    (node: { id?: string | number }, event: MouseEvent) => {
      void event;
      if (node.id === undefined || node.id === null) return;
      const id = String(node.id);
      if (touchPrimary) setTapFocusId(id);
      onNodeTokenClick?.(id);
    },
    [touchPrimary, onNodeTokenClick]
  );

  const onBackgroundClick = useCallback(() => {
    setHoveredId(null);
    setTapFocusId(null);
  }, []);

  const grabClass = touchPrimary ? "touch-none w-full" : "touch-none w-full cursor-grab active:cursor-grabbing";

  return (
    <div ref={containerRef} className={grabClass} style={{ height: graphHeight }}>
      <ForceGraph2D
        ref={fgRef}
        width={size.width}
        height={size.height}
        graphData={graphData}
        nodeId="id"
        nodeLabel="id"
        nodeVal={(n) => Math.max(1, Number((n as GraphNode).count ?? 1))}
        linkSource="source"
        linkTarget="target"
        linkWidth={linkWidthFn}
        linkColor={linkColorFn}
        backgroundColor="transparent"
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.52}
        warmupTicks={warmupTicks}
        cooldownTicks={cooldownTicks}
        nodeCanvasObjectMode="replace"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        onNodeHover={touchPrimary ? undefined : onNodeHover}
        onNodeClick={onNodeTokenClick ? onNodeClick : undefined}
        onBackgroundClick={onBackgroundClick}
        enableZoomInteraction
        enablePanInteraction
        enablePointerInteraction
      />
    </div>
  );
}

export default CooccurrenceNetwork;
