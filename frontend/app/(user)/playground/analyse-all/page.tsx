"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowsClockwise,
  Coins,
  Lightning,
  TrendDown,
  TrendUp,
  WarningCircle,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/lib/store/hooks";
import {
  decodeModelKey,
  encodeModelKey,
  formatDateInput,
  requestCompareAll,
  type Mode,
  type PlaygroundCompareAllItem,
  type PlaygroundCompareAllResponse,
  type PlaygroundOptions,
} from "@/lib/playground";

const surfaceClass = "rounded-xl border border-white/10 bg-[#0a0a0a]";
const labelClass = "text-xs font-medium tracking-tight text-zinc-400";
const selectTriggerClass =
  "flex h-9 w-full items-center justify-between rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 shadow-sm ring-offset-background placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1";
const inputClass =
  "flex h-9 w-full rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50";

function formatCurrency(value: number) {
  if (Math.abs(value) >= 100) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatSignedCurrency(value: number) {
  if (value === 0) return "$0.0000";
  return `${value > 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function formatPercent(value: number | null) {
  if (value == null) return "n/a";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatRate(value: number | null) {
  if (value == null) return "n/a";
  return `${formatCurrency(value)}/1K`;
}

function modelLabel(provider: string, model: string) {
  return `${provider} / ${model}`;
}

export default function AnalyseAllPlaygroundPage() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeProjectId, status: projectsStatus } = useAppSelector(
    (state) => state.projects,
  );

  const [options, setOptions] = useState<PlaygroundOptions | null>(null);
  const [result, setResult] = useState<PlaygroundCompareAllResponse | null>(
    null,
  );
  const [mode, setMode] = useState<Mode>("historical");
  const [sourceKey, setSourceKey] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [trafficMultiplier, setTrafficMultiplier] = useState("1");
  const [requestCount, setRequestCount] = useState("10000");
  const [avgPromptTokens, setAvgPromptTokens] = useState("1200");
  const [avgCompletionTokens, setAvgCompletionTokens] = useState("350");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const queryString = searchParams.toString();

  const queryState = useMemo(() => {
    const params = new URLSearchParams(queryString);
    return {
      sourceProvider: params.get("source_provider") || "",
      sourceModel: params.get("source_model") || "",
      mode: (params.get("mode") === "manual" ? "manual" : "historical") as Mode,
      start: params.get("start") || "",
      end: params.get("end") || "",
      trafficMultiplier: params.get("traffic_multiplier") || "1",
      requestCount: params.get("request_count") || "10000",
      avgPromptTokens: params.get("avg_prompt_tokens") || "1200",
      avgCompletionTokens: params.get("avg_completion_tokens") || "350",
    };
  }, [queryString]);

  const sourceSelectItems = useMemo(() => {
    if (!options) return [];
    if (mode === "historical" && options.recent_models.length > 0) {
      return options.recent_models.map((entry) => ({
        key: encodeModelKey(entry.provider, entry.model),
        label: modelLabel(entry.provider, entry.model),
      }));
    }
    return options.catalog.map((entry) => ({
      key: encodeModelKey(entry.provider, entry.model),
      label: modelLabel(entry.provider, entry.model),
    }));
  }, [mode, options]);

  const runAnalysis = useCallback(
    async ({
      projectId = activeProjectId,
      auth0Id = user?.sub || "",
      nextMode = mode,
      nextSourceKey = sourceKey,
      nextStartDate = startDate,
      nextEndDate = endDate,
      nextTrafficMultiplier = trafficMultiplier,
      nextRequestCount = requestCount,
      nextAvgPromptTokens = avgPromptTokens,
      nextAvgCompletionTokens = avgCompletionTokens,
    }: {
      projectId?: string | null;
      auth0Id?: string;
      nextMode?: Mode;
      nextSourceKey?: string;
      nextStartDate?: string;
      nextEndDate?: string;
      nextTrafficMultiplier?: string;
      nextRequestCount?: string;
      nextAvgPromptTokens?: string;
      nextAvgCompletionTokens?: string;
    } = {}) => {
      if (!projectId || !auth0Id || !nextSourceKey) return;

      const source = decodeModelKey(nextSourceKey);

      setRunningAnalysis(true);
      setError(null);
      try {
        const body =
          nextMode === "historical"
            ? {
                source_provider: source.provider,
                source_model: source.model,
                mode: "historical",
                start: nextStartDate
                  ? `${nextStartDate}T00:00:00.000Z`
                  : undefined,
                end: nextEndDate ? `${nextEndDate}T23:59:59.999Z` : undefined,
                traffic_multiplier: Number(nextTrafficMultiplier) || 1,
              }
            : {
                source_provider: source.provider,
                source_model: source.model,
                mode: "manual",
                traffic_multiplier: 1,
                request_count: Number(nextRequestCount) || 1,
                avg_prompt_tokens: Number(nextAvgPromptTokens) || 0,
                avg_completion_tokens: Number(nextAvgCompletionTokens) || 0,
              };

        setResult(
          await requestCompareAll({
            apiUrl,
            projectId,
            auth0Id,
            body,
          }),
        );
      } catch (analysisError) {
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : "Full analysis failed",
        );
      } finally {
        setRunningAnalysis(false);
      }
    },
    [
      activeProjectId,
      apiUrl,
      avgCompletionTokens,
      avgPromptTokens,
      endDate,
      mode,
      requestCount,
      sourceKey,
      startDate,
      trafficMultiplier,
      user?.sub,
    ],
  );

  useEffect(() => {
    if (!activeProjectId || !user?.sub) return;

    let cancelled = false;
    const load = async () => {
      setLoadingOptions(true);
      setError(null);
      try {
        const response = await fetch(
          `${apiUrl}/api/v1/projects/${activeProjectId}/playground/options?auth0_id=${encodeURIComponent(user.sub)}`,
        );
        if (!response.ok) {
          throw new Error("Failed to load playground options");
        }

        const payload = (await response.json()) as PlaygroundOptions;
        if (cancelled) return;

        const initialMode = queryState.mode;
        const requestedSource =
          queryState.sourceProvider && queryState.sourceModel
            ? encodeModelKey(queryState.sourceProvider, queryState.sourceModel)
            : "";
        const availableKeys = new Set(
          initialMode === "historical" && payload.recent_models.length > 0
            ? payload.recent_models.map((entry) =>
                encodeModelKey(entry.provider, entry.model),
              )
            : payload.catalog.map((entry) =>
                encodeModelKey(entry.provider, entry.model),
              ),
        );
        const defaultSource = payload.recent_models[0]
          ? encodeModelKey(
              payload.recent_models[0].provider,
              payload.recent_models[0].model,
            )
          : payload.catalog[0]
            ? encodeModelKey(
                payload.catalog[0].provider,
                payload.catalog[0].model,
              )
            : "";
        const initialSource =
          requestedSource && availableKeys.has(requestedSource)
            ? requestedSource
            : defaultSource;
        const initialStart =
          queryState.start || formatDateInput(payload.default_start);
        const initialEnd =
          queryState.end || formatDateInput(payload.default_end);

        setOptions(payload);
        setMode(initialMode);
        setSourceKey(initialSource);
        setStartDate(initialStart);
        setEndDate(initialEnd);
        setTrafficMultiplier(queryState.trafficMultiplier);
        setRequestCount(queryState.requestCount);
        setAvgPromptTokens(queryState.avgPromptTokens);
        setAvgCompletionTokens(queryState.avgCompletionTokens);

        if (initialSource) {
          const source = decodeModelKey(initialSource);
          const body =
            initialMode === "historical"
              ? {
                  source_provider: source.provider,
                  source_model: source.model,
                  mode: "historical",
                  start: initialStart
                    ? `${initialStart}T00:00:00.000Z`
                    : undefined,
                  end: initialEnd ? `${initialEnd}T23:59:59.999Z` : undefined,
                  traffic_multiplier: Number(queryState.trafficMultiplier) || 1,
                }
              : {
                  source_provider: source.provider,
                  source_model: source.model,
                  mode: "manual",
                  traffic_multiplier: 1,
                  request_count: Number(queryState.requestCount) || 1,
                  avg_prompt_tokens: Number(queryState.avgPromptTokens) || 0,
                  avg_completion_tokens:
                    Number(queryState.avgCompletionTokens) || 0,
                };

          setRunningAnalysis(true);
          try {
            const analysis = await requestCompareAll({
              apiUrl,
              projectId: activeProjectId,
              auth0Id: user.sub,
              body,
            });
            if (!cancelled) {
              setResult(analysis);
            }
          } finally {
            if (!cancelled) {
              setRunningAnalysis(false);
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load full analysis",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingOptions(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, apiUrl, queryState, user?.sub]);

  useEffect(() => {
    if (!options || sourceSelectItems.length === 0) return;
    const sourceExists = sourceSelectItems.some(
      (item) => item.key === sourceKey,
    );
    if (!sourceExists) {
      setSourceKey(sourceSelectItems[0].key);
    }
  }, [options, sourceKey, sourceSelectItems]);

  const currentRow =
    result?.comparisons.find((item) => item.is_source_model) || null;
  const bestAlternative =
    result?.comparisons.find((item) => !item.is_source_model) || null;
  const topComparisons = result?.comparisons.slice(0, 3) || [];

  if (
    projectsStatus === "loading" ||
    (projectsStatus === "idle" && !activeProjectId)
  ) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-sm text-zinc-500 animate-pulse">
        Initializing Analysis...
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="mx-auto mt-12 flex max-w-[500px] flex-col items-center justify-center space-y-4 rounded-xl border border-white/10 bg-[#0a0a0a] p-10 text-center shadow-sm">
        <WarningCircle size={48} weight="regular" className="text-zinc-500" />
        <h1 className="text-xl font-semibold text-white">No Active Project</h1>
        <p className="font-sans text-sm text-zinc-400">
          Select a project before opening full model analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col space-y-8 pb-10">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/playground")}
                className="cursor-pointer inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft size={14} weight="regular" />
                Back to Playground
              </button>
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                Model Analysis
              </h1>
              <p className="max-w-3xl text-sm font-medium text-zinc-400">
                Compare the current model against the full pricing catalog using
                the same traffic shape and controls from the playground.
              </p>
            </div>
          </div>
          <Button
            onClick={() => void runAnalysis()}
            disabled={runningAnalysis || !sourceKey}
            className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
          >
            <ArrowsClockwise
              size={16}
              weight="regular"
              className={runningAnalysis ? "animate-spin" : ""}
            />
            Refresh Analysis
          </Button>
        </div>
      </section>

      <div className="grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Current Spend"
          value={result ? formatCurrency(result.source.total_cost_usd) : "--"}
          tone="neutral"
          icon={<Coins weight="regular" size={18} className="text-zinc-500" />}
        />
        <MetricCard
          label="Best Alternative"
          value={
            bestAlternative ? (
              <div className="flex flex-col">
                <span className="text-base font-semibold text-white">
                  {bestAlternative.provider}
                </span>
                <span className="text-xs font-medium text-zinc-400">
                  {bestAlternative.model}
                </span>
              </div>
            ) : (
              "--"
            )
          }
          tone="neutral"
          icon={
            <TrendDown
              weight="regular"
              size={18}
              className="text-emerald-400"
            />
          }
        />
        <MetricCard
          label="Potential Savings"
          value={
            bestAlternative ? formatCurrency(bestAlternative.savings_usd) : "--"
          }
          tone={
            bestAlternative && bestAlternative.savings_usd > 0
              ? "success"
              : "neutral"
          }
          icon={
            bestAlternative && bestAlternative.savings_usd > 0 ? (
              <TrendDown
                weight="regular"
                size={18}
                className="text-emerald-400"
              />
            ) : (
              <TrendUp weight="regular" size={18} className="text-zinc-500" />
            )
          }
        />
        <MetricCard
          label="Models Compared"
          value={
            result
              ? `${result.comparisons.length}`
              : options
                ? `${options.catalog.length}`
                : "--"
          }
          tone="neutral"
          icon={
            <Lightning weight="regular" size={18} className="text-zinc-500" />
          }
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid w-full min-w-0 grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={`${surfaceClass} p-5`}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-base font-semibold text-white">
                Scenario Builder
              </h2>
              <div className="flex gap-1 rounded-md border border-white/10 bg-black/50 p-0.5">
                {(["historical", "manual"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors ${mode === item ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-5">
              <Field label="Current model">
                <Select value={sourceKey} onValueChange={setSourceKey}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Select source model" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-md border border-white/10 bg-[#0a0a0a] text-zinc-100 shadow-xl">
                    {sourceSelectItems.map((item) => (
                      <SelectItem
                        key={item.key}
                        value={item.key}
                        className="text-sm"
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {mode === "historical" ? (
                <>
                  <Field label="Window start">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Window end">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Traffic multiplier">
                    <Input
                      value={trafficMultiplier}
                      onChange={(event) =>
                        setTrafficMultiplier(event.target.value)
                      }
                      className={inputClass}
                      placeholder="1"
                    />
                  </Field>
                </>
              ) : (
                <>
                  <Field label="Requests">
                    <Input
                      value={requestCount}
                      onChange={(event) => setRequestCount(event.target.value)}
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Avg prompt tokens">
                    <Input
                      value={avgPromptTokens}
                      onChange={(event) =>
                        setAvgPromptTokens(event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Avg completion tokens">
                    <Input
                      value={avgCompletionTokens}
                      onChange={(event) =>
                        setAvgCompletionTokens(event.target.value)
                      }
                      className={inputClass}
                    />
                  </Field>
                </>
              )}

              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start gap-2.5">
                  <Lightning
                    size={16}
                    className="mt-0.5 shrink-0 text-zinc-500"
                    weight="regular"
                  />
                  <p className="text-xs text-zinc-500">
                    This page keeps the traffic shape fixed and swaps only model
                    pricing, so the table shows direct spend impact for the same
                    workload pattern.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => void runAnalysis()}
                disabled={runningAnalysis || !sourceKey}
                className="h-10 rounded-xl bg-white px-4 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                {runningAnalysis ? "Running..." : "Run Full Analysis"}
              </Button>
            </div>
          </div>

          {result && (
            <div className={`${surfaceClass} p-5`}>
              <div className="border-b border-white/5 pb-4">
                <h2 className="text-base font-semibold text-white">
                  Source Snapshot
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {result.mode === "historical"
                    ? `Using tracked traffic from ${formatDateInput(result.window_start)} to ${formatDateInput(result.window_end)}.`
                    : "Using a manual what-if traffic scenario."}
                </p>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <div className="text-[10px] uppercase font-semibold tracking-widest text-zinc-500">
                    Current model
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">
                    {result.source.provider}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {result.source.model}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniStat
                    label="Requests"
                    value={result.source.request_count.toLocaleString()}
                  />
                  <MiniStat
                    label="Prompt"
                    value={result.source.prompt_tokens.toLocaleString()}
                  />
                  <MiniStat
                    label="Completion"
                    value={result.source.completion_tokens.toLocaleString()}
                  />
                  <MiniStat
                    label="Spend"
                    value={formatCurrency(result.source.total_cost_usd)}
                  />
                  <MiniStat
                    label="Input Rate"
                    value={formatRate(result.source.input_cost_per_1k)}
                  />
                  <MiniStat
                    label="Output Rate"
                    value={formatRate(result.source.output_cost_per_1k)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          {loadingOptions && !result ? (
            <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="h-40 animate-pulse rounded-xl border border-white/5 bg-white/5"
                />
              ))}
            </div>
          ) : null}

          {result ? (
            <>
              <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {topComparisons.map((item) => (
                  <TopComparisonCard
                    key={`${item.provider}-${item.model}`}
                    item={item}
                  />
                ))}
              </div>

              <div className={`${surfaceClass} min-w-0 max-w-full overflow-hidden`}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold text-white">
                      Full Comparison Table
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                      Ranked by projected total spend for the selected traffic
                      profile.
                    </p>
                  </div>
                  {currentRow ? (
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
                      Current model rank: #{currentRow.rank}
                    </div>
                  ) : null}
                </div>

                <div className="w-full max-w-full overflow-x-auto">
                  <table className="w-full min-w-[900px] border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-white/[0.02] text-left text-[11px] uppercase tracking-widest text-zinc-500">
                        <th className="px-5 py-3 font-semibold">Rank</th>
                        <th className="px-5 py-3 font-semibold">Model</th>
                        <th className="px-5 py-3 font-semibold">Input / 1K</th>
                        <th className="px-5 py-3 font-semibold">Output / 1K</th>
                        <th className="px-5 py-3 font-semibold">
                          Projected Spend
                        </th>
                        <th className="px-5 py-3 font-semibold">Delta</th>
                        <th className="px-5 py-3 font-semibold">Savings</th>
                        <th className="px-5 py-3 font-semibold">% Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.comparisons.map((item) => (
                        <ComparisonRow
                          key={`${item.provider}-${item.model}`}
                          item={item}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | React.ReactNode;
  tone: "neutral" | "success" | "destructive";
  icon: React.ReactNode;
}) {
  const valueColor =
    tone === "success"
      ? "text-emerald-400"
      : tone === "destructive"
        ? "text-rose-400"
        : "text-white";
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/10 bg-white/2 inset-shadow-2xs inset-shadow-white/10 p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3">
        <span className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">
          {label}
        </span>
        {icon}
      </div>
      <div
        className={`min-w-0 break-words text-[2rem] leading-none font-semibold tracking-tight ${valueColor}`}
      >
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <span className="text-[10px] uppercase font-semibold tracking-widest text-zinc-500">
        {label}
      </span>
      <span className="text-[13px] font-medium text-zinc-200 break-all">
        {value}
      </span>
    </div>
  );
}

function TopComparisonCard({ item }: { item: PlaygroundCompareAllItem }) {
  const cheaper = item.absolute_cost_change_usd <= 0;

  return (
    <div
      className={`flex min-w-0 flex-col rounded-xl border p-5 shadow-sm inset-shadow-2xs ${item.is_source_model ? "border-white/20 bg-white/6 inset-shadow-white/10" : "border-white/10 bg-white/2 inset-shadow-white/5"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-semibold tracking-widest text-zinc-500">
              Rank #{item.rank}
            </span>
            {item.is_source_model ? (
              <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
                Current
              </span>
            ) : null}
          </div>
          <div className="mt-2 break-words text-sm font-semibold text-white">
            {item.provider}
          </div>
          <div className="break-words text-sm text-zinc-400">{item.model}</div>
        </div>
        {cheaper ? (
          <TrendDown size={18} className="text-emerald-400" weight="bold" />
        ) : (
          <TrendUp size={18} className="text-rose-400" weight="bold" />
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <MiniStat
          label="Projected"
          value={formatCurrency(item.projected_total_cost_usd)}
        />
        <MiniStat
          label="Delta"
          value={formatSignedCurrency(item.absolute_cost_change_usd)}
        />
        <MiniStat label="Savings" value={formatCurrency(item.savings_usd)} />
        <MiniStat
          label="% Change"
          value={formatPercent(item.percentage_cost_change)}
        />
      </div>
    </div>
  );
}

function ComparisonRow({ item }: { item: PlaygroundCompareAllItem }) {
  const cheaper = item.absolute_cost_change_usd <= 0;

  return (
    <tr
      className={`border-t border-white/5 text-sm transition-colors ${item.is_source_model ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"}`}
    >
      <td className="px-5 py-4 align-top">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">#{item.rank}</span>
          {item.is_source_model ? (
            <span className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-200">
              Current
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-5 py-4 align-top">
        <div className="font-semibold text-white">{item.provider}</div>
        <div className="text-zinc-400">{item.model}</div>
      </td>
      <td className="px-5 py-4 align-top font-mono text-zinc-300">
        {formatRate(item.input_cost_per_1k)}
      </td>
      <td className="px-5 py-4 align-top font-mono text-zinc-300">
        {formatRate(item.output_cost_per_1k)}
      </td>
      <td className="px-5 py-4 align-top font-semibold text-white">
        {formatCurrency(item.projected_total_cost_usd)}
      </td>
      <td
        className={`px-5 py-4 align-top font-semibold ${cheaper ? "text-emerald-400" : "text-rose-400"}`}
      >
        {formatSignedCurrency(item.absolute_cost_change_usd)}
      </td>
      <td className="px-5 py-4 align-top text-zinc-300">
        {formatCurrency(item.savings_usd)}
      </td>
      <td
        className={`px-5 py-4 align-top ${cheaper ? "text-emerald-400" : "text-rose-400"}`}
      >
        {formatPercent(item.percentage_cost_change)}
      </td>
    </tr>
  );
}
