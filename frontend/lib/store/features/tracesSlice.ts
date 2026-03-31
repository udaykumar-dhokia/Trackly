import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { setActiveProject } from './projectsSlice';

// ── Types ──────────────────────────────────────

export interface TraceSummaryItem {
  session_id: string;
  event_count: number;
  total_cost: number;
  total_tokens: number;
  total_latency_ms: number;
  distinct_models: string[];
  first_event: string;
  last_event: string;
}

export interface TraceNode {
  id: string;
  label: string;
  provider: string;
  model: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost_usd: number;
  latency_ms: number;
  feature: string | null;
  finish_reason: string | null;
  occurred_at: string;
  event_count: number;
  run_id: string | null;
  parent_run_id: string | null;
}

export interface TraceEdge {
  source: string;
  target: string;
}

export interface TraceGraphSummary {
  total_cost: number;
  total_tokens: number;
  total_latency_ms: number;
  event_count: number;
  distinct_models: string[];
  time_range: string[];
}

export interface TraceGraph {
  session_id: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  summary: TraceGraphSummary;
}

interface TracesState {
  sessions: TraceSummaryItem[];
  sessionsTotal: number;
  sessionsStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  activeGraph: TraceGraph | null;
  graphStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: TracesState = {
  sessions: [],
  sessionsTotal: 0,
  sessionsStatus: 'idle',
  activeGraph: null,
  graphStatus: 'idle',
  error: null,
};


export const fetchTraceSessions = createAsyncThunk(
  'traces/fetchSessions',
  async ({
    projectId,
    auth0Id,
    page = 1,
    pageSize = 30,
  }: {
    projectId: string;
    auth0Id: string;
    page?: number;
    pageSize?: number;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const params = new URLSearchParams({
      auth0_id: auth0Id,
      page: page.toString(),
      page_size: pageSize.toString(),
    });
    const res = await fetch(
      `${apiUrl}/api/v1/projects/${projectId}/traces/sessions?${params}`
    );
    if (!res.ok) throw new Error('Failed to fetch trace sessions');
    return (await res.json()) as { sessions: TraceSummaryItem[]; total: number };
  }
);

export const fetchTraceGraph = createAsyncThunk(
  'traces/fetchGraph',
  async ({
    projectId,
    auth0Id,
    sessionId,
  }: {
    projectId: string;
    auth0Id: string;
    sessionId: string;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const params = new URLSearchParams({
      auth0_id: auth0Id,
      session_id: sessionId,
    });
    const res = await fetch(
      `${apiUrl}/api/v1/projects/${projectId}/traces/graph?${params}`
    );
    if (!res.ok) throw new Error('Failed to fetch trace graph');
    return (await res.json()) as TraceGraph;
  }
);


export const tracesSlice = createSlice({
  name: 'traces',
  initialState,
  reducers: {
    clearActiveGraph(state) {
      state.activeGraph = null;
      state.graphStatus = 'idle';
    },
  },
  extraReducers(builder) {
    builder
      // Reset on project switch
      .addCase(setActiveProject, () => initialState)

      // Session list
      .addCase(fetchTraceSessions.pending, (state) => {
        state.sessionsStatus = 'loading';
      })
      .addCase(fetchTraceSessions.fulfilled, (state, action) => {
        state.sessionsStatus = 'succeeded';
        state.sessions = action.payload.sessions;
        state.sessionsTotal = action.payload.total;
      })
      .addCase(fetchTraceSessions.rejected, (state, action) => {
        state.sessionsStatus = 'failed';
        state.error = action.error.message || 'Failed to load sessions';
      })

      // Graph data
      .addCase(fetchTraceGraph.pending, (state) => {
        state.graphStatus = 'loading';
      })
      .addCase(fetchTraceGraph.fulfilled, (state, action) => {
        state.graphStatus = 'succeeded';
        state.activeGraph = action.payload;
      })
      .addCase(fetchTraceGraph.rejected, (state, action) => {
        state.graphStatus = 'failed';
        state.error = action.error.message || 'Failed to load graph';
      });
  },
});

export const { clearActiveGraph } = tracesSlice.actions;
export default tracesSlice.reducer;
