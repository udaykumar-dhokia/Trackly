import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';

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

interface StatsState {
  summary: UsageSummary | null;
  models: UsageByModel[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: StatsState = {
  summary: null,
  models: [],
  status: 'idle',
  error: null,
};

export const fetchDashboardStats = createAsyncThunk(
  'stats/fetchDashboardStats',
  async ({ projectId, provider }: { projectId: string; provider?: string }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    // Construct query parameters
    const queryParams = new URLSearchParams()
    if (provider && provider !== "all") {
        queryParams.append("provider", provider)
    }
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : ""

    // Fetch summary and model breakdown concurrently
    const [summaryRes, modelsRes] = await Promise.all([
      fetch(`${apiUrl}/v1/projects/${projectId}/stats/summary${queryString}`),
      fetch(`${apiUrl}/v1/projects/${projectId}/stats/by-model${queryString}`)
    ]);

    if (!summaryRes.ok || !modelsRes.ok) {
      throw new Error('Failed to fetch dashboard stats');
    }

    const summary = (await summaryRes.json()) as UsageSummary;
    const models = (await modelsRes.json()) as UsageByModel[];

    return { summary, models };
  }
);

export const statsSlice = createSlice({
  name: 'stats',
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(fetchDashboardStats.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchDashboardStats.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.summary = action.payload.summary;
        state.models = action.payload.models;
      })
      .addCase(fetchDashboardStats.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Something went wrong';
      });
  },
});

export default statsSlice.reducer;
