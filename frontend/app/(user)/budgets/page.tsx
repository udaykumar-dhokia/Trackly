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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const filterInputClass =
  "h-10 border-2 border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition rounded-xl focus:border-white/30 placeholder:text-zinc-600 w-full";

const selectTriggerClass =
  "h-10 w-full border-2 border-white/10 bg-[#141418] px-3 text-xs font-mono font-bold text-white shadow-none rounded-xl focus:ring-0 focus:border-white/30 outline-none";

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
      <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center space-y-6 rounded-xl border border-white/10 bg-[#141418] p-12 text-center">
        <WarningCircle size={64} weight="duotone" className="text-white" />
        <h1 className="text-3xl font-bold text-white">No Active Project</h1>
        <p className="max-w-lg font-mono text-zinc-400">
          Select or create a project to manage budgets and export data.
        </p>
        <Button
          className="bg-white/20"
        >
          <Link
            href="/organizations"
            className="inline-flex items-center gap-2 px-6 py-3 font-bold text-white"
          >
            Go to Organizations
            <CaretRight weight="bold" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <section className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">
          Budgets &amp; Exports
        </h1>
        <p className="font-mono text-sm text-zinc-500">
          Manage monthly spend limits and export analytics or event data.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">

        {/* Budget Controls */}
        <section className="flex flex-col rounded-xl border border-white/8 bg-[#141418] overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-white/8 bg-[#0f0f12] px-5 py-4">
            <h2 className="text-sm font-bold tracking-wide text-white">Budget Controls</h2>
          </div>

          <div className="flex flex-col gap-5 p-5">
            {loading ? (
              <div className="h-40 animate-pulse rounded-xl bg-white/5" />
            ) : usage ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Monthly Cost (USD)
                    </span>
                    <input
                      value={budgetCost}
                      onChange={(e) => setBudgetCost(e.target.value)}
                      placeholder="e.g. 250"
                      disabled={!isOrgAdmin}
                      className="h-9 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm font-mono text-white outline-none transition focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      Monthly Tokens
                    </span>
                    <input
                      value={budgetTokens}
                      onChange={(e) => setBudgetTokens(e.target.value)}
                      placeholder="e.g. 5000000"
                      disabled={!isOrgAdmin}
                      className="h-9 w-full rounded-lg border border-white/10 bg-[#0f0f12] px-3 text-sm font-mono text-white outline-none transition focus:border-emerald-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </label>
                </div>

                {/* Utilization bar */}
                <div className="rounded-xl border border-white/8 bg-[#0f0f12] p-4">
                  <div className="mb-2.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-zinc-500">Utilization</span>
                    <span
                      className={
                        budgetStatus?.status === "exceeded"
                          ? "text-red-400"
                          : budgetStatus?.status === "warning"
                            ? "text-amber-400"
                            : "text-emerald-400"
                      }
                    >
                      {budgetStatus ? `${budgetPercent.toFixed(1)}%` : "No budget set"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(budgetPercent, 100)}%` }}
                      transition={{ duration: 1, ease: "circOut" }}
                      className={`h-full rounded-full ${budgetStatus?.status === "exceeded"
                        ? "bg-red-500"
                        : budgetStatus?.status === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                        }`}
                    />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                          : "Set a cost ceiling"
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
                          ? `${budgetStatus.token_remaining.toLocaleString()} remaining`
                          : "Set a token ceiling"
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  {budgetMessage ? (
                    <p className="text-xs font-mono text-zinc-400">{budgetMessage}</p>
                  ) : (
                    <p className="text-xs text-zinc-600">Leave empty to disable a threshold.</p>
                  )}
                  <Button
                    onClick={saveBudget}
                    disabled={!isOrgAdmin || savingBudget}
                    variant="outline"
                  >
                    {savingBudget ? "Saving…" : "Save Budget"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="py-12 text-center font-mono text-xs text-zinc-500">
                Failed to load budget data.
              </div>
            )}
          </div>
        </section>

        {/* Export Data */}
        <section className="flex flex-col rounded-xl border border-white/8 bg-[#141418] overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-white/8 bg-[#0f0f12] px-5 py-4">
            <h2 className="text-sm font-bold tracking-wide text-white">Export Data</h2>
          </div>

          <div className="flex flex-col gap-5 p-5">
            <p className="font-mono text-xs text-zinc-500">
              Apply filters then export analytics or raw events as CSV or PDF.
            </p>

            <div className="rounded-xl border-2 border-white/10 bg-[#1a1a24] p-4 shadow-sm">
              <div className="mb-3.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                <Funnel size={13} weight="bold" />
                Filters
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={providerFilter} onValueChange={setProviderFilter}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-white/10 bg-[#1a1a24] font-mono text-white">
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
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-white/10 bg-[#1a1a24] font-mono text-white">
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
                  className={filterInputClass}
                />
                <Input
                  value={featureFilter}
                  onChange={(e) => setFeatureFilter(e.target.value)}
                  placeholder="Feature"
                  className={filterInputClass}
                />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={filterInputClass}
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={filterInputClass}
                />
              </div>
            </div>

            {/* Export Buttons */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-[#0f0f12] p-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Analytics Report
                  </h3>
                  <p className="mt-1 font-mono text-[11px] text-zinc-600">
                    Cost, token &amp; latency summary.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => exportAnalytics("csv")}
                    disabled={exporting !== null}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                  >
                    <DownloadSimple size={14} weight="bold" />
                    {exporting === "analytics-csv" ? "…" : "CSV"}
                  </Button>
                  <Button
                    onClick={() => exportAnalytics("pdf")}
                    disabled={exporting !== null}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/8 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
                  >
                    <FilePdf size={14} weight="bold" />
                    {exporting === "analytics-pdf" ? "…" : "PDF"}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-white/8 bg-[#0f0f12] p-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    Events Export
                  </h3>
                  <p className="mt-1 font-mono text-[11px] text-zinc-600">
                    Raw telemetry for audit &amp; review.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => exportEvents("csv")}
                    disabled={exporting !== null}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/8 px-3 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/15 disabled:opacity-50"
                  >
                    <DownloadSimple size={14} weight="bold" />
                    {exporting === "events-csv" ? "…" : "CSV"}
                  </Button>
                  <Button
                    onClick={() => exportEvents("pdf")}
                    disabled={exporting !== null}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/8 px-3 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/15 disabled:opacity-50"
                  >
                    <FilePdf size={14} weight="bold" />
                    {exporting === "events-pdf" ? "…" : "PDF"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
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
    <div className="rounded-lg border border-white/8 bg-[#141418] px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
        {label}
      </p>
      <p className="mt-0.5 text-xs font-bold text-white">{value}</p>
      <p className="mt-0.5 text-[11px] text-zinc-600">{helper}</p>
    </div>
  );
}