import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  project_id: string | null;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyCreatedResponse extends ApiKey {
  raw_key: string;
}

interface ApiKeysState {
  items: ApiKey[];
  newKeyDisplay: ApiKeyCreatedResponse | null;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

const initialState: ApiKeysState = {
  items: [],
  newKeyDisplay: null,
  status: 'idle',
  error: null,
};

export const fetchApiKeys = createAsyncThunk(
  'apiKeys/fetchApiKeys',
  async (orgId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/v1/organizations/${orgId}/api-keys`);
    if (!response.ok) {
      throw new Error('Failed to fetch API keys');
    }
    return (await response.json()) as ApiKey[];
  }
);

export const createApiKey = createAsyncThunk(
  'apiKeys/createApiKey',
  async ({ orgId, name, projectId }: { orgId: string; name: string; projectId?: string | null }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/v1/organizations/${orgId}/api-keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, project_id: projectId }),
    });
    if (!response.ok) {
        throw new Error('Failed to create API key');
    }
    return (await response.json()) as ApiKeyCreatedResponse;
  }
)

export const revokeApiKey = createAsyncThunk(
  'apiKeys/revokeApiKey',
  async (keyId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    const response = await fetch(`${apiUrl}/v1/api-keys/${keyId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to revoke API key');
    }
    return keyId;
  }
)

export const apiKeysSlice = createSlice({
  name: 'apiKeys',
  initialState,
  reducers: {
    clearNewKeyDisplay: (state) => {
      state.newKeyDisplay = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchApiKeys.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchApiKeys.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchApiKeys.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Something went wrong';
      })
      .addCase(createApiKey.fulfilled, (state, action) => {
        // Add the generic key metadata to the list
        state.items.unshift({
            id: action.payload.id,
            name: action.payload.name,
            key_prefix: action.payload.key_prefix,
            project_id: action.payload.project_id,
            is_active: action.payload.is_active,
            created_at: action.payload.created_at,
            last_used_at: action.payload.last_used_at,
        });
        // Store the raw response so the UI can display the full key just once
        state.newKeyDisplay = action.payload;
      })
      .addCase(revokeApiKey.fulfilled, (state, action) => {
          const keyId = action.payload;
          const existingKey = state.items.find(key => key.id === keyId);
          if (existingKey) {
              existingKey.is_active = false;
          }
      })
  },
});

export const { clearNewKeyDisplay } = apiKeysSlice.actions;

export default apiKeysSlice.reducer;
