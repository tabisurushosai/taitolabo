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
  tokenDetailOpen?: boolean;
};

const FONT_FAMILY = `ui-sans-serif, "Noto Sans JP", system-ui, sans-serif`;

/**
 * force-graph の replace 後に余計な ctx.restore() が走るため、
 * 自前の save/restore の直後にダミー save を積み、ライブラリの restore がそれを pop するようにする。
 */
function endNodeCanvasPaintForForceGraphBug(ctx: CanvasRenderingContext2D) {
  ctx.restore();
  ctx.save();
}

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
        maxLinkWeight: 1,
        adjacency: new Map<string, Set<string>>(),
      };
    }
    const ws = edges.map((e) => e.weight);
    return {
      maxNodeCount,
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

  const { maxNodeCount: maxCount, maxLinkWeight, adjacency } = useGraphLayoutStats(graph);

  const focusCenterId = touchPrimary ? tapFocusId : hoveredId;

  const focusNodeIds = useMemo(() => {
    if (!focusCenterId) return null;
    const s = new Set<string>([focusCenterId]);
    for (const n of adjacency.get(focusCenterId) ?? []) s.add(n);
    return s;
  }, [focusCenterId, adjacency]);

  useEffect(() => {
    const applyForces = () => {
      const fg = fgRef.current;
      if (!fg) return;
      const charge = fg.d3Force("charge") as { strength?: (v?: number) => unknown } | undefined;
      if (charge && typeof charge.strength === "function") {
        charge.strength(-220);
      }
      const link = fg.d3Force("link") as {
        distance?: (d: number | ((e: unknown) => number)) => unknown;
      } | null;
      if (link && typeof link.distance === "function") {
        link.distance(100);
      }
    };
    const t0 = window.setTimeout(applyForces, 0);
    const t1 = window.setTimeout(applyForces, 100);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [graphData]);

  const nodeCanvasObject = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as SimNode;
      const x = n.x;
      const y = n.y;

      ctx.save();

      if (x === undefined || y === undefined || Number.isNaN(x) || Number.isNaN(y)) {
        endNodeCanvasPaintForForceGraphBug(ctx);
        return;
      }

      const label = String(n.id ?? "");
      const baseRadius = Math.sqrt(Math.max(1, n.count || 1)) * 3 + 5;
      const ratio = Math.max(0, Math.min(1, (n.count || 1) / maxCount));
      const opacity = 0.5 + 0.5 * ratio;

      const id = label;
      const dimmed = focusNodeIds !== null && !focusNodeIds.has(id);
      const isFocusSelf = focusCenterId === id;
      const neighborHighlight =
        focusCenterId !== null && !isFocusSelf && focusNodeIds !== null && focusNodeIds.has(id);

      if (dimmed) ctx.globalAlpha = 0.22;

      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(251, 191, 36, ${opacity})`;
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
      ctx.lineWidth = Math.max(1 / globalScale, 0.5);
      ctx.stroke();

      if (!dimmed && isFocusSelf) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
        ctx.lineWidth = Math.max(2.2 / globalScale, 1);
        ctx.stroke();
      } else if (!dimmed && neighborHighlight) {
        ctx.strokeStyle = "rgba(251, 191, 36, 0.85)";
        ctx.lineWidth = Math.max(1.4 / globalScale, 0.7);
        ctx.stroke();
      }

      const fontSize = Math.max(11, 13 / Math.max(globalScale, 0.12));
      ctx.font = `bold ${fontSize}px ${FONT_FAMILY}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = dimmed ? "rgba(255, 255, 255, 0.35)" : "#FFFFFF";
      ctx.fillText(label, x, y);

      endNodeCanvasPaintForForceGraphBug(ctx);
    },
    [maxCount, focusNodeIds, focusCenterId]
  );

  const nodePointerAreaPaint = useCallback(
    (node: object, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
      void globalScale;
      const n = node as SimNode;
      const x = n.x;
      const y = n.y;
      if (x === undefined || y === undefined) return;
      const r = Math.sqrt(Math.max(1, n.count || 1)) * 3 + 5;
      ctx.save();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fill();
      endNodeCanvasPaintForForceGraphBug(ctx);
    },
    []
  );

  const linkColorFn = useCallback(
    (link: object) => {
      const l = link as GraphLink & { weight?: number };
      const w = Math.max(1, Number(l.weight ?? 1));
      const denom = maxLinkWeight <= 0 ? 1 : maxLinkWeight;
      const opacity = 0.2 + 0.5 * (w / denom);
      if (!focusNodeIds) return `rgba(148, 163, 184, ${Math.min(opacity, 0.9)})`;
      const a = linkEndpointId(l.source);
      const b = linkEndpointId(l.target);
      const inFocus = focusNodeIds.has(a) && focusNodeIds.has(b);
      return inFocus
        ? `rgba(148, 163, 184, ${Math.min(0.25 + 0.5 * (w / denom), 0.92)})`
        : "rgba(148, 163, 184, 0.18)";
    },
    [maxLinkWeight, focusNodeIds]
  );

  const linkWidthFn = useCallback(
    (link: object) => {
      const l = link as GraphLink & { weight?: number };
      const w = Math.max(1, Number(l.weight ?? 1));
      const base = Math.sqrt(w) * 0.8;
      if (!focusNodeIds) return base;
      const a = linkEndpointId(l.source);
      const b = linkEndpointId(l.target);
      const inFocus = focusNodeIds.has(a) && focusNodeIds.has(b);
      return inFocus ? base : base * 0.45;
    },
    [focusNodeIds]
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
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkSource="source"
        linkTarget="target"
        linkColor={linkColorFn}
        linkWidth={linkWidthFn}
        backgroundColor="transparent"
        d3AlphaDecay={0.028}
        d3VelocityDecay={0.35}
        warmupTicks={60}
        cooldownTicks={200}
        onNodeHover={touchPrimary ? undefined : onNodeHover}
        onNodeClick={onNodeTokenClick ? onNodeClick : undefined}
        onBackgroundClick={onBackgroundClick}
        onEngineStop={() => {}}
        enableZoomInteraction
        enablePanInteraction
        enablePointerInteraction
        enableNodeDrag
      />
    </div>
  );
}

export default CooccurrenceNetwork;
