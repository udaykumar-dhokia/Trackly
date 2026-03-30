"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import {
  ArrowsClockwise,
  ArrowUpRight,
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

type PlaygroundModelPricing = {
  provider: string;
  model: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  effective_from: string;
};

type PlaygroundRecentModel = {
  provider: string;
  model: string;
  event_count: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number | null;
  last_seen_at: string | null;
  matched_pricing_model: string | null;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
};

type PlaygroundOptions = {
  default_start: string;
  default_end: string;
  catalog: PlaygroundModelPricing[];
  recent_models: PlaygroundRecentModel[];
};

type PlaygroundCompareResponse = {
  mode: "historical" | "manual";
  feature: string | null;
  window_start: string | null;
  window_end: string | null;
  traffic_multiplier: number;
  source: {
    provider: string;
    model: string;
    matched_pricing_model: string | null;
    input_cost_per_1k: number | null;
    output_cost_per_1k: number | null;
    event_count: number;
    request_count: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
    avg_latency_ms: number | null;
  };
  target: {
    provider: string;
    model: string;
    matched_pricing_model: string | null;
    input_cost_per_1k: number | null;
    output_cost_per_1k: number | null;
    event_count: number;
    request_count: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_cost_usd: number;
    avg_latency_ms: number | null;
  };
  delta: {
    absolute_cost_change_usd: number;
    percentage_cost_change: number | null;
    savings_usd: number;
    savings_percentage: number | null;
  };
};

type Mode = "historical" | "manual";

const surfaceClass = "rounded-xl border border-white/10 bg-[#0a0a0a]";
const labelClass = "text-xs font-medium tracking-tight text-zinc-400";
const selectTriggerClass =
  "flex h-9 w-full items-center justify-between rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm text-zinc-100 shadow-sm ring-offset-background placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1";
const inputClass =
  "flex h-9 w-full rounded-md border border-white/10 bg-transparent px-3 py-1 text-sm text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50";

function encodeModelKey(provider: string, model: string) {
  return `${provider}:::${model}`;
}

function decodeModelKey(value: string) {
  const [provider, ...rest] = value.split(":::");
  return {
    provider,
    model: rest.join(":::"),
  };
}

function formatDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function pickDefaultTarget(
  catalog: PlaygroundModelPricing[],
  sourceKey: string,
) {
  const ordered = [...catalog].sort(
    (a, b) =>
      a.input_cost_per_1k + a.output_cost_per_1k - (b.input_cost_per_1k + b.output_cost_per_1k),
  );

  const fallback = ordered.find((entry) => encodeModelKey(entry.provider, entry.model) !== sourceKey);
  return fallback ? encodeModelKey(fallback.provider, fallback.model) : sourceKey;
}

async function requestComparison({
  apiUrl,
  projectId,
  auth0Id,
  body,
}: {
  apiUrl: string;
  projectId: string;
  auth0Id: string;
  body: Record<string, unknown>;
}) {
  const response = await fetch(
    `${apiUrl}/api/v1/projects/${projectId}/playground/compare?auth0_id=${encodeURIComponent(auth0Id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || "Comparison failed");
  }
  return (await response.json()) as PlaygroundCompareResponse;
}

export default function PlaygroundPage() {
  const { user } = useUser();
  const { activeProjectId, status: projectsStatus } = useAppSelector((state) => state.projects);

  const [options, setOptions] = useState<PlaygroundOptions | null>(null);
  const [result, setResult] = useState<PlaygroundCompareResponse | null>(null);
  const [mode, setMode] = useState<Mode>("historical");
  const [sourceKey, setSourceKey] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [trafficMultiplier, setTrafficMultiplier] = useState("1");
  const [requestCount, setRequestCount] = useState("10000");
  const [avgPromptTokens, setAvgPromptTokens] = useState("1200");
  const [avgCompletionTokens, setAvgCompletionTokens] = useState("350");
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [runningCompare, setRunningCompare] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const sourceSelectItems = useMemo(() => {
    if (!options) return [];
    if (mode === "historical" && options.recent_models.length > 0) {
      return options.recent_models.map((entry) => ({
        key: encodeModelKey(entry.provider, entry.model),
        label: `${entry.provider} / ${entry.model}`,
      }));
    }
    return options.catalog.map((entry) => ({
      key: encodeModelKey(entry.provider, entry.model),
      label: `${entry.provider} / ${entry.model}`,
    }));
  }, [mode, options]);

  const runComparison = useCallback(async ({
    projectId = activeProjectId,
    auth0Id = user?.sub || "",
    nextMode = mode,
    nextSourceKey = sourceKey,
    nextTargetKey = targetKey,
    nextStartDate = startDate,
    nextEndDate = endDate,
  }: {
    projectId?: string | null;
    auth0Id?: string;
    nextMode?: Mode;
    nextSourceKey?: string;
    nextTargetKey?: string;
    nextStartDate?: string;
    nextEndDate?: string;
  } = {}) => {
    if (!projectId || !auth0Id || !nextSourceKey || !nextTargetKey) return;

    const source = decodeModelKey(nextSourceKey);
    const target = decodeModelKey(nextTargetKey);

    setRunningCompare(true);
    setError(null);
    try {
      const body =
        nextMode === "historical"
          ? {
            source_provider: source.provider,
            source_model: source.model,
            target_provider: target.provider,
            target_model: target.model,
            mode: "historical",
            start: nextStartDate ? `${nextStartDate}T00:00:00.000Z` : undefined,
            end: nextEndDate ? `${nextEndDate}T23:59:59.999Z` : undefined,
            traffic_multiplier: Number(trafficMultiplier) || 1,
          }
          : {
            source_provider: source.provider,
            source_model: source.model,
            target_provider: target.provider,
            target_model: target.model,
            mode: "manual",
            traffic_multiplier: 1,
            request_count: Number(requestCount) || 1,
            avg_prompt_tokens: Number(avgPromptTokens) || 0,
            avg_completion_tokens: Number(avgCompletionTokens) || 0,
          };

      setResult(
        await requestComparison({
          apiUrl,
          projectId,
          auth0Id,
          body,
        }),
      );
    } catch (compareError) {
      setError(compareError instanceof Error ? compareError.message : "Comparison failed");
    } finally {
      setRunningCompare(false);
    }
  }, [
    activeProjectId,
    apiUrl,
    avgCompletionTokens,
    avgPromptTokens,
    endDate,
    mode,
    requestCount,
    sourceKey,
    startDate,
    targetKey,
    trafficMultiplier,
    user?.sub,
  ]);

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

        setOptions(payload);
        setStartDate(formatDateInput(payload.default_start));
        setEndDate(formatDateInput(payload.default_end));

        const initialSource = payload.recent_models[0]
          ? encodeModelKey(payload.recent_models[0].provider, payload.recent_models[0].model)
          : payload.catalog[0]
            ? encodeModelKey(payload.catalog[0].provider, payload.catalog[0].model)
            : "";
        const initialTarget = initialSource ? pickDefaultTarget(payload.catalog, initialSource) : "";

        setSourceKey(initialSource);
        setTargetKey(initialTarget);

        if (initialSource && initialTarget) {
          const source = decodeModelKey(initialSource);
          const target = decodeModelKey(initialTarget);
          setRunningCompare(true);
          try {
            const initialResult = await requestComparison({
              apiUrl,
              projectId: activeProjectId,
              auth0Id: user.sub,
              body: {
                source_provider: source.provider,
                source_model: source.model,
                target_provider: target.provider,
                target_model: target.model,
                mode: "historical",
                start: `${formatDateInput(payload.default_start)}T00:00:00.000Z`,
                end: `${formatDateInput(payload.default_end)}T23:59:59.999Z`,
                traffic_multiplier: 1,
              },
            });
            if (!cancelled) {
              setResult(initialResult);
            }
          } finally {
            if (!cancelled) {
              setRunningCompare(false);
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load playground");
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
  }, [activeProjectId, apiUrl, user?.sub]);

  useEffect(() => {
    if (!options || sourceSelectItems.length === 0) return;
    const sourceExists = sourceSelectItems.some((item) => item.key === sourceKey);
    if (!sourceExists) {
      setSourceKey(sourceSelectItems[0].key);
    }
  }, [mode, options, sourceKey, sourceSelectItems]);

  if (
    projectsStatus === "loading" ||
    (projectsStatus === "idle" && !activeProjectId)
  ) {
    return (
      <div className="flex h-64 items-center justify-center font-mono text-sm text-zinc-500 animate-pulse">
        Initializing Playground...
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="mx-auto mt-12 flex max-w-[500px] flex-col items-center justify-center space-y-4 rounded-xl border border-white/10 bg-[#0a0a0a] p-10 text-center shadow-sm">
        <WarningCircle size={48} weight="regular" className="text-zinc-500" />
        <h1 className="text-xl font-semibold text-white">No Active Project</h1>
        <p className="font-sans text-sm text-zinc-400">
          Select a project before opening the model playground to track potential what-if scenarios based on recorded real-world constraints.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col space-y-8 pb-10">
      <section className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight text-white">Playground</h1>
        <p className="max-w-2xl text-sm font-medium text-zinc-400">
          Compare model costs against real traffic before shipping. Use your project's observed usage or build a manual scenario.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Source Spend"
          value={result ? `$${result.source.total_cost_usd.toFixed(4)}` : "--"}
          tone="neutral"
          icon={<Coins weight="regular" size={18} className="text-zinc-500" />}
        />
        <MetricCard
          label="Target Spend"
          value={result ? `$${result.target.total_cost_usd.toFixed(4)}` : "--"}
          tone={result && result.delta.absolute_cost_change_usd > 0 ? "destructive" : "success"}
          icon={
            result && result.delta.absolute_cost_change_usd > 0 ? (
              <ArrowUpRight weight="regular" size={18} className="text-rose-400" />
            ) : (
              <ArrowUpRight weight="regular" size={18} className="text-emerald-400" />
            )
          }
        />
        <MetricCard
          label="Savings"
          value={result ? (result.delta.savings_usd >= 0 ? `$${result.delta.savings_usd.toFixed(4)}` : `-$${Math.abs(result.delta.savings_usd).toFixed(4)}`) : "--"}
          tone={result && result.delta.savings_usd < 0 ? "destructive" : "neutral"}
          icon={
            result && result.delta.savings_usd < 0 ? (
              <TrendDown weight="regular" size={18} className="text-rose-400" />
            ) : (
              <Coins weight="regular" size={18} className="text-zinc-400" />
            )
          }
        />
        <MetricCard
          label="Change"
          value={
            result && result.delta.percentage_cost_change != null
              ? `${result.delta.percentage_cost_change > 0 ? "+" : ""}${result.delta.percentage_cost_change.toFixed(2)}%`
              : "--"
          }
          tone={result && result.delta.absolute_cost_change_usd > 0 ? "destructive" : "success"}
          icon={
            result && result.delta.absolute_cost_change_usd > 0 ? (
              <TrendUp weight="regular" size={18} className="text-rose-400" />
            ) : (
              <TrendDown weight="regular" size={18} className="text-emerald-400" />
            )
          }
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[300px_1fr] xl:grid-cols-[330px_1fr]">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Recent Models</h2>
            <button
              onClick={() => {
                if (activeProjectId && user?.sub) {
                  void runComparison();
                }
              }}
              disabled={runningCompare}
              className="text-zinc-500 hover:text-white transition-colors disabled:opacity-50 pb-1"
              title="Refresh comparison"
            >
              <ArrowsClockwise size={16} weight="regular" className={runningCompare ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="flex flex-col gap-2 relative">
            {loadingOptions ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[84px] animate-pulse rounded-lg bg-white/5 border border-white/5" />
              ))
            ) : options?.recent_models.length ? (
              options.recent_models.map((entry) => {
                const modelKey = encodeModelKey(entry.provider, entry.model);
                const isActive = modelKey === sourceKey;
                return (
                  <button
                    key={modelKey}
                    onClick={() => setSourceKey(modelKey)}
                    className={`flex flex-col justify-between rounded-lg border p-3 text-left transition-all relative ${isActive ? "border-white/20 bg-white/5 ring-1 ring-white/10" : "border-white/5 bg-transparent hover:border-white/10 hover:bg-white/[0.02]"}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{entry.provider}</span>
                      <span className="text-[10px] font-medium text-zinc-500">{entry.event_count.toLocaleString()} req</span>
                    </div>
                    <span className="mt-1.5 text-xs font-medium text-zinc-100 truncate w-full">{entry.model}</span>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-2 font-mono">
                      <span>${entry.total_cost_usd.toFixed(4)}</span>
                      <span>&bull;</span>
                      <span>{entry.total_tokens.toLocaleString()} tkns</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-lg border border-dashed border-white/10 p-6 text-center">
                <p className="text-xs text-zinc-400">No tracked models yet. Connect your app to see historical models here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-6">
          <div className={`${surfaceClass} p-6 flex flex-col space-y-6`}>
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-base font-semibold text-white">Scenario Builder</h2>
              <div className="flex gap-1 rounded-md border border-white/10 bg-black/50 p-0.5">
                {(["historical", "manual"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    className={`rounded shadow-none px-3 py-1.5 text-xs font-medium capitalize transition-colors ${mode === item ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <Field label="Source model">
                <Select value={sourceKey} onValueChange={setSourceKey}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Select source model" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-md border border-white/10 bg-[#0a0a0a] text-zinc-100 shadow-xl">
                    {sourceSelectItems.map((item) => (
                      <SelectItem key={item.key} value={item.key} className="text-sm">
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Target model">
                <Select value={targetKey} onValueChange={setTargetKey}>
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue placeholder="Select target model" />
                  </SelectTrigger>
                  <SelectContent className="max-h-80 rounded-md border border-white/10 bg-[#0a0a0a] text-zinc-100 shadow-xl">
                    {options?.catalog.map((item) => {
                      const value = encodeModelKey(item.provider, item.model);
                      return (
                        <SelectItem key={value} value={value} className="text-sm">
                          {item.provider} / {item.model}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {mode === "historical" ? (
              <div className="grid gap-5 md:grid-cols-3">
                <Field label="Window start">
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Window end">
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Traffic multiplier">
                  <Input value={trafficMultiplier} onChange={(event) => setTrafficMultiplier(event.target.value)} className={inputClass} placeholder="1" />
                </Field>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-3">
                <Field label="Requests">
                  <Input value={requestCount} onChange={(event) => setRequestCount(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Avg prompt tokens">
                  <Input value={avgPromptTokens} onChange={(event) => setAvgPromptTokens(event.target.value)} className={inputClass} />
                </Field>
                <Field label="Avg completion tokens">
                  <Input value={avgCompletionTokens} onChange={(event) => setAvgCompletionTokens(event.target.value)} className={inputClass} />
                </Field>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/5">
              <div className="flex items-start gap-2.5 sm:mt-0">
                <Lightning size={16} className="text-zinc-500 mt-0.5 shrink-0" weight="regular" />
                <p className="text-xs text-zinc-500 max-w-sm">
                  Historical mode scales actual tracked traffic data across time periods. Manual mode provisions standard scenario blocks.
                </p>
              </div>
              <Button
                onClick={() => void runComparison()}
                disabled={runningCompare || !sourceKey || !targetKey}
                className="h-9 w-full sm:w-auto rounded-md bg-white px-4 text-xs font-medium text-black transition hover:bg-zinc-200"
              >
                {runningCompare ? "Calculating..." : "Run Comparison"}
              </Button>
            </div>

          </div>

          {result && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ComparisonPanel
                title="Current"
                provider={result.source.provider}
                model={result.source.model}
                cost={result.source.total_cost_usd}
                promptTokens={result.source.prompt_tokens}
                completionTokens={result.source.completion_tokens}
                requests={result.source.request_count}
              />
              <ComparisonPanel
                title="What-if"
                provider={result.target.provider}
                model={result.target.model}
                cost={result.target.total_cost_usd}
                promptTokens={result.target.prompt_tokens}
                completionTokens={result.target.completion_tokens}
                requests={result.target.request_count}
              />
              <DeltaPanel result={result} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  const valueColor = tone === "success" ? "text-emerald-400" : tone === "destructive" ? "text-rose-400" : "text-white";
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/2 inset-shadow-2xs inset-shadow-white/10 p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3">
        <span className="text-[11px] font-semibold tracking-widest text-zinc-500 uppercase">{label}</span>
        {icon}
      </div>
      <div className={`text-[2rem] leading-none font-semibold tracking-tight ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase font-semibold tracking-widest text-zinc-500">{label}</span>
      <span className="text-[13px] font-medium text-zinc-200 truncate">{value}</span>
    </div>
  );
}

function ComparisonPanel({
  title,
  provider,
  model,
  cost,
  promptTokens,
  completionTokens,
  requests,
}: {
  title: string;
  provider: string;
  model: string;
  cost: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/2 inset-shadow-2xs inset-shadow-white/10 p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-4 justify-between">
        <div className="flex flex-col overflow-hidden">
          <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-widest mb-1.5">{title}</span>
          <span className="text-[13px] font-medium text-white">{provider}</span>
          <span className="text-[13px] text-zinc-400 truncate">{model}</span>
        </div>
        <div className="flex flex-col text-right shrink-0">
          <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-widest mb-1.5">Spend</span>
          <span className="text-[15px] font-semibold text-white tracking-tight">${cost.toFixed(4)}</span>
        </div>
      </div>
      <div className="h-px w-full bg-white/5" />
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Reqs" value={requests.toLocaleString()} />
        <MiniStat label="Prompt" value={promptTokens.toLocaleString()} />
        <MiniStat label="Comp" value={completionTokens.toLocaleString()} />
      </div>
    </div>
  );
}

function DeltaPanel({ result }: { result: PlaygroundCompareResponse }) {
  const cheaper = result.delta.absolute_cost_change_usd <= 0;
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/2 p-5 inset-shadow-2xs inset-shadow-white/10 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-semibold text-zinc-500 tracking-widest">Delta</span>
        {cheaper ? <TrendDown size={18} className="text-emerald-400" weight="bold" /> : <TrendUp size={18} className="text-rose-400" weight="bold" />}
      </div>
      <div className="flex flex-col">
         <span className={`text-[2rem] leading-none font-semibold tracking-tight ${cheaper ? 'text-emerald-400' : 'text-rose-400'}`}>
           {cheaper ? "-" : "+"}${Math.abs(result.delta.absolute_cost_change_usd).toFixed(4)}
         </span>
         <span className="text-xs font-medium text-zinc-500 mt-2">
           {cheaper ? "Projected footprint reduction." : "Projected footprint increase."}
         </span>
      </div>
      <div className="h-px w-full bg-white/5" />
      <div className="grid grid-cols-2 gap-2">
         <MiniStat label="Savings" value={`$${result.delta.savings_usd.toFixed(4)}`} />
         <MiniStat 
           label="Percent" 
           value={result.delta.percentage_cost_change != null ? `${result.delta.percentage_cost_change > 0 ? "+" : ""}${result.delta.percentage_cost_change.toFixed(2)}%` : "n/a"} 
         />
      </div>
    </div>
  );
}
