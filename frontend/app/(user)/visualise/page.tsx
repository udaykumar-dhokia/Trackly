"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchTraceSessions,
  fetchTraceGraph,
  clearActiveGraph,
  type TraceNode,
  type TraceGraph,
} from "@/lib/store/features/tracesSlice";
import {
  WarningCircle,
  Graph as GraphIcon,
  X,
  Lightning,
  Clock,
  CurrencyDollar,
  Cpu,
  ArrowClockwise,
  TreeStructure,
  CircleNotch,
  TrendUp,
  Gauge,
  ArrowsOutSimple,
  CaretLeft,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";

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
  icon: React.ElementType;
  title: string;
  value: string;
  detail: string;
  severity: "info" | "warning" | "success";
}

function computeInsights(graph: TraceGraph): Insight[] {
  const { nodes, edges, summary } = graph;
  if (!nodes || nodes.length === 0) return [];
  const out: Insight[] = [];

  const costliest = [...nodes].sort(
    (a, b) => b.estimated_cost_usd - a.estimated_cost_usd,
  )[0];
  if (costliest && summary?.total_cost > 0) {
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
  if (slowest?.latency_ms > 0 && summary) {
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
  if (me.length === 1 && nodes.length > 2)
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
  const [showSessions, setShowSessions] = useState(true);
  const [showInsights, setShowInsights] = useState(true);
  const graphRef = useRef<any>(null);

  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
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

    // Initial read
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
    if (activeProjectId && user?.sub) {
      dispatch(
        fetchTraceSessions({ projectId: activeProjectId, auth0Id: user.sub }),
      );
      setSelectedSessionId(null);
      dispatch(clearActiveGraph());
      setSelectedNode(null);
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

  const graphData = useMemo(() => {
    if (!activeGraph) return { nodes: [], links: [] };
    const mc = Math.max(
      ...activeGraph.nodes.map((n) => n.estimated_cost_usd),
      0.0001,
    );
    return {
      nodes: activeGraph.nodes.map((n) => ({
        id: n.id,
        label: n.model,
        provider: n.provider,
        cost: n.estimated_cost_usd,
        tokens: n.total_tokens,
        latency: n.latency_ms,
        color: getProviderColor(n.provider),
        val: 18 + (n.estimated_cost_usd / mc) * 20,
        _raw: n,
      })),
      links: activeGraph.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [activeGraph]);

  const insights = useMemo(
    () => (activeGraph ? computeInsights(activeGraph) : []),
    [activeGraph],
  );

  const handleNodeClick = useCallback((node: any) => {
    if (node?._raw) setSelectedNode(node._raw as TraceNode);
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
      const r = Math.sqrt(node.val) * 2;
      const hov = hoveredNode === node.id;
      const sel = selectedNode?.id === node.id;
      const x = node.x || 0,
        y = node.y || 0;

      if (hov || sel) {
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, 2 * Math.PI);
        ctx.fillStyle = `${node.color}30`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x, y, r + 8, 0, 2 * Math.PI);
        ctx.fillStyle = `${node.color}15`;
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      g.addColorStop(0, `${node.color}ee`);
      g.addColorStop(1, `${node.color}88`);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = hov || sel ? "#fff" : `${node.color}cc`;
      ctx.lineWidth = hov || sel ? 2 : 1;
      ctx.stroke();

      if (globalScale > 0.6) {
        const fs = Math.max(11 / globalScale, 3);
        ctx.font = `600 ${fs}px Inter,system-ui,sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#e4e4e7";
        ctx.fillText(node.label, x, y + r + 4);
        if (globalScale > 1) {
          ctx.font = `${fs * 0.75}px Inter,system-ui,sans-serif`;
          ctx.fillStyle = "#71717a";
          ctx.fillText(formatCost(node.cost), x, y + r + 4 + fs + 2);
        }
      }
    },
    [hoveredNode, selectedNode],
  );

  const paintLink = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const s = link.source,
        e = link.target;
      if (!s || !e || typeof s.x !== "number") return;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
      ctx.strokeStyle = "rgba(161,161,170,0.25)";
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
      const a = Math.atan2(e.y - s.y, e.x - s.x);
      const er = Math.sqrt(e.val || 6) * 2;
      const ax = e.x - Math.cos(a) * (er + 2),
        ay = e.y - Math.sin(a) * (er + 2);
      const al = 6 / globalScale;
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
      ctx.fillStyle = "rgba(161,161,170,0.45)";
      ctx.fill();
    },
    [],
  );

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
                    <div className="rounded-lg border border-white/10 bg-black/60 backdrop-blur-md px-4 py-3 min-w-[130px]">
                      <div className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest mb-0.5">
                        Session Overview
                      </div>
                      <div className="text-xl font-semibold text-white tracking-tight">
                        {formatCost(activeGraph.summary.total_cost)}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[10px] text-zinc-400 font-medium">
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

              {/* Insights section — inside middle panel, bottom docked */}
              {showInsights && insights.length > 0 && (
                <div className="max-h-[50%] overflow-y-auto border-t border-white/10 bg-[#09090b]/95 backdrop-blur-lg shrink-0 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#121216] sticky top-0 z-10">
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
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {insights.map((ins, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3.5 ${
                          ins.severity === "warning"
                            ? "border-amber-500/30 bg-amber-500/5 shadow-[inset_0_0_20px_rgba(245,158,11,0.05)]"
                            : ins.severity === "success"
                              ? "border-emerald-500/20 bg-emerald-500/5"
                              : "border-white/5 bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-semibold text-zinc-500 uppercase tracking-widest">
                            {ins.title}
                          </span>
                          {ins.severity === "warning" && (
                            <WarningCircle
                              size={14}
                              className="text-amber-400"
                            />
                          )}
                        </div>
                        <div
                          className={`text-base font-semibold tracking-tight mb-1 ${ins.severity === "warning" ? "text-amber-400" : "text-white"}`}
                        >
                          {ins.value}
                        </div>
                        <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                          {ins.detail}
                        </p>
                      </div>
                    ))}
                  </div>
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
          <div className="w-72 shrink-0 bg-[#09090b] border-l border-white/5 min-h-0 overflow-y-auto">
            <div className="p-4 space-y-6">
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
                    {selectedNode.feature && (
                      <span className="text-[9px] border border-white/10 bg-white/5 rounded px-1.5 py-0.5 text-zinc-400">
                        {selectedNode.feature}
                      </span>
                    )}
                  </div>
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
                  <div className="text-lg font-semibold text-purple-400 tracking-tight">
                    {formatLatency(selectedNode.latency_ms)}
                  </div>
                </div>
              </div>

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
              {selectedNode.run_id && (
                <div className="space-y-3 pt-4 border-t border-white/5">
                  <span className="text-[9px] font-semibold text-zinc-600 uppercase tracking-widest">
                    Execution IDs
                  </span>
                  <div className="bg-white/[0.01] border border-white/5 rounded-lg p-3 space-y-3">
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
        )}
      </div>
    </div>
  );
}
