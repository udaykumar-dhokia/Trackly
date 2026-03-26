import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { setActiveProject } from "./projectsSlice";

export interface UsageSummary {
  total_events: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number | null;
  period_start: string;
  period_end: string;
}

export interface UsageByModel {
  model: string;
  provider: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
  avg_latency_ms: number | null;
}

export interface DailyUsage {
  date: string;
  event_count: number;
  total_tokens: number;
  total_cost_usd: number;
}

interface StatsState {
  summary: UsageSummary | null;
  models: UsageByModel[];
  dailyUsage: DailyUsage[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  lastFetchedParams: {
    projectId: string;
    provider?: string;
    model?: string;
    feature?: string;
    userId?: string;
    start?: string;
    end?: string;
  } | null;
}

const initialState: StatsState = {
  summary: null,
  models: [],
  dailyUsage: [],
  status: "idle",
  error: null,
  lastFetchedParams: null,
};

export const fetchDashboardStats = createAsyncThunk(
  "stats/fetchDashboardStats",
  async ({
    projectId,
    provider,
    model,
    feature,
    userId,
    start,
    end,
  }: {
    projectId: string;
    provider?: string;
    model?: string;
    feature?: string;
    userId?: string;
    start?: string;
    end?: string;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const queryParams = new URLSearchParams();
    if (provider && provider !== "all") {
      queryParams.append("provider", provider);
    }
    if (model) {
      queryParams.append("model", model);
    }
    if (feature) {
      queryParams.append("feature", feature);
    }
    if (userId && userId !== "all") {
      queryParams.append("user_id", userId);
    }
    if (start) {
      queryParams.append("start", start);
    }
    if (end) {
      queryParams.append("end", end);
    }
    const queryString = queryParams.toString()
      ? `?${queryParams.toString()}`
      : "";

    const [summaryRes, modelsRes, dailyRes] = await Promise.all([
      fetch(
        `${apiUrl}/api/v1/projects/${projectId}/stats/summary${queryString}`,
      ),
      fetch(
        `${apiUrl}/api/v1/projects/${projectId}/stats/by-model${queryString}`,
      ),
      fetch(`${apiUrl}/api/v1/projects/${projectId}/stats/daily${queryString}`),
    ]);

    if (!summaryRes.ok || !modelsRes.ok || !dailyRes.ok) {
      throw new Error("Failed to fetch dashboard stats");
    }

    const summary = (await summaryRes.json()) as UsageSummary;
    const models = (await modelsRes.json()) as UsageByModel[];
    const dailyUsage = (await dailyRes.json()) as DailyUsage[];

    return { summary, models, dailyUsage };
  },
);

export const statsSlice = createSlice({
  name: "stats",
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(setActiveProject, (state) => {
        state.lastFetchedParams = null;
        state.status = "idle";
      })
      .addCase(fetchDashboardStats.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.summary = action.payload.summary;
        state.models = action.payload.models;
        state.dailyUsage = action.payload.dailyUsage;
        state.lastFetchedParams = action.meta.arg;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || "Something went wrong";
      });
  },
});

export default statsSlice.reducer;
