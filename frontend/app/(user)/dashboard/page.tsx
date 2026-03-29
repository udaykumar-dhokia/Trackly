"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { fetchDashboardStats } from "@/lib/store/features/statsSlice";
import {
  fetchProjectMembers,
  fetchProjects,
} from "@/lib/store/features/projectsSlice";
import {
  Coins,
  Database,
  ChartBar,
  Clock,
  WarningCircle,
  CaretRight,
  Funnel,
  ArrowClockwise,
  Users,
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CHART_COLORS = ["#6366f1", "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#f97316", "#eab308"];

export default function DashboardPage() {
  const dispatch = useAppDispatch();
  const {
    items: projects,
    activeProjectId,
    status: projectsStatus,
    activeOrgId,
    members,
  } = useAppSelector((state) => state.projects);
  const {
    summary,
    models,
    dailyUsage,
    status: statsStatus,
    error: statsError,
    lastFetchedParams,
  } = useAppSelector((state) => state.stats);

  const [providerFilter, setProviderFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("");
  const [featureFilter, setFeatureFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");


  useEffect(() => {
    if (activeOrgId && projectsStatus === "idle") {
      dispatch(fetchProjects(activeOrgId));
    }
  }, [activeOrgId, projectsStatus, dispatch]);

  useEffect(() => {
    if (activeProjectId) {
      dispatch(fetchProjectMembers(activeProjectId));
    }
  }, [activeProjectId, dispatch]);

  useEffect(() => {
    if (!activeProjectId) return;

    const model = modelFilter.trim() || undefined;
    const feature = featureFilter.trim() || undefined;
    const start = toStartIso(startDate);
    const end = toEndExclusiveIso(endDate);
    const needsFetch =
      !lastFetchedParams ||
      lastFetchedParams.projectId !== activeProjectId ||
      lastFetchedParams.provider !== providerFilter ||
      lastFetchedParams.userId !== memberFilter ||
      lastFetchedParams.model !== model ||
      lastFetchedParams.feature !== feature ||
      lastFetchedParams.start !== start ||
      lastFetchedParams.end !== end;

    if (needsFetch) {
      dispatch(
        fetchDashboardStats({
          projectId: activeProjectId,
          provider: providerFilter,
          userId: memberFilter,
          model,
          feature,
          start,
          end,
        }),
      );
    }
  }, [
    activeProjectId,
    providerFilter,
    memberFilter,
    modelFilter,
    featureFilter,
    startDate,
    endDate,
    dispatch,
    lastFetchedParams,
  ]);

  const refreshStats = () => {
    if (!activeProjectId) return;
    dispatch(
      fetchDashboardStats({
        projectId: activeProjectId,
        provider: providerFilter,
        userId: memberFilter,
        model: modelFilter.trim() || undefined,
        feature: featureFilter.trim() || undefined,
        start: toStartIso(startDate),
        end: toEndExclusiveIso(endDate),
      }),
    );
  };



  if (
    projectsStatus === "loading" ||
    (projectsStatus === "idle" && !activeProjectId)
  ) {
    return (
      <div className="p-8 font-mono text-zinc-500 animate-pulse">
        Initializing Dashboard...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center space-y-6 border-2 border-white/10 bg-[#141418] p-12 text-center rounded-xl">
        <WarningCircle size={64} weight="duotone" className="text-white" />
        <h1 className="text-3xl font-bold text-white">No Projects Found</h1>
        <p className="max-w-lg font-mono text-zinc-400">
          You need a project to start tracking your AI costs and usage. Projects
          isolate your LLM tracking environments.
        </p>
        <Button
          className="bg-white/20"
        >
          <Link
            href="/organizations"
            className="inline-flex items-center gap-2 px-6 py-3 font-bold text-white"
          >
            Create Your First Project
            <CaretRight weight="bold" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Overview
            </h1>
            <p className="max-w-2xl font-mono text-sm leading-relaxed text-zinc-400">
              Aggregated analytics across the filtered execution window.
            </p>
          </div>
          <button
            onClick={refreshStats}
            disabled={statsStatus === "loading"}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-zinc-400 transition-colors cursor-pointer hover:text-white disabled:opacity-50"
            title="Reload Dashboard Stats"
          >
            <ArrowClockwise
              weight="bold"
              size={20}
              className={statsStatus === "loading" ? "animate-spin" : ""}
            />
          </button>
        </div>

        <div className="rounded-xl pt-2 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            <Funnel size={14} weight="bold" />
            Filters
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-2 border-white/10 bg-[#141418] px-3 text-xs font-mono font-bold text-white shadow-none outline-none ring-0 focus:ring-0 focus:border-white/20">
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-white/10 bg-[#1a1a24] font-mono text-white">
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="mistral">Mistral</SelectItem>
                <SelectItem value="cohere">Cohere</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>

            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-2 border-white/10 bg-[#141418] px-3 text-xs font-mono font-bold text-white shadow-none outline-none ring-0 focus:ring-0 focus:border-white/20">
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-white/10 bg-[#1a1a24] font-mono text-white">
                <SelectItem value="all">All Members</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="Model"
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-indigo-400"
            />
            <Input
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              placeholder="Feature"
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-fuchsia-400"
            />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-white/30"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-white/30"
            />
          </div>
        </div>
      </section>

      {statsStatus === "loading" && (
        <div className="border-2 border-white/10 bg-[#141418] p-8 font-mono text-indigo-400 animate-pulse shadow-[6px_6px_0_0_#818cf8]">
          Computing analytics matrix...
        </div>
      )}
      {statsStatus === "failed" && (
        <div className="border-2 border-red-500/50 bg-[#141418] p-8 font-mono text-red-500 shadow-[6px_6px_0_0_#ef4444]">
          Error: {statsError}
        </div>
      )}

      {statsStatus === "succeeded" && summary && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Estimated Cost"
            value={`$${summary.total_cost_usd.toFixed(4)}`}
            icon={<Coins weight="duotone" className="text-emerald-400" size={32} />}
            colorClass="border-emerald-500 rounded-xl shadow-[6px_6px_0_0_#10b981]"
          />
          <MetricCard
            title="Total Events"
            value={summary.total_events.toLocaleString()}
            icon={<ChartBar weight="duotone" className="text-indigo-400" size={32} />}
            colorClass="border-indigo-500 rounded-xl shadow-[6px_6px_0_0_#4f46e5]"
          />
          <MetricCard
            title="Total Tokens"
            value={summary.total_tokens.toLocaleString()}
            icon={<Database weight="duotone" className="text-fuchsia-400" size={32} />}
            colorClass="border-fuchsia-500 rounded-xl shadow-[6px_6px_0_0_#d946ef]"
          />
          <MetricCard
            title="Avg Latency"
            value={summary.avg_latency_ms ? `${summary.avg_latency_ms.toFixed(0)} ms` : "N/A"}
            icon={<Clock weight="duotone" className="text-amber-400" size={32} />}
            colorClass="border-amber-500 rounded-xl shadow-[6px_6px_0_0_#f59e0b]"
          />
        </section>
      )}

      {statsStatus === "succeeded" && (
        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="border-2 border-white/10 bg-[#141418] p-6 rounded-xl">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-white">
              <Coins className="text-emerald-400" /> Cost Trend
            </h3>
            <div className="h-[300px] w-full rounded-xl">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyUsage}>
                  <defs>
                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickFormatter={(str) => str.split("-").slice(1).join("/")} />
                  <YAxis stroke="#71717a" fontSize={12} tickFormatter={(val) => `$${val}`} />
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

          <div className="border-2 border-white/10 bg-[#141418] p-6 rounded-xl">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-white">
              <ChartBar className="text-indigo-400" /> Cost Distribution
            </h3>
            <div className="flex h-[300px] w-full flex-row">
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
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
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
              <div className="flex w-[40%] flex-col justify-center gap-2 overflow-y-auto pr-2">
                {models.slice(0, 7).map((model, index) => (
                  <div key={`${model.provider}-${model.model}-${index}`} className="flex items-center gap-2">
                    <div
                      className="size-3 shrink-0"
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="truncate font-mono text-[10px] text-zinc-400">{model.model}</span>
                  </div>
                ))}
                {models.length > 7 && (
                  <span className="pl-5 font-mono text-[10px] text-zinc-600" title={`+${models.length - 7} more models`}>
                    +{models.length - 7} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-2 border-white/10 bg-[#141418] p-6 rounded-xl lg:col-span-2">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold uppercase tracking-wider text-white">
              <Database className="text-fuchsia-400" /> Daily Token Volume
            </h3>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyUsage}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={12} tickFormatter={(str) => str.split("-").slice(1).join("/")} />
                  <YAxis
                    stroke="#71717a"
                    fontSize={12}
                    tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val)}
                  />
                  <Tooltip
                    cursor={{ fill: "#ffffff05" }}
                    contentStyle={{
                      backgroundColor: "#1a1a24",
                      border: "2px solid #ffffff10",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "20px", fontSize: "12px" }} />
                  <Bar dataKey="total_tokens" fill="#d946ef" radius={[2, 2, 0, 0]} name="Total Tokens" />
                  <Bar dataKey="event_count" fill="#6366f1" radius={[2, 2, 0, 0]} name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {statsStatus === "succeeded" && (
        <section className="mt-12">
          <h2 className="mb-6 text-2xl font-bold uppercase tracking-wider text-white">
            Usage By Model
          </h2>
          {models.length === 0 ? (
            <div className="border-2 border-white/10 bg-[#141418] p-8 font-mono text-zinc-500 rounded-xl">
              No models matched the current filters.
            </div>
          ) : (
            <div className="overflow-hidden border-2 border-white/10 bg-[#141418] rounded-xl">
              <table className="w-full text-left font-mono text-sm">
                <thead className="border-b-2 border-white/10 bg-[#1a1a24] text-xs uppercase text-zinc-400">
                  <tr>
                    <th className="border-r-2 border-white/10 px-6 py-4">Provider</th>
                    <th className="border-r-2 border-white/10 px-6 py-4">Model</th>
                    <th className="border-r-2 border-white/10 px-6 py-4 text-right">Events</th>
                    <th className="border-r-2 border-white/10 px-6 py-4 text-right">Tokens</th>
                    <th className="px-6 py-4 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-white/10">
                  {models.map((model, index) => (
                    <tr key={`${model.provider}-${model.model}-${index}`} className="transition-colors hover:bg-white/5">
                      <td className="border-r-2 border-white/10 px-6 py-4 font-bold text-zinc-300">{model.provider}</td>
                      <td className="border-r-2 border-white/10 px-6 py-4 text-indigo-300">{model.model}</td>
                      <td className="border-r-2 border-white/10 px-6 py-4 text-right">{model.event_count.toLocaleString()}</td>
                      <td className="border-r-2 border-white/10 px-6 py-4 text-right text-zinc-400">{model.total_tokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-400">${model.total_cost_usd.toFixed(4)}</td>
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

function toStartIso(value: string) {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

function toEndExclusiveIso(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
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
    <div className={`flex h-40 flex-col justify-between border-2 bg-[#141418] p-6 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{title}</p>
        {icon}
      </div>
      <p className="text-3xl font-extrabold text-white">{value}</p>
    </div>
  );
}
