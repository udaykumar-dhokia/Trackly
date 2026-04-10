"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchTraceSessions,
  fetchTraceGraph,
  type TraceNode,
  type TraceGraph,
} from "@/lib/store/features/tracesSlice";
import {
  WarningCircle,
  Graph as GraphIcon,
  X,
  Clock,
  CurrencyDollar,
  ArrowClockwise,
  TreeStructure,
  CircleNotch,
  TrendUp,
  Gauge,
  ArrowsOutSimple,
  CaretLeft,
  CaretRight,
  ArrowRight,
  Stack,
  SquaresFour,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { encodeModelKey, type PlaygroundOptions } from "@/lib/playground";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <CircleNotch size={32} className="animate-spin text-zinc-600" />
    </div>
  ),
});

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10b981",
  anthropic: "#f59e0b",
  google: "#3b82f6",
  groq: "#ef4444",
  mistral: "#a855f7",
  cohere: "#ec4899",
  deepseek: "#06b6d4",
  ollama: "#84cc16",
};
const DEFAULT_COLOR = "#6366f1";
const GRAPH_BG = "#09090b";

function getProviderColor(p: string) {
  return PROVIDER_COLORS[p.toLowerCase()] || DEFAULT_COLOR;
}

function ModelNodeIcon({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <div
      className="rounded-full shadow-lg border border-white/20 relative overflow-hidden"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${color}ee, ${color}99)`,
        boxShadow: `0 0 20px ${color}44`,
      }}
    >
      <div className="absolute inset-0 bg-white/10 opacity-30 transform -rotate-45 translate-x-[-20%] translate-y-[-20%]" />
    </div>
  );
}
function formatCost(v: number) {
  if (v < 0.001) return `$${v.toFixed(6)}`;
  if (v < 1) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}
function formatLatency(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
function formatTimeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface Insight {
  icon: any;
  title: string;
  subject?: string;
  value: string;
  detail: string;
  action?: string;
  severity: "info" | "warning" | "success" | "error";
}

function computeInsights(graph: TraceGraph): Insight[] {
  const { nodes, edges, summary, insights: backendInsights } = graph;
  if (!nodes || nodes.length === 0) return [];
  const out: Insight[] = [];

  if (backendInsights && backendInsights.length > 0) {
    backendInsights.forEach((bi) => {
      let icon = TrendUp;
      if (bi.type === "cost") icon = CurrencyDollar;
      if (bi.type === "latency") icon = Clock;
      if (bi.type === "retry") icon = ArrowClockwise;
      if (bi.type === "failure") icon = WarningCircle;

      out.push({
        icon,
        title: bi.title,
        subject: bi.subject,
        value: bi.value || bi.type.toUpperCase(),
        detail: bi.message,
        action: bi.action!,
        severity: bi.severity,
      });
    });
  }

  const costliest = [...nodes].sort(
    (a, b) => b.estimated_cost_usd - a.estimated_cost_usd,
  )[0];
  if (
    costliest &&
    summary?.total_cost > 0 &&
    !backendInsights?.some((bi) => bi.type === "cost")
  ) {
    const pct = (
      (costliest.estimated_cost_usd / summary.total_cost) *
      100
    ).toFixed(0);
    out.push({
      icon: CurrencyDollar,
      title: "Costliest Step",
      value: `${costliest.model} — ${formatCost(costliest.estimated_cost_usd)}`,
      detail:
        Number(pct) > 50
          ? `Accounts for ${pct}% of session cost. Consider a cheaper model.`
          : `${pct}% of session cost.`,
      severity: Number(pct) > 50 ? "warning" : "info",
    });
  }

  const slowest = [...nodes].sort((a, b) => b.latency_ms - a.latency_ms)[0];
  if (
    slowest?.latency_ms > 0 &&
    summary &&
    !backendInsights?.some((bi) => bi.type === "latency")
  ) {
    const pct = ((slowest.latency_ms / summary.total_latency_ms) * 100).toFixed(
      0,
    );
    out.push({
      icon: Clock,
      title: "Latency Bottleneck",
      value: `${slowest.model} — ${formatLatency(slowest.latency_ms)}`,
      detail:
        slowest.latency_ms > 3000
          ? `${pct}% of latency. Consider async/streaming.`
          : `${pct}% of total latency.`,
      severity: slowest.latency_ms > 3000 ? "warning" : "info",
    });
  }

  if (summary?.total_tokens > 0) {
    const tp = nodes.reduce((s, n) => s + n.prompt_tokens, 0);
    const pp = ((tp / summary.total_tokens) * 100).toFixed(0);
    out.push({
      icon: Gauge,
      title: "Token Efficiency",
      value: `${pp}% prompt / ${100 - Number(pp)}% completion`,
      detail:
        Number(pp) > 80
          ? "Prompts dominate. Shorten or cache."
          : "Healthy ratio.",
      severity: Number(pp) > 80 ? "warning" : "success",
    });
  }

  const mc: Record<string, number> = {};
  nodes.forEach((n) => (mc[n.model] = (mc[n.model] || 0) + 1));
  const me = Object.entries(mc).sort((a, b) => b[1] - a[1]);
  if (
    me.length === 1 &&
    nodes.length > 2 &&
    !backendInsights?.some((bi) => bi.type === "retry")
  )
    out.push({
      icon: TrendUp,
      title: "Single Model",
      value: `All ${nodes.length} calls → ${me[0][0]}`,
      detail: "Route simpler tasks to cheaper models.",
      severity: "warning",
    });
  else if (me.length > 1)
    out.push({
      icon: TrendUp,
      title: "Model Mix",
      value: me
        .slice(0, 3)
        .map(([m, c]) => `${m} (${c})`)
        .join(", "),
      detail: `${me.length} models across ${nodes.length} steps.`,
      severity: "info",
    });

  if (edges?.length > 0) {
    const ch: Record<string, string[]> = {};
    const roots = new Set(nodes.map((n) => n.id));
    edges.forEach((e) => {
      if (!ch[e.source]) ch[e.source] = [];
      ch[e.source].push(e.target);
      roots.delete(e.target);
    });
    const gd = (id: string, v: Set<string>): number => {
      if (v.has(id)) return 0;
      v.add(id);
      const k = ch[id] || [];
      return k.length === 0 ? 1 : 1 + Math.max(...k.map((x) => gd(x, v)));
    };
    const md = Math.max(...[...roots].map((r) => gd(r, new Set())));
    out.push({
      icon: TreeStructure,
      title: "Depth",
      value: `${md} level${md !== 1 ? "s" : ""}`,
      detail:
        md > 5 ? "Deep chain — flatten for reliability." : "Reasonable depth.",
      severity: md > 5 ? "warning" : "success",
    });
  }

  if (nodes.length > 0 && summary) {
    out.push({
      icon: ArrowsOutSimple,
      title: "Avg Cost/Step",
      value: formatCost(summary.total_cost / nodes.length),
      detail: `${nodes.length} steps, ${formatCost(summary.total_cost)} total.`,
      severity: "info",
    });
  }

  return out;
}

export default function VisualisePage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const { activeProjectId, status: projectsStatus } = useAppSelector(
    (s) => s.projects,
  );
  const { sessions, sessionsStatus, activeGraph, graphStatus } = useAppSelector(
    (s) => s.traces,
  );

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [highlightMode, setHighlightMode] = useState<
    "none" | "longest" | "costliest"
  >("none");
  const [showSessions, setShowSessions] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const [aggregateRetries, setAggregateRetries] = useState(true);
  const graphRef = useRef<any>(null);

  const [playgroundOptions, setPlaygroundOptions] =
    useState<PlaygroundOptions | null>(null);
  const [modelSwaps, setModelSwaps] = useState<Record<string, string>>({});
  const [loadingOptions, setLoadingOptions] = useState(false);

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const shelfRef = useRef<HTMLDivElement>(null);

  const scrollShelf = (dir: "left" | "right") => {
    if (shelfRef.current) {
      shelfRef.current.scrollBy({
        left: dir === "left" ? -300 : 300,
        behavior: "smooth",
      });
    }
  };
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (!containerEl) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDims((prev) =>
            prev.w === Math.floor(width) && prev.h === Math.floor(height)
              ? prev
              : { w: Math.floor(width), h: Math.floor(height) },
          );
        }
      }
    });

    ro.observe(containerEl);

    const { width, height } = containerEl.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setDims((prev) =>
        prev.w === Math.floor(width) && prev.h === Math.floor(height)
          ? prev
          : { w: Math.floor(width), h: Math.floor(height) },
      );
    }

    return () => ro.disconnect();
  }, [containerEl]);

  useEffect(() => {
    if (graphRef.current && activeGraph) {
      graphRef.current.d3Force("charge").strength(-400);
      graphRef.current.d3Force("link").distance(110);

      const sim = graphRef.current.d3Simulation();
      if (sim) {
        sim.alphaTarget(0.2).restart();
        setTimeout(() => sim.alphaTarget(0), 1000);
      }
    }
  }, [activeGraph]);

  useEffect(() => {
    if (activeProjectId && user?.sub) {
      dispatch(
        fetchTraceSessions({ projectId: activeProjectId, auth0Id: user.sub }),
      );
    }
  }, [activeProjectId, user?.sub, dispatch]);

  useEffect(() => {
    if (activeProjectId && user?.sub && selectedSessionId) {
      dispatch(
        fetchTraceGraph({
          projectId: activeProjectId,
          auth0Id: user.sub,
          sessionId: selectedSessionId,
        }),
      );
      setSelectedNode(null);
    }
  }, [activeProjectId, user?.sub, selectedSessionId, dispatch]);

  useEffect(() => {
    if (!activeProjectId || !user?.sub) return;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(
          `${apiUrl}/api/v1/projects/${activeProjectId}/playground/options?auth0_id=${encodeURIComponent(user.sub)}`,
        );
        if (response.ok) {
          const data = (await response.json()) as PlaygroundOptions;
          setPlaygroundOptions(data);
          if (data.catalog.length > 0) {
          }
        }
      } catch (err) {
        console.error("Failed to load playground options", err);
      } finally {
        setLoadingOptions(false);
      }
    };

    void loadOptions();
  }, [activeProjectId, user?.sub]);

  const graphData = useMemo(() => {
    if (!activeGraph) return { nodes: [], links: [] };

    const groups: Record<string, TraceNode[]> = {};
    activeGraph.nodes.forEach((n) => {
      const key = `${n.name || n.model}-${n.node_type}-${n.parent_run_id || "root"}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });

    const processedNodes: any[] = [];
    const nodeIdMap: Record<string, string> = {};

    const mc = Math.max(
      ...activeGraph.nodes.map((n) => n.estimated_cost_usd),
      0.0001,
    );

    if (aggregateRetries) {
      Object.values(groups).forEach((group) => {
        group.sort(
          (a, b) =>
            new Date(a.occurred_at).getTime() -
            new Date(b.occurred_at).getTime(),
        );

        const last = group[group.length - 1];
        const representativeId = last.id;

        group.forEach((member) => {
          nodeIdMap[member.id] = representativeId;
        });

        const totalCost = group.reduce(
          (sum, n) => sum + n.estimated_cost_usd,
          0,
        );
        const totalTokens = group.reduce((sum, n) => sum + n.total_tokens, 0);
        const totalLatency = group.reduce((sum, n) => sum + n.latency_ms, 0);
        const hasFailures = group.some((n) => n.status === "error");

        processedNodes.push({
          id: representativeId,
          label:
            group.length > 1 ? `${last.model} (x${group.length})` : last.model,
          provider: last.provider,
          cost: totalCost,
          tokens: totalTokens,
          latency: totalLatency,
          color: getProviderColor(last.provider),
          status: last.status,
          hasFailures,
          status_message: last.status_message,
          val:
            (18 + (totalCost / mc) * 20) * (last.status === "error" ? 0.65 : 1),
          _raw: last,
          attempts: group,
          node_type: last.node_type,
        });
      });
    } else {
      activeGraph.nodes.forEach((n) => {
        nodeIdMap[n.id] = n.id;
        processedNodes.push({
          ...n,
          label: n.model,
          cost: n.estimated_cost_usd,
          tokens: n.total_tokens,
          latency: n.latency_ms,
          color: getProviderColor(n.provider),
          status: n.status,
          hasFailures: n.status === "error",
          val:
            (18 + (n.estimated_cost_usd / mc) * 20) *
            (n.status === "error" ? 0.65 : 1),
          _raw: n,
        });
      });
    }

    const processedLinksMap: Record<string, any> = {};
    activeGraph.edges.forEach((e) => {
      const source = nodeIdMap[e.source] || e.source;
      const target = nodeIdMap[e.target] || e.target;

      if (source !== target) {
        const linkKey = `${source}->${target}`;
        processedLinksMap[linkKey] = { source, target };
      }
    });

    return {
      nodes: processedNodes,
      links: Object.values(processedLinksMap),
    };
  }, [activeGraph, aggregateRetries]);

  const criticalPath = useMemo(() => {
    if (!activeGraph || highlightMode === "none") {
      return { nodes: new Set<string>(), links: new Set<string>() };
    }

    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    activeGraph.nodes.forEach((n) => {
      inDegree[n.id] = 0;
      adj[n.id] = [];
    });

    activeGraph.edges.forEach((e) => {
      adj[e.source] = adj[e.source] || [];
      adj[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    });

    const nodeWeights: Record<string, number> = {};
    activeGraph.nodes.forEach((n) => {
      nodeWeights[n.id] =
        highlightMode === "longest" ? n.latency_ms : n.estimated_cost_usd;
    });

    const memo: Record<string, { weight: number; path: string[] }> = {};

    const findMaxPath = (id: string): { weight: number; path: string[] } => {
      if (memo[id]) return memo[id];

      const children = adj[id] || [];
      const weight = nodeWeights[id] || 0;

      if (children.length === 0) {
        return { weight, path: [id] };
      }

      let maxSubWeight = -1;
      let maxSubPath: string[] = [];

      children.forEach((childId) => {
        const res = findMaxPath(childId);
        if (res.weight > maxSubWeight) {
          maxSubWeight = res.weight;
          maxSubPath = res.path;
        }
      });

      const result = {
        weight: weight + maxSubWeight,
        path: [id, ...maxSubPath],
      };
      memo[id] = result;
      return result;
    };

    const roots = Object.keys(inDegree).filter((id) => inDegree[id] === 0);
    let bestWeight = -1;
    let bestPath: string[] = [];

    roots.forEach((rootId) => {
      const res = findMaxPath(rootId);
      if (res.weight > bestWeight) {
        bestWeight = res.weight;
        bestPath = res.path;
      }
    });

    const nodes = new Set(bestPath);
    const links = new Set<string>();
    for (let i = 0; i < bestPath.length - 1; i++) {
      links.add(`${bestPath[i]}->${bestPath[i + 1]}`);
    }

    return { nodes, links };
  }, [activeGraph, highlightMode]);

  const insights = useMemo(
    () => (activeGraph ? computeInsights(activeGraph) : []),
    [activeGraph],
  );

  const handleNodeClick = useCallback((node: any) => {
    if (!node) return;
    const rawData = node._raw || node;
    setSelectedNode(rawData as TraceNode);
  }, []);
  const handleNodeHover = useCallback(
    (node: any) => setHoveredNode(node?.id || null),
    [],
  );
  const handleRefresh = () => {
    if (activeProjectId && user?.sub)
      dispatch(
        fetchTraceSessions({ projectId: activeProjectId, auth0Id: user.sub }),
      );
  };

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      let nodeLabel = node.label;
      let nodeColor = node.color;
      let nodeCost = node.cost;

      const isLLM = selectedNode?.node_type === "generation";

      const nodeStatus = node.status;
      const isError = nodeStatus === "error";

      const swapKey = modelSwaps[node.id];
      if (swapKey && playgroundOptions) {
        const target = playgroundOptions.catalog.find(
          (m) => encodeModelKey(m.provider, m.model) === swapKey,
        );
        if (target) {
          nodeLabel = target.model;
          nodeColor = getProviderColor(target.provider);
          nodeCost =
            (node._raw.prompt_tokens / 1000) * target.input_cost_per_1k +
            (node._raw.completion_tokens / 1000) * target.output_cost_per_1k;
        }
      }

      if (isError) {
        nodeColor = "#f43f5e";
      }

      const r = Math.sqrt(node.val) * 2;
      const hov = hoveredNode === node.id;
      const sel = selectedNode?.id === node.id;
      const isCritical = criticalPath.nodes.has(node.id);
      const x = node.x || 0,
        y = node.y || 0;

      if (hov || sel || isCritical) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
        ctx.fillStyle = isCritical
          ? "rgba(234, 179, 8, 0.4)"
          : `${nodeColor}30`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, 2 * Math.PI);
        ctx.fillStyle = isCritical
          ? "rgba(234, 179, 8, 0.2)"
          : `${nodeColor}15`;
        ctx.fill();
      }
      if (node.attempts?.length > 1) {
        for (let i = 1; i <= Math.min(node.attempts.length - 1, 2); i++) {
          const offset = i * 3;
          ctx.beginPath();
          ctx.arc(x + offset, y + offset, r, 0, 2 * Math.PI);
          ctx.fillStyle = node.hasFailures
            ? "rgba(244, 63, 94, 0.2)"
            : "rgba(0,0,0,0.4)";
          ctx.fill();
          ctx.strokeStyle = node.hasFailures
            ? "rgba(244, 63, 94, 0.3)"
            : "rgba(255,255,255,0.1)";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      if (isCritical) {
        g.addColorStop(0, "#fbbf24");
        g.addColorStop(1, "#d97706");
      } else {
        g.addColorStop(0, `${nodeColor}ee`);
        g.addColorStop(1, `${nodeColor}88`);
      }
      ctx.fillStyle = g;
      ctx.fill();

      if (node.hasFailures && !isError) {
        ctx.beginPath();
        ctx.arc(x + r * 0.7, y - r * 0.7, r * 0.35, 0, 2 * Math.PI);
        ctx.fillStyle = "#f43f5e";
        ctx.fill();
        ctx.strokeStyle = GRAPH_BG;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = `bold ${r * 0.4}px Inter`;
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", x + r * 0.7, y - r * 0.7);
      }

      ctx.strokeStyle =
        hov || sel || isCritical
          ? "#fff"
          : isError
            ? "#f43f5e"
            : `${nodeColor}cc`;
      ctx.lineWidth = hov || sel || isCritical ? 2.5 : 1;
      ctx.stroke();

      if (isError) {
        ctx.beginPath();
        const crossSize = r * 0.4;
        ctx.moveTo(x - crossSize, y - crossSize);
        ctx.lineTo(x + crossSize, y + crossSize);
        ctx.moveTo(x + crossSize, y - crossSize);
        ctx.lineTo(x - crossSize, y + crossSize);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      if (globalScale > 0.6) {
        const fs = Math.max(11 / globalScale, 3);
        ctx.font = `600 ${fs}px Inter,system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isCritical ? "#fef3c7" : "#e4e4e7";
        ctx.fillText(nodeLabel, x, y + r + 4);
        if (globalScale > 1) {
          ctx.font = `${fs * 0.75}px Inter,system-ui,sans-serif`;
          ctx.fillStyle = isCritical ? "#f59e0b" : "#71717a";
          ctx.fillText(formatCost(nodeCost), x, y + r + 4 + fs + 2);
        }
      }
    },
    [hoveredNode, selectedNode, modelSwaps, playgroundOptions, criticalPath],
  );

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const s = link.source,
        e = link.target;
      if (!s || !e || typeof s.x !== "number") return;

      const linkId = `${s.id}->${e.id}`;
      const isCritical = criticalPath.links.has(linkId);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.strokeStyle = isCritical
        ? "rgba(245, 158, 11, 0.8)"
        : "rgba(161,161,170,0.25)";
      ctx.lineWidth = (isCritical ? 3 : 1.5) / globalScale;
      ctx.stroke();

      const a = Math.atan2(e.y - s.y, e.x - s.x);
      const er = Math.sqrt(e.val || 6) * 2;
      const ax = e.x - Math.cos(a) * (er + 2),
        ay = e.y - Math.sin(a) * (er + 2);
      const al = (isCritical ? 10 : 6) / globalScale;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(
        ax - al * Math.cos(a - Math.PI / 7),
        ay - al * Math.sin(a - Math.PI / 7),
      );
      ctx.lineTo(
        ax - al * Math.cos(a + Math.PI / 7),
        ay - al * Math.sin(a + Math.PI / 7),
      );
      ctx.closePath();
      ctx.fillStyle = isCritical
        ? "rgba(245, 158, 11, 1)"
        : "rgba(161,161,170,0.45)";
      ctx.fill();
    },
    [criticalPath],
  );

  const whatIfResult = useMemo(() => {
    if (
      !activeGraph?.summary ||
      !playgroundOptions ||
      Object.keys(modelSwaps).length === 0
    )
      return null;

    let totalProjectedDelta = 0;
    const sessionCurrent = activeGraph.summary.total_cost || 0;

    Object.entries(modelSwaps).forEach(([nodeId, targetKey]) => {
      const node = activeGraph.nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const targetModel = playgroundOptions.catalog.find(
        (m) => encodeModelKey(m.provider, m.model) === targetKey,
      );
      if (!targetModel) return;

      const nodeCurrent = node.estimated_cost_usd;
      const nodeProjected =
        (node.prompt_tokens / 1000) * targetModel.input_cost_per_1k +
        (node.completion_tokens / 1000) * targetModel.output_cost_per_1k;

      totalProjectedDelta += nodeProjected - nodeCurrent;
    });

    const sessionProjected = sessionCurrent + totalProjectedDelta;
    const sessionPercentage =
      sessionCurrent > 0 ? (totalProjectedDelta / sessionCurrent) * 100 : 0;

    return {
      sessionCurrent,
      sessionProjected,
      sessionDelta: totalProjectedDelta,
      sessionPercentage,
      activeSwapsCount: Object.keys(modelSwaps).length,
    };
  }, [activeGraph, playgroundOptions, modelSwaps]);

  if (
    projectsStatus === "loading" ||
    (projectsStatus === "idle" && !activeProjectId)
  ) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-500 animate-pulse">
        Initializing…
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="mx-auto mt-20 flex max-w-md flex-col items-center space-y-4 rounded-xl border border-white/10 bg-[#0a0a0a] p-10 text-center">
        <WarningCircle size={44} className="text-zinc-500" />
        <h1 className="text-lg font-semibold text-white">No Active Project</h1>
        <p className="text-sm text-zinc-400">
          Select a project to inspect agent execution traces.
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 top-14 z-20 flex flex-col bg-[#09090b] overflow-hidden">
      <style jsx global>{`
        ::-webkit-scrollbar {
          display: none !important;
        }
        * {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `}</style>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#09090b] shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSessions((v) => !v)}
            className="cursor-pointer flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
          >
            {showSessions ? (
              <CaretLeft size={14} />
            ) : (
              <TreeStructure size={14} />
            )}
            <span className="hidden sm:inline">
              {showSessions ? "Hide" : "Sessions"}
            </span>
          </button>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-sm font-semibold text-white">Trace Graph</span>
          {selectedSessionId && (
            <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline truncate max-w-[180px]">
              /{" "}
              {selectedSessionId === "__ungrouped__"
                ? "ungrouped"
                : selectedSessionId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeGraph && activeGraph.nodes.length > 0 && (
            <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setHighlightMode("none")}
                className={`cursor-pointer px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${highlightMode === "none" ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                None
              </button>
              <button
                onClick={() => setHighlightMode("longest")}
                className={`cursor-pointer px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 ${highlightMode === "longest" ? "bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <Clock size={12} weight="bold" />
                Longest
              </button>
              <button
                onClick={() => setHighlightMode("costliest")}
                className={`cursor-pointer px-2 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 ${highlightMode === "costliest" ? "bg-emerald-500/20 text-emerald-400 shadow-sm border border-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                <CurrencyDollar size={12} weight="bold" />
                Costliest
              </button>
            </div>
          )}

          {activeGraph && activeGraph.nodes.length > 0 && (
            <button
              onClick={() => setAggregateRetries((v) => !v)}
              title={
                aggregateRetries
                  ? "Show individual attempts"
                  : "Aggregate retries into nodes"
              }
              className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all border ${
                aggregateRetries
                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.1)]"
                  : "bg-white/5 text-zinc-500 border-white/5 hover:text-white"
              }`}
            >
              {aggregateRetries ? (
                <Stack size={14} weight="bold" />
              ) : (
                <SquaresFour size={14} weight="bold" />
              )}
              <span>{aggregateRetries ? "Aggregated" : "Raw View"}</span>
            </button>
          )}

          {activeGraph && activeGraph.nodes.length > 0 && (
            <Button
              onClick={() => setShowInsights((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] bg-white/20  font-medium rounded-lg transition-colors ${showInsights ? "bg-white/10 text-white" : "text-white hover:bg-white/10"}`}
            >
              <TrendUp size={14} />
              <span className="hidden sm:inline">Insights</span>
            </Button>
          )}
          <button
            onClick={handleRefresh}
            disabled={sessionsStatus === "loading"}
            className="p-1.5 text-white cursor-pointer hover:text-white transition-colors disabled:opacity-40"
          >
            <ArrowClockwise
              size={16}
              className={sessionsStatus === "loading" ? "animate-spin" : ""}
            />
          </button>
        </div>
      </div>

      {/* Body: 3-panel flex layout */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* ── 1. Left Panel: Sessions ── */}
        {showSessions && (
          <>
            <div className="w-56 shrink-0 bg-[#09090b] flex flex-col border-r border-white/5 min-h-0">
              <div className="px-3 pt-3 pb-2 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                  Sessions
                </span>
                <span className="text-[10px] font-mono text-zinc-600">
                  {sessions.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
                {sessionsStatus === "loading" && sessions.length === 0 ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-lg bg-white/5"
                    />
                  ))
                ) : sessions.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <p className="text-[11px] text-zinc-500">
                      No sessions yet. Send events with{" "}
                      <code className="text-zinc-400">session_id</code>.
                    </p>
                  </div>
                ) : (
                  sessions.map((s) => {
                    const active = selectedSessionId === s.session_id;
                    return (
                      <button
                        key={s.session_id}
                        onClick={() => setSelectedSessionId(s.session_id)}
                        className={`cursor-pointer w-full text-left px-3 py-2.5 rounded-lg transition-all border ${active ? "bg-white/10 inset-shadow-2xs inset-shadow-white/10 border-white/10" : "border-transparent hover:bg-white/5"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[11px] font-semibold truncate max-w-[140px] ${active ? "text-white" : "text-zinc-300"}`}
                          >
                            {s.session_id === "__ungrouped__"
                              ? "Ungrouped"
                              : s.session_id}
                          </span>
                          <span className="text-[10px] text-zinc-600 shrink-0 ml-1">
                            {formatTimeAgo(s.last_event)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500 font-mono">
                          <span>{s.event_count} events</span>
                          <span>·</span>
                          <span>{formatCost(s.total_cost)}</span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* ── 2. Middle Panel: Graph Canvas ── */}
        <div
          className="relative overflow-hidden flex flex-col flex-1 min-w-0 min-h-0"
          style={{ background: GRAPH_BG }}
        >
          {!selectedSessionId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <GraphIcon size={56} className="text-zinc-700 mb-4" />
              <h2 className="text-base font-semibold text-zinc-400 mb-1">
                Select a Trace
              </h2>
              <p className="text-sm text-zinc-600 max-w-xs">
                Choose a session to visualize its execution graph.
              </p>
            </div>
          ) : graphStatus === "loading" ? (
            <div className="flex flex-col items-center justify-center h-full">
              <CircleNotch
                size={36}
                className="animate-spin text-zinc-600 mb-3"
              />
              <span className="text-sm text-zinc-500">Building graph…</span>
            </div>
          ) : activeGraph && graphData.nodes.length > 0 ? (
            <>
              {/* ForceGraph Container wrapping dims state */}
              <div
                ref={setContainerEl}
                className="flex-1 relative overflow-hidden w-full h-full min-h-0"
              >
                <ForceGraph2D
                  ref={graphRef}
                  graphData={graphData}
                  width={dims.w || undefined}
                  height={dims.h || undefined}
                  nodeCanvasObject={paintNode}
                  linkCanvasObject={paintLink}
                  onNodeClick={handleNodeClick}
                  onNodeHover={handleNodeHover}
                  backgroundColor={GRAPH_BG}
                  nodeRelSize={4}
                  linkDirectionalParticles={2}
                  linkDirectionalParticleWidth={1.5}
                  linkDirectionalParticleColor={() => "rgba(161,161,170,0.35)"}
                  d3AlphaDecay={0.02}
                  d3VelocityDecay={0.3}
                  cooldownTicks={100}
                  warmupTicks={50}
                  enableNodeDrag
                  enableZoomInteraction
                  enablePanInteraction
                />

                {/* Summary HUD — top right over the graph */}
                {activeGraph.summary && (
                  <div className="absolute top-3 right-3 z-10 pointer-events-none">
                    <div className="rounded-lg border border-white/10 bg-black/60 backdrop-blur-md px-4 py-3 min-w-[130px] transition-all">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">
                          {whatIfResult
                            ? "Projected Total"
                            : "Session Overview"}
                        </div>
                        {whatIfResult && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold uppercase tracking-widest border border-amber-500/20">
                            {whatIfResult.activeSwapsCount} Swap
                            {whatIfResult.activeSwapsCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <div
                        className={`text-xl font-semibold tracking-tight transition-all flex items-center gap-2 ${whatIfResult ? (whatIfResult.sessionDelta <= 0 ? "text-emerald-400" : "text-rose-500") : "text-white"}`}
                      >
                        {whatIfResult ? (
                          <>
                            <span className="opacity-40 text-sm line-through decoration-zinc-500">
                              {formatCost(activeGraph.summary.total_cost)}
                            </span>
                            <ArrowRight size={14} className="opacity-40" />
                            <span>
                              {formatCost(whatIfResult.sessionProjected)}
                            </span>
                          </>
                        ) : (
                          formatCost(activeGraph.summary.total_cost)
                        )}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-400 font-medium tracking-tight">
                        <span>{activeGraph.summary.event_count} events</span>
                        <span>
                          {formatLatency(activeGraph.summary.total_latency_ms)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Provider legend — bottom left over the graph */}
                <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
                  <div className="rounded-lg border border-white/10 bg-black/60 backdrop-blur-md px-3 py-2.5 space-y-1">
                    {[...new Set(activeGraph.nodes.map((n) => n.provider))].map(
                      (p) => (
                        <div key={p} className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: getProviderColor(p) }}
                          />
                          <span className="text-[10px] font-medium text-zinc-300 capitalize">
                            {p}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </div>

              {/* Bottom Panel: Insights or What-If Shelf */}
              {((showInsights && insights.length > 0) ||
                (selectedNode && selectedNode.node_type === "generation")) && (
                <div className="max-h-[60%] overflow-y-auto border-t border-white/10 bg-[#09090b]/95 backdrop-blur-lg shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                  <AnimatePresence mode="wait">
                    {selectedNode && selectedNode.node_type === "generation" ? (
                      <motion.div
                        key="what-if-shelf"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 30 }}
                        className="p-5 flex flex-col"
                      >
                        <div className="flex items-center justify-between mb-4 px-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                              Model Swap: {selectedNode.model}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {Object.keys(modelSwaps).length > 0 && (
                              <button
                                onClick={() => setModelSwaps({})}
                                className="cursor-pointer text-[10px] text-zinc-400 hover:text-white transition-colors uppercase font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/5 bg-white/5"
                              >
                                <ArrowClockwise size={14} /> Clear All
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const next = { ...modelSwaps };
                                delete next[selectedNode.id];
                                setModelSwaps(next);
                              }}
                              className="cursor-pointer text-[10px] text-zinc-500 hover:text-white transition-colors uppercase font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10"
                            >
                              Revert Node
                            </button>
                          </div>
                        </div>

                        <div className="relative group/shelf">
                          <div
                            ref={shelfRef}
                            className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide px-4"
                          >
                            {playgroundOptions?.catalog.map((m) => {
                              const key = encodeModelKey(m.provider, m.model);
                              const isActive =
                                modelSwaps[selectedNode.id] === key;
                              const nodeProj =
                                (selectedNode.prompt_tokens / 1000) *
                                  m.input_cost_per_1k +
                                (selectedNode.completion_tokens / 1000) *
                                  m.output_cost_per_1k;
                              const delta =
                                nodeProj - selectedNode.estimated_cost_usd;
                              const savings = delta <= 0;
                              const pColor = getProviderColor(m.provider);

                              return (
                                <button
                                  key={key}
                                  onClick={() =>
                                    setModelSwaps((prev) => ({
                                      ...prev,
                                      [selectedNode.id]: key,
                                    }))
                                  }
                                  className={`cursor-pointer group flex flex-col items-center gap-3 min-w-[140px] transition-all relative ${isActive ? "opacity-100 scale-105" : "opacity-50 hover:opacity-100"}`}
                                >
                                  <div className="relative">
                                    <ModelNodeIcon
                                      color={pColor}
                                      size={isActive ? 56 : 48}
                                    />
                                    {isActive && (
                                      <motion.div
                                        layoutId="active-ring"
                                        className="absolute -inset-3 rounded-full border-2 border-white/20"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                      />
                                    )}
                                  </div>

                                  <div className="flex flex-col items-center text-center gap-0.5 max-w-[120px]">
                                    <span className="text-[11px] font-bold text-white tracking-tight leading-tight truncate w-full">
                                      {m.model}
                                    </span>
                                    <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-tighter">
                                      {m.provider}
                                    </span>
                                  </div>

                                  <div
                                    className={`flex flex-col items-center bg-black/50 px-2.5 py-1.5 rounded-lg border border-white/5 shadow-xl transition-all ${isActive ? "border-white/20 shadow-white/2" : "border-transparent"}`}
                                  >
                                    <div className="flex flex-col gap-0.5 items-center">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-zinc-600 uppercase font-bold">
                                          Proj
                                        </span>
                                        <span className="text-[11px] font-mono font-bold text-white">
                                          {formatCost(nodeProj)}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1.5 opacity-60">
                                        <span className="text-[8px] text-zinc-700 uppercase font-bold">
                                          Orig
                                        </span>
                                        <span className="text-[9px] font-mono text-zinc-500">
                                          {formatCost(
                                            selectedNode.estimated_cost_usd,
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    <div
                                      className={`mt-1.5 pt-1.5 border-t border-white/5 w-full text-center text-[10px] font-mono font-black ${savings ? "text-emerald-400" : "text-rose-500"}`}
                                    >
                                      {savings ? "-" : "+"}$
                                      {Math.abs(delta).toFixed(4)}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {/* Navigation Buttons */}
                          <button
                            onClick={() => scrollShelf("left")}
                            className="absolute cursor-pointer left-0 top-1/2 -translate-y-10 z-30 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white opacity-0 group-hover/shelf:opacity-100 transition-opacity hover:bg-black/80"
                          >
                            <CaretLeft size={20} weight="bold" />
                          </button>
                          <button
                            onClick={() => scrollShelf("right")}
                            className="absolute cursor-pointer right-0 top-1/2 -translate-y-10 z-30 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-white opacity-0 group-hover/shelf:opacity-100 transition-opacity hover:bg-black/80"
                          >
                            <CaretRight size={20} weight="bold" />
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="diagnostics"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        className="p-4 max-h-[60%] h-[60%]"
                      >
                        <div className="flex items-center justify-between mb-1 px-1">
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">
                            Diagnostics
                          </span>
                          <button
                            onClick={() => setShowInsights(false)}
                            className="cursor-pointer p-1 text-zinc-500 hover:text-white transition-colors"
                          >
                            <X size={14} weight="bold" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {insights.map((ins, i) => (
                            <div
                              key={i}
                              className={`rounded-lg border p-3 ${
                                ins.severity === "error"
                                  ? "border-rose-500/40 bg-rose-500/5"
                                  : ins.severity === "warning"
                                    ? "border-amber-500/30 bg-amber-500/5"
                                    : ins.severity === "success"
                                      ? "border-emerald-500/20 bg-emerald-500/5"
                                      : "border-white/5 bg-white/2"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[9px] font-semibold text-zinc-500 tracking-widest">
                                  {ins.title}
                                </span>
                              </div>
                              <div
                                className={`text-base font-bold tracking-tight mb-0.5 truncate ${
                                  ins.severity === "error"
                                    ? "text-rose-400"
                                    : ins.severity === "warning"
                                      ? "text-amber-400"
                                      : "text-white"
                                }`}
                              >
                                {ins.subject || ins.title}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-300 font-bold mb-1">
                                {ins.value}
                              </div>
                              <p className="text-[10px] text-zinc-500 leading-normal font-medium line-clamp-2">
                                {ins.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          ) : activeGraph && graphData.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <GraphIcon size={48} className="text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">
                No events in this session.
              </p>
            </div>
          ) : null}
        </div>

        {/* ── 3. Right Panel: Node Details ── */}
        {selectedNode && (
          <div className="w-80 shrink-0 bg-[#09090b] border-l border-white/10 min-h-0 flex flex-col relative overflow-hidden">
            {/* Failure Banner */}
            {selectedNode.status === "error" && (
              <div className="bg-rose-500/10 border-b border-rose-500/20 px-5 py-3 flex items-center justify-between shrink-0 relative overflow-hidden">
                <motion.div
                  animate={{ opacity: [0.05, 0.15, 0.05] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute inset-0 bg-rose-500/10"
                />
                <div className="flex items-center gap-2.5 relative z-10">
                  <div className="p-1.5 rounded-lg">
                    <WarningCircle
                      size={16}
                      weight="fill"
                      className="text-white animate-pulse"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-rose-400 tracking-widest leading-none mb-0.5">
                      Alert
                    </span>
                    <span className="text-xs font text-rose-100 tracking-tight">
                      CRITICAL FAILURE
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              <div className="p-5 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">
                      Selected Step
                    </span>
                    <span className="text-lg font-semibold text-white truncate tracking-tight">
                      {selectedNode.model}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: getProviderColor(
                            selectedNode.provider,
                          ),
                        }}
                      />
                      <span className="text-[11px] text-zinc-400 capitalize">
                        {selectedNode.provider}
                      </span>
                    </div>
                    {selectedNode.status === "error" && (
                      <div className="flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 w-fit">
                        <WarningCircle
                          size={10}
                          weight="fill"
                          className="text-rose-400"
                        />
                        <span className="text-[9px] font-bold text-rose-400 uppercase tracking-wider">
                          FAILED
                        </span>
                      </div>
                    )}
                    {selectedNode.status === "ok" && (
                      <div className="flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 w-fit">
                        <CircleNotch
                          size={10}
                          weight="fill"
                          className="text-emerald-400"
                        />
                        <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                          SUCCESS
                        </span>
                      </div>
                    )}
                    {selectedNode.attempts &&
                      selectedNode.attempts.length > 1 && (
                        <div className="flex items-center gap-1 mt-2 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 w-fit">
                          <ArrowClockwise
                            size={10}
                            weight="bold"
                            className="text-indigo-400"
                          />
                          <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider">
                            {selectedNode.attempts.length} ATTEMPTS
                          </span>
                        </div>
                      )}
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="p-1 cursor-pointer text-zinc-500 hover:text-white transition-colors shrink-0 bg-white/5 rounded"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-white/5 rounded-lg p-3 bg-white/[0.01]">
                    <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">
                      Spend
                    </div>
                    <div className="text-lg font-semibold text-emerald-400 tracking-tight">
                      {formatCost(selectedNode.estimated_cost_usd)}
                    </div>
                  </div>
                  <div className="border border-white/5 rounded-lg p-3 bg-white/[0.01]">
                    <div className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest mb-1.5">
                      Latency
                    </div>
                    <div
                      className={`text-lg font-semibold tracking-tight ${selectedNode.status === "error" ? "text-zinc-500" : "text-purple-400"}`}
                    >
                      {formatLatency(selectedNode.latency_ms)}
                    </div>
                  </div>
                </div>

                {/* Error Log */}
                {selectedNode.status === "error" && (
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg overflow-hidden">
                    <div className="bg-rose-500/10 px-3 py-1.5 border-b border-rose-500/20 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">
                        Error Log
                      </span>
                      <WarningCircle size={12} className="text-rose-400" />
                    </div>
                    <div className="p-3">
                      <p className="text-[10px] font-mono text-rose-300 leading-relaxed break-words bg-black/20 p-2 rounded border border-rose-500/10">
                        {selectedNode._raw?.status_message ||
                          selectedNode.status_message ||
                          "Unhandled Runtime Exception"}
                      </p>
                    </div>
                  </div>
                )}

                {/* Execution History for Stacks */}
                {selectedNode.attempts && selectedNode.attempts.length > 1 && (
                  <div className="space-y-3">
                    <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">
                      Attempt History
                    </span>
                    <div className="space-y-2">
                      {selectedNode.attempts.map((att: any, idx: number) => (
                        <div
                          key={att.id}
                          className="flex flex-col gap-1 p-2 bg-white/[0.02] border border-white/5 rounded-md"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-zinc-400">
                              Attempt {idx + 1}
                            </span>
                            <span
                              className={`text-[8px] font-bold uppercase ${att.status === "error" ? "text-rose-400" : "text-emerald-400"}`}
                            >
                              {att.status === "error" ? "Failed" : "Resolved"}
                            </span>
                          </div>
                          <div className="text-[9px] text-zinc-500 flex justify-between">
                            <span>{formatCost(att.estimated_cost_usd)}</span>
                            <span>
                              {new Date(att.occurred_at).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tokens */}
                <div className="border border-white/5 rounded-lg p-4 bg-white/[0.01]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">
                      Tokens
                    </span>
                    <span className="text-xs font-mono text-zinc-300 bg-white/5 px-2 py-0.5 rounded">
                      {selectedNode.total_tokens.toLocaleString()} total
                    </span>
                  </div>
                  <div className="flex h-1.5 rounded-full overflow-hidden bg-black/40 border border-white/5">
                    <div
                      className="bg-blue-500"
                      style={{
                        width: `${selectedNode.total_tokens > 0 ? (selectedNode.prompt_tokens / selectedNode.total_tokens) * 100 : 50}%`,
                      }}
                    />
                    <div className="bg-indigo-500/80 flex-1" />
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-zinc-500 font-mono">
                    <span className="text-blue-400/80">
                      {selectedNode.prompt_tokens.toLocaleString()} prmt
                    </span>
                    <span className="text-indigo-400/80">
                      {selectedNode.completion_tokens.toLocaleString()} cmpl
                    </span>
                  </div>
                </div>

                {/* Run metadata */}
                {selectedNode?.run_id && (
                  <div className="space-y-3 pt-4 border-t border-white/5">
                    <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">
                      Execution IDs
                    </span>
                    <div className="bg-white/1 border border-white/5 rounded-lg p-3 space-y-3">
                      <div>
                        <div className="text-[9px] text-zinc-600 mb-1 uppercase tracking-widest">
                          Run ID
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 break-all bg-black/30 p-1.5 rounded border border-white/5">
                          {selectedNode.run_id}
                        </div>
                      </div>
                      {selectedNode.parent_run_id && (
                        <div>
                          <div className="text-[9px] text-zinc-600 mb-1 uppercase tracking-widest">
                            Parent ID
                          </div>
                          <div className="text-[10px] font-mono text-zinc-400 break-all bg-black/30 p-1.5 rounded border border-white/5">
                            {selectedNode.parent_run_id}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
