"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { fetchDashboardStats } from "@/lib/store/features/statsSlice";
import {
  Coins,
  Database,
  ChartBar,
  Clock,
  WarningCircle,
  CaretRight,
  Funnel,
  ArrowClockwise,
} from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Link from "next/link";

const CHART_COLORS = [
  "#6366f1", // Indigo
  "#a855f7", // Purple
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#f97316", // Orange
  "#eab308", // Yellow
];

export default function DashboardPage() {
  const dispatch = useAppDispatch();

  const {
    items: projects,
    activeProjectId,
    status: projectsStatus,
  } = useAppSelector((state) => state.projects);
  const {
    summary,
    models,
    dailyUsage,
    status: statsStatus,
    error: statsError,
    lastFetchedParams,
  } = useAppSelector((state) => state.stats);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const [providerFilter, setProviderFilter] = useState("all");

  useEffect(() => {
    if (activeProjectId) {
      const needsFetch =
        !lastFetchedParams ||
        lastFetchedParams.projectId !== activeProjectId ||
        lastFetchedParams.provider !== providerFilter;

      if (needsFetch) {
        dispatch(
          fetchDashboardStats({
            projectId: activeProjectId,
            provider: providerFilter,
          }),
        );
      }
    }
  }, [activeProjectId, providerFilter, dispatch, lastFetchedParams]);

  if (
    projectsStatus === "loading" ||
    (projectsStatus === "idle" && !activeProjectId)
  ) {
    return (
      <div className="p-8 text-zinc-500 font-mono animate-pulse">
        Initializing Dashboard...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-12 p-12 border-4 border-indigo-500 bg-[#141418] shadow-[12px_12px_0_0_#4f46e5] flex flex-col items-center text-center space-y-6">
        <WarningCircle size={64} weight="duotone" className="text-indigo-400" />
        <h1 className="text-3xl font-bold text-white">No Projects Found</h1>
        <p className="text-zinc-400 font-mono max-w-lg">
          You need a project to start tracking your AI costs and usage. Projects
          isolated your LLM tracking environments.
        </p>
        <Link
          href="/organizations"
          className="bg-indigo-500 text-white font-bold py-3 px-6 border-2 border-black shadow-[4px_4px_0_0_#000000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000000] inline-flex items-center gap-2 transition-all"
        >
          Create Your First Project
          <CaretRight weight="bold" />
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Overview
            </h1>
            <span className="text-xs px-3 py-1 font-mono uppercase font-bold border-2 border-indigo-400 bg-indigo-400/10 text-indigo-300">
              Project: {activeProject?.name || "Unknown"}
            </span>
          </div>
          <p className="text-zinc-400 font-mono text-sm max-w-3xl leading-relaxed">
            Aggregated analytics covering the last 30 days of LLM execution
            history. Track costs closely and optimize your average routing
            latency.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 bg-[#1a1a24] border-2 border-white/10 px-4 py-2 self-start md:self-auto min-w-[200px]">
            <Funnel size={20} className="text-zinc-400" />
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="border-none w-full bg-none text-white font-bold font-mono text-sm focus:ring-0 px-0 h-auto shadow-none data-[state=open]:bg-transparent">
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a24] border-2 border-white/10 text-white font-mono rounded-none">
                <SelectItem
                  value="all"
                  className="focus:bg-white/10 focus:text-white cursor-pointer font-bold"
                >
                  All Providers
                </SelectItem>
                <SelectItem
                  value="openai"
                  className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5"
                >
                  OpenAI
                </SelectItem>
                <SelectItem
                  value="anthropic"
                  className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5"
                >
                  Anthropic
                </SelectItem>
                <SelectItem
                  value="google"
                  className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5"
                >
                  Google
                </SelectItem>
                <SelectItem
                  value="ollama"
                  className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5"
                >
                  Ollama
                </SelectItem>
                <SelectItem
                  value="groq"
                  className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5"
                >
                  Groq
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={() =>
              dispatch(
                fetchDashboardStats({
                  projectId: activeProjectId!,
                  provider: providerFilter,
                }),
              )
            }
            disabled={statsStatus === "loading"}
            className="p-2 border-2 border-white/10 bg-[#1a1a24] hover:bg-white/5 text-zinc-400 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center self-start md:self-auto h-[44px]"
            title="Reload Dashboard Stats"
          >
            <ArrowClockwise
              weight="bold"
              size={24}
              className={statsStatus === "loading" ? "animate-spin" : ""}
            />
          </button>
        </div>
      </section>

      {statsStatus === "loading" && (
        <div className="p-8 text-indigo-400 font-mono border-2 border-white/10 bg-[#141418] animate-pulse shadow-[6px_6px_0_0_#818cf8]">
          Computing analytics matrix...
        </div>
      )}
      {statsStatus === "failed" && (
        <div className="p-8 text-red-500 font-mono border-2 border-red-500/50 bg-[#141418] shadow-[6px_6px_0_0_#ef4444]">
          Error: {statsError}
        </div>
      )}

      {statsStatus === "succeeded" && summary && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Estimated Cost"
            value={`$${summary.total_cost_usd.toFixed(4)}`}
            icon={
              <Coins weight="duotone" className="text-emerald-400" size={32} />
            }
            colorClass="border-emerald-500 shadow-[6px_6px_0_0_#10b981]"
          />
          <MetricCard
            title="Total Events"
            value={summary.total_events.toLocaleString()}
            icon={
              <ChartBar
                weight="duotone"
                className="text-indigo-400"
                size={32}
              />
            }
            colorClass="border-indigo-500 shadow-[6px_6px_0_0_#4f46e5]"
          />
          <MetricCard
            title="Total Tokens"
            value={summary.total_tokens.toLocaleString()}
            icon={
              <Database
                weight="duotone"
                className="text-fuchsia-400"
                size={32}
              />
            }
            colorClass="border-fuchsia-500 shadow-[6px_6px_0_0_#d946ef]"
          />
          <MetricCard
            title="Avg Latency"
            value={
              summary.avg_latency_ms
                ? `${summary.avg_latency_ms.toFixed(0)} ms`
                : "N/A"
            }
            icon={
              <Clock weight="duotone" className="text-amber-400" size={32} />
            }
            colorClass="border-amber-500 shadow-[6px_6px_0_0_#f59e0b]"
          />
        </section>
      )}

      {statsStatus === "succeeded" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          <div className="bg-[#141418] border-2 border-white/10 p-6 shadow-[8px_8px_0_0_rgba(99,102,241,0.1)]">
            <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Coins className="text-emerald-400" /> Cost Trend (Last 30 Days)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyUsage}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff10"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(str) => str.split("-").slice(1).join("/")}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(val) => `$${val}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a24",
                      border: "2px solid #ffffff10",
                      borderRadius: "0px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                    itemStyle={{ color: "#10b981" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total_cost_usd"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorCost)"
                    name="Cost (USD)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#141418] border-2 border-white/10 p-6 shadow-[8px_8px_0_0_rgba(168,85,247,0.1)]">
            <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <ChartBar className="text-indigo-400" /> Cost Distribution
            </h3>
            <div className="h-[300px] w-full flex flex-row">
              <ResponsiveContainer width="60%" height="100%">
                <PieChart>
                  <Pie
                    data={models}
                    dataKey="total_cost_usd"
                    nameKey="model"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                  >
                    {models.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        stroke="none"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1a1a24",
                      border: "2px solid #ffffff10",
                      borderRadius: "0px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-[40%] flex flex-col justify-center gap-2 overflow-y-auto pr-2">
                {models.slice(0, 7).map((m, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="size-3 flex-shrink-0"
                      style={{
                        backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                      }}
                    />
                    <span className="text-[10px] font-mono text-zinc-400 truncate">
                      {m.model}
                    </span>
                  </div>
                ))}
                {models.length > 7 && (
                  <span
                    className="text-[10px] font-mono text-zinc-600 pl-5"
                    title={`+${models.length - 7} more models`}
                  >
                    +{models.length - 7} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#141418] border-2 border-white/10 p-6 lg:col-span-2 shadow-[8px_8px_0_0_rgba(217,70,239,0.1)]">
            <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
              <Database className="text-fuchsia-400" /> Daily Token Volume
            </h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyUsage}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff10"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(str) => str.split("-").slice(1).join("/")}
                  />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(val) =>
                      val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "#ffffff05" }}
                    contentStyle={{
                      backgroundColor: "#1a1a24",
                      border: "2px solid #ffffff10",
                      borderRadius: "0px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }}
                  />
                  <Bar
                    dataKey="total_tokens"
                    fill="#d946ef"
                    radius={[2, 2, 0, 0]}
                    name="Total Tokens"
                  />
                  <Bar
                    dataKey="event_count"
                    fill="#6366f1"
                    radius={[2, 2, 0, 0]}
                    name="Requests"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {statsStatus === "succeeded" && models && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-wider">
            Usage By Model
          </h2>
          {models.length === 0 ? (
            <div className="bg-[#141418] border-2 border-white/10 p-8 text-zinc-500 font-mono">
              No models inferred in the last 30 days. Send events via the API to
              populate.
            </div>
          ) : (
            <div className="border-2 border-white/10 overflow-hidden bg-[#141418] shadow-[8px_8px_0_0_rgba(255,255,255,0.05)]">
              <table className="w-full text-left font-mono text-sm">
                <thead className="bg-[#1a1a24] border-b-2 border-white/10 text-zinc-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4 border-r-2 border-white/10">
                      Provider
                    </th>
                    <th className="px-6 py-4 border-r-2 border-white/10">
                      Model
                    </th>
                    <th className="px-6 py-4 border-r-2 border-white/10 text-right">
                      Events
                    </th>
                    <th className="px-6 py-4 border-r-2 border-white/10 text-right">
                      Tokens
                    </th>
                    <th className="px-6 py-4 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-white/10">
                  {models.map((m, i) => (
                    <tr
                      key={`${m.provider}-${m.model}-${i}`}
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 border-r-2 border-white/10 font-bold text-zinc-300">
                        {m.provider}
                      </td>
                      <td className="px-6 py-4 border-r-2 border-white/10 text-indigo-300">
                        {m.model}
                      </td>
                      <td className="px-6 py-4 border-r-2 border-white/10 text-right">
                        {m.event_count.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 border-r-2 border-white/10 text-right text-zinc-400">
                        {m.total_tokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-emerald-400 font-bold">
                        ${m.total_cost_usd.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  colorClass,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass: string;
}) {
  return (
    <div
      className={`bg-[#141418] border-2 p-6 flex flex-col justify-between h-40 ${colorClass}`}
    >
      <div className="flex justify-between items-start">
        <p className="text-zinc-400 font-bold uppercase tracking-wider text-xs">
          {title}
        </p>
        {icon}
      </div>
      <p className="text-3xl font-extrabold text-white">{value}</p>
    </div>
  );
}
