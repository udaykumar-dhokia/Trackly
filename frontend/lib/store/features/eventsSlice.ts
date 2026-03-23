import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { setActiveProject } from './projectsSlice';

export interface LlmEvent {
  id: string;
  provider: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | null;
  latency_ms: number | null;
  finish_reason: string | null;
  feature: string | null;
  user_id: string | null;
  session_id: string | null;
  run_id: string | null;
  tags: string[] | null;
  occurred_at: string;
  ingested_at: string;
}

export interface PaginatedEvents {
  items: LlmEvent[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

interface EventsState {
  data: PaginatedEvents;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  lastFetchedParams: { projectId: string; page?: number; pageSize?: number; provider?: string } | null;
}

const initialState: EventsState = {
  data: {
    items: [],
    total: 0,
    page: 1,
    page_size: 50,
    has_more: false
  },
  status: 'idle',
  error: null,
  lastFetchedParams: null,
};

export const fetchEvents = createAsyncThunk(
  'events/fetchEvents',
  async ({ projectId, page = 1, pageSize = 50, provider }: { projectId: string; page?: number; pageSize?: number; provider?: string }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    
    const queryParams = new URLSearchParams()
    queryParams.append("page", page.toString())
    queryParams.append("page_size", pageSize.toString())
    if (provider && provider !== "all") {
        queryParams.append("provider", provider)
    }

    const response = await fetch(`${apiUrl}/v1/projects/${projectId}/events?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }
    return (await response.json()) as PaginatedEvents;
  }
);

export const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {},
  extraReducers(builder) {
    builder
      .addCase(setActiveProject, (state) => {
        state.lastFetchedParams = null;
        state.status = 'idle';
        state.data = { items: [], total: 0, page: 1, page_size: 50, has_more: false };
      })
      .addCase(fetchEvents.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEvents.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.data = action.payload;
        state.lastFetchedParams = action.meta.arg;
      })
      .addCase(fetchEvents.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Something went wrong';
      });
  },
});

export default eventsSlice.reducer;
