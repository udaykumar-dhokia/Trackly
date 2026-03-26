"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { fetchProjectMembers } from "@/lib/store/features/projectsSlice";
import {
  Wallet,
  Coins,
  Stack,
  Funnel,
  Users,
  DownloadSimple,
  FilePdf,
  WarningCircle,
  CaretRight,
} from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import Link from "next/link";

interface BudgetStatus {
  monthly_token_limit: number | null;
  monthly_cost_limit_usd: number | null;
  current_month_tokens: number;
  current_month_cost_usd: number;
  token_usage_percentage: number | null;
  cost_usage_percentage: number | null;
  token_remaining: number | null;
  cost_remaining_usd: number | null;
  status: string;
  updated_at: string | null;
}

interface UsageData {
  org_id: string;
  plan: string;
  current_month_usage: number;
  current_month_events: number;
  current_month_tokens: number;
  current_month_cost_usd: number;
  plan_limit: number;
  reset_date: string;
  budget: BudgetStatus | null;
}

export default function BudgetsPage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const {
    activeProjectId,
    activeOrgId,
    organizations,
    status: projectsStatus,
    members,
  } = useAppSelector((state) => state.projects);
  const activeOrg = organizations.find((o) => o.id === activeOrgId);
  const isOrgAdmin = activeOrg?.role === "admin" || activeOrg?.role === "owner";

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetCost, setBudgetCost] = useState("");
  const [budgetTokens, setBudgetTokens] = useState("");
  const [budgetMessage, setBudgetMessage] = useState<string | null>(null);

  // Export state
  const [providerFilter, setProviderFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("");
  const [featureFilter, setFeatureFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [exporting, setExporting] = useState<"analytics-csv" | "analytics-pdf" | "events-csv" | "events-pdf" | null>(null);

  useEffect(() => {
    if (activeProjectId) {
      dispatch(fetchProjectMembers(activeProjectId));
    }
  }, [activeProjectId, dispatch]);

  useEffect(() => {
    if (!activeOrgId) return;
    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/api/v1/organizations/${activeOrgId}/usage`)
      .then((res) => res.json())
      .then((data: UsageData) => {
        setUsage(data);
        setBudgetCost(
          data.budget?.monthly_cost_limit_usd != null
            ? String(data.budget.monthly_cost_limit_usd)
            : "",
        );
        setBudgetTokens(
          data.budget?.monthly_token_limit != null
            ? String(data.budget.monthly_token_limit)
            : "",
        );
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch usage:", err);
        setLoading(false);
      });
  }, [activeOrgId]);

  const refreshUsage = async () => {
    if (!activeOrgId) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${apiUrl}/api/v1/organizations/${activeOrgId}/usage`);
    if (!response.ok) throw new Error("Failed to refresh usage");
    const data = (await response.json()) as UsageData;
    setUsage(data);
  };

  const saveBudget = async () => {
    if (!activeOrgId || !user?.sub) return;
    setSavingBudget(true);
    setBudgetMessage(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiUrl}/api/v1/organizations/${activeOrgId}/budget?auth0_id=${encodeURIComponent(user.sub)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            monthly_cost_limit_usd: budgetCost.trim() ? Number(budgetCost) : null,
            monthly_token_limit: budgetTokens.trim() ? Number(budgetTokens) : null,
          }),
        },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to save budget");
      }
      await refreshUsage();
      setBudgetMessage("Budget saved.");
    } catch (error) {
      setBudgetMessage(error instanceof Error ? error.message : "Failed to save budget");
    } finally {
      setSavingBudget(false);
    }
  };

  const buildExportParams = () => {
    const queryParams = new URLSearchParams();
    if (providerFilter !== "all") queryParams.set("provider", providerFilter);
    if (memberFilter !== "all") queryParams.set("user_id", memberFilter);
    if (modelFilter.trim()) queryParams.set("model", modelFilter.trim());
    if (featureFilter.trim()) queryParams.set("feature", featureFilter.trim());
    const start = startDate ? `${startDate}T00:00:00.000Z` : undefined;
    const end = endDate ? (() => { const d = new Date(`${endDate}T00:00:00.000Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString(); })() : undefined;
    if (start) queryParams.set("start", start);
    if (end) queryParams.set("end", end);
    return queryParams;
  };

  const exportAnalytics = async (format: "csv" | "pdf") => {
    if (!activeProjectId) return;
    const key = `analytics-${format}` as const;
    setExporting(key);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const queryParams = buildExportParams();
      queryParams.set("format", format);
      const response = await fetch(
        `${apiUrl}/api/v1/projects/${activeProjectId}/stats/export?${queryParams.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to export analytics");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trackly-analytics.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const exportEvents = async (format: "csv" | "pdf") => {
    if (!activeProjectId) return;
    const key = `events-${format}` as const;
    setExporting(key);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const queryParams = buildExportParams();
      queryParams.set("format", format);
      const response = await fetch(
        `${apiUrl}/api/v1/projects/${activeProjectId}/events/export?${queryParams.toString()}`,
      );
      if (!response.ok) throw new Error("Failed to export events");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `trackly-events.${format}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
    } finally {
      setExporting(null);
    }
  };

  const budgetStatus = usage?.budget;
  const budgetPercent = Math.max(
    budgetStatus?.token_usage_percentage || 0,
    budgetStatus?.cost_usage_percentage || 0,
  );

  if (
    projectsStatus === "loading" ||
    (projectsStatus === "idle" && !activeProjectId)
  ) {
    return (
      <div className="p-8 font-mono text-zinc-500 animate-pulse">
        Initializing Budget Controls...
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center space-y-6 border-4 border-emerald-500 bg-[#141418] p-12 text-center shadow-[12px_12px_0_0_#10b981]">
        <WarningCircle size={64} weight="duotone" className="text-emerald-400" />
        <h1 className="text-3xl font-bold text-white">No Active Project</h1>
        <p className="max-w-lg font-mono text-zinc-400">
          Select or create a project to manage budgets and export data.
        </p>
        <Link
          href="/organizations"
          className="inline-flex items-center gap-2 border-2 border-black bg-emerald-500 px-6 py-3 font-bold text-black shadow-[4px_4px_0_0_#000000] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000000]"
        >
          Go to Organizations
          <CaretRight weight="bold" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="flex flex-col gap-2">
        <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight text-white">
          <Wallet weight="duotone" className="text-emerald-400" size={36} />
          Budgets &amp; Exports
        </h1>
        <p className="max-w-3xl font-mono text-sm leading-relaxed text-zinc-400">
          Manage monthly spend limits, track budget utilization, and export analytics or event data as CSV or PDF.
        </p>
      </section>

      {/* ── Budget Controls ── */}
      <section className="border-2 border-emerald-500/40 bg-[#141418] shadow-[8px_8px_0_0_rgba(16,185,129,0.12)]">
        <div className="border-b-2 border-emerald-500/30 bg-[#1a1a24] px-6 py-4">
          <h2 className="text-lg font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Coins className="text-emerald-400" size={22} weight="bold" />
            Budget Controls
          </h2>
        </div>
        <div className="space-y-6 p-6">
          {loading ? (
            <div className="h-40 animate-pulse border-2 border-white/10 bg-[#1a1a24]" />
          ) : usage ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Monthly Cost Budget (USD)
                  <input
                    value={budgetCost}
                    onChange={(e) => setBudgetCost(e.target.value)}
                    placeholder="e.g. 250"
                    disabled={!isOrgAdmin}
                    className="h-11 w-full border-2 border-white/10 bg-[#1a1a24] px-3 text-sm text-white outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Monthly Token Budget
                  <input
                    value={budgetTokens}
                    onChange={(e) => setBudgetTokens(e.target.value)}
                    placeholder="e.g. 5000000"
                    disabled={!isOrgAdmin}
                    className="h-11 w-full border-2 border-white/10 bg-[#1a1a24] px-3 text-sm text-white outline-none transition focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
              </div>

              <div className="border-2 border-white/10 bg-[#0f0f12] p-4">
                <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                  <span className="text-zinc-500">Budget Utilization</span>
                  <span
                    className={
                      budgetStatus?.status === "exceeded"
                        ? "text-red-400"
                        : budgetStatus?.status === "warning"
                          ? "text-amber-400"
                          : "text-emerald-400"
                    }
                  >
                    {budgetStatus ? `${budgetPercent.toFixed(1)}%` : "No budget"}
                  </span>
                </div>
                <div className="h-5 w-full overflow-hidden border-2 border-white/10 bg-[#1a1a24] p-0.5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(budgetPercent, 100)}%` }}
                    transition={{ duration: 1, ease: "circOut" }}
                    className={`h-full ${
                      budgetStatus?.status === "exceeded"
                        ? "bg-red-500"
                        : budgetStatus?.status === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                  />
                </div>
                <div className="mt-4 grid gap-3 text-sm text-white md:grid-cols-2">
                  <BudgetStat
                    label="Cost"
                    value={
                      budgetStatus?.monthly_cost_limit_usd != null
                        ? `$${usage.current_month_cost_usd.toFixed(4)} / $${budgetStatus.monthly_cost_limit_usd.toFixed(2)}`
                        : "Not configured"
                    }
                    helper={
                      budgetStatus?.cost_remaining_usd != null
                        ? `$${budgetStatus.cost_remaining_usd.toFixed(4)} remaining`
                        : "Set a cost ceiling to track spend against budget."
                    }
                  />
                  <BudgetStat
                    label="Tokens"
                    value={
                      budgetStatus?.monthly_token_limit != null
                        ? `${usage.current_month_tokens.toLocaleString()} / ${budgetStatus.monthly_token_limit.toLocaleString()}`
                        : "Not configured"
                    }
                    helper={
                      budgetStatus?.token_remaining != null
                        ? `${budgetStatus.token_remaining.toLocaleString()} tokens remaining`
                        : "Set a token ceiling to track volume against budget."
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-xs text-zinc-500">
                  Leave either field empty to disable that budget threshold.
                </p>
                <button
                  onClick={saveBudget}
                  disabled={!isOrgAdmin || savingBudget}
                  className="border-2 border-emerald-500 bg-emerald-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-black shadow-[4px_4px_0_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingBudget ? "Saving..." : "Save Budget"}
                </button>
              </div>
              {budgetMessage && (
                <p className="text-xs font-medium text-zinc-400">{budgetMessage}</p>
              )}
            </>
          ) : (
            <div className="py-12 text-center font-mono text-zinc-500">
              Failed to load budget data. Try again later.
            </div>
          )}
        </div>
      </section>

      {/* ── Export Section ── */}
      <section className="border-2 border-indigo-500/40 bg-[#141418] shadow-[8px_8px_0_0_rgba(99,102,241,0.12)]">
        <div className="border-b-2 border-indigo-500/30 bg-[#1a1a24] px-6 py-4">
          <h2 className="text-lg font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <DownloadSimple className="text-indigo-400" size={22} weight="bold" />
            Export Data
          </h2>
        </div>
        <div className="space-y-6 p-6">
          <p className="font-mono text-xs text-zinc-500">
            Apply filters and export your analytics summary or raw events as CSV or PDF.
          </p>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-[180px] items-center gap-3 border-2 border-white/10 bg-[#1a1a24] px-4 py-2">
              <Funnel size={20} className="text-zinc-400" />
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-auto w-full border-none bg-none px-0 text-sm font-bold font-mono text-white shadow-none focus:ring-0 data-[state=open]:bg-transparent">
                  <SelectValue placeholder="All Providers" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-white/10 bg-[#1a1a24] font-mono text-white">
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
            </div>

            <div className="flex min-w-[180px] items-center gap-3 border-2 border-white/10 bg-[#1a1a24] px-4 py-2">
              <Users size={20} className="text-zinc-400" />
              <Select value={memberFilter} onValueChange={setMemberFilter}>
                <SelectTrigger className="h-auto w-full border-none bg-none px-0 text-sm font-bold font-mono text-white shadow-none focus:ring-0 data-[state=open]:bg-transparent">
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent className="rounded-none border-2 border-white/10 bg-[#1a1a24] font-mono text-white">
                  <SelectItem value="all">All Members</SelectItem>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <input
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="Filter model"
              className="h-[44px] min-w-[170px] border-2 border-white/10 bg-[#1a1a24] px-3 text-sm text-white outline-none transition focus:border-indigo-400"
            />
            <input
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              placeholder="Filter feature"
              className="h-[44px] min-w-[170px] border-2 border-white/10 bg-[#1a1a24] px-3 text-sm text-white outline-none transition focus:border-indigo-400"
            />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-[44px] border-2 border-white/10 bg-[#1a1a24] px-3 text-sm text-white outline-none transition focus:border-white/30"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-[44px] border-2 border-white/10 bg-[#1a1a24] px-3 text-sm text-white outline-none transition focus:border-white/30"
            />
          </div>

          {/* Export Buttons */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 border-2 border-white/10 bg-[#0f0f12] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Analytics Report
              </h3>
              <p className="font-mono text-[11px] text-zinc-600">
                Model-level cost, token, and latency summary for the active project.
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => exportAnalytics("csv")}
                  disabled={exporting !== null}
                  className="flex flex-1 items-center justify-center gap-2 border-2 border-emerald-500/50 bg-[#1a1a24] px-3 py-2.5 text-sm font-bold text-emerald-300 shadow-[4px_4px_0_0_rgba(16,185,129,0.15)] transition-colors hover:bg-white/5 disabled:opacity-60"
                >
                  <DownloadSimple size={18} weight="bold" />
                  {exporting === "analytics-csv" ? "Exporting..." : "CSV"}
                </button>
                <button
                  onClick={() => exportAnalytics("pdf")}
                  disabled={exporting !== null}
                  className="flex flex-1 items-center justify-center gap-2 border-2 border-rose-500/50 bg-[#1a1a24] px-3 py-2.5 text-sm font-bold text-rose-300 shadow-[4px_4px_0_0_rgba(244,63,94,0.15)] transition-colors hover:bg-white/5 disabled:opacity-60"
                >
                  <FilePdf size={18} weight="bold" />
                  {exporting === "analytics-pdf" ? "Exporting..." : "PDF"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-2 border-white/10 bg-[#0f0f12] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Events Export
              </h3>
              <p className="font-mono text-[11px] text-zinc-600">
                Raw telemetry event stream for audit, compliance, and review.
              </p>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => exportEvents("csv")}
                  disabled={exporting !== null}
                  className="flex flex-1 items-center justify-center gap-2 border-2 border-emerald-500/50 bg-[#1a1a24] px-3 py-2.5 text-sm font-bold text-emerald-300 shadow-[4px_4px_0_0_rgba(16,185,129,0.15)] transition-colors hover:bg-white/5 disabled:opacity-60"
                >
                  <DownloadSimple size={18} weight="bold" />
                  {exporting === "events-csv" ? "Exporting..." : "CSV"}
                </button>
                <button
                  onClick={() => exportEvents("pdf")}
                  disabled={exporting !== null}
                  className="flex flex-1 items-center justify-center gap-2 border-2 border-rose-500/50 bg-[#1a1a24] px-3 py-2.5 text-sm font-bold text-rose-300 shadow-[4px_4px_0_0_rgba(244,63,94,0.15)] transition-colors hover:bg-white/5 disabled:opacity-60"
                >
                  <FilePdf size={18} weight="bold" />
                  {exporting === "events-pdf" ? "Exporting..." : "PDF"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function BudgetStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="border border-white/10 bg-[#1a1a24] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-zinc-500">{helper}</p>
    </div>
  );
}
