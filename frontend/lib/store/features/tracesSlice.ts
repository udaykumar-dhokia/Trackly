import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { setActiveProject } from './projectsSlice';

// ── Types ──────────────────────────────────────

export interface TraceSummaryItem {
  session_id: string;
  trace_id: string;
  name: string;
  status: string;
  event_count: number;
  total_cost: number;
  total_tokens: number;
  total_latency_ms: number;
  distinct_models: string[];
  first_event: string;
  last_event: string;
  session_group?: string | null;
  user_id?: string | null;
}

export interface TraceNode {
  id: string;
  label: string;
  provider: string;
  model: string;
  node_type: string;
  name: string;
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
  status: string | null;
  status_message?: string | null;
  level: number;
  attempts?: TraceNode[];
  hasFailures?: boolean;
  _raw?: TraceNode;
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

export interface TraceCriticalPathStep {
  step_id: string;
  label: string;
  provider: string;
  model: string;
  node_type: string;
  total_cost_usd: number;
  total_tokens: number;
  latency_ms: number;
  status: string | null;
}

export interface TraceCriticalPathSummary {
  label: string;
  total_cost_usd: number;
  total_latency_ms: number;
  steps: TraceCriticalPathStep[];
}

export interface TraceGraphInsight {
  type: string;
  severity: 'info' | 'warning' | 'success' | 'error';
  title: string;
  subject?: string;
  value?: string;
  message: string;
  action?: string | null;
  step_id?: string | null;
}

export interface TraceGraphCriticalPath {
  slowest_path: TraceCriticalPathSummary | null;
  costliest_path: TraceCriticalPathSummary | null;
  failure_point: TraceCriticalPathStep | null;
}

export interface TraceGraph {
  session_id: string;
  trace_id: string;
  name: string;
  status: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  summary: TraceGraphSummary;
  critical_path: TraceGraphCriticalPath | null;
  insights: TraceGraphInsight[];
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
