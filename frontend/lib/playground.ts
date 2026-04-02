"use client";

export type PlaygroundModelPricing = {
  provider: string;
  model: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  effective_from: string;
};

export type PlaygroundRecentModel = {
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

export type PlaygroundOptions = {
  default_start: string;
  default_end: string;
  catalog: PlaygroundModelPricing[];
  recent_models: PlaygroundRecentModel[];
};

export type PlaygroundScenarioSnapshot = {
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

export type PlaygroundDelta = {
  absolute_cost_change_usd: number;
  percentage_cost_change: number | null;
  savings_usd: number;
  savings_percentage: number | null;
};

export type PlaygroundCompareResponse = {
  mode: "historical" | "manual";
  feature: string | null;
  window_start: string | null;
  window_end: string | null;
  traffic_multiplier: number;
  source: PlaygroundScenarioSnapshot;
  target: PlaygroundScenarioSnapshot;
  delta: PlaygroundDelta;
};

export type PlaygroundCompareAllItem = {
  rank: number;
  provider: string;
  model: string;
  matched_pricing_model: string | null;
  input_cost_per_1k: number | null;
  output_cost_per_1k: number | null;
  projected_total_cost_usd: number;
  absolute_cost_change_usd: number;
  percentage_cost_change: number | null;
  savings_usd: number;
  savings_percentage: number | null;
  is_source_model: boolean;
};

export type PlaygroundCompareAllResponse = {
  mode: "historical" | "manual";
  feature: string | null;
  window_start: string | null;
  window_end: string | null;
  traffic_multiplier: number;
  source: PlaygroundScenarioSnapshot;
  comparisons: PlaygroundCompareAllItem[];
};

export type Mode = "historical" | "manual";

export function encodeModelKey(provider: string, model: string) {
  return `${provider}:::${model}`;
}

export function decodeModelKey(value: string) {
  const [provider, ...rest] = value.split(":::");
  return {
    provider,
    model: rest.join(":::"),
  };
}

export function formatDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export function pickDefaultTarget(
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

export async function requestComparison({
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

export async function requestCompareAll({
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
    `${apiUrl}/api/v1/projects/${projectId}/playground/compare-all?auth0_id=${encodeURIComponent(auth0Id)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || "Full analysis failed");
  }
  return (await response.json()) as PlaygroundCompareAllResponse;
}
