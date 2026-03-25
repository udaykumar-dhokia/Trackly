import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { setActiveProject } from "./projectsSlice";

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  project_id: string | null;
  created_by_user_id: string | null;
  parent_key_id: string | null;
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
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  lastFetchedOrgId: string | null;
}

const initialState: ApiKeysState = {
  items: [],
  newKeyDisplay: null,
  status: "idle",
  error: null,
  lastFetchedOrgId: null,
};

export const fetchApiKeys = createAsyncThunk(
  "apiKeys/fetchApiKeys",
  async ({ orgId, auth0Id }: { orgId: string; auth0Id?: string }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let url = `${apiUrl}/api/v1/organizations/${orgId}/api-keys`;
    if (auth0Id) {
      url += `?auth0_id=${encodeURIComponent(auth0Id)}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch API keys");
    }
    return (await response.json()) as ApiKey[];
  },
);

export const createApiKey = createAsyncThunk(
  "apiKeys/createApiKey",
  async ({
    orgId,
    name,
    projectId,
    userId,
  }: {
    orgId: string;
    name: string;
    projectId?: string | null;
    userId?: string;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/api/v1/organizations/${orgId}/api-keys`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          project_id: projectId,
          created_by_user_id: userId,
        }),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to create API key");
    }
    return (await response.json()) as ApiKeyCreatedResponse;
  },
);

export const accessApiKey = createAsyncThunk(
  "apiKeys/accessApiKey",
  async ({ keyId, auth0Id }: { keyId: string; auth0Id: string }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${apiUrl}/api/v1/api-keys/${keyId}/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auth0_id: auth0Id }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to generate access key");
    }
    return (await response.json()) as ApiKeyCreatedResponse;
  },
);

export const revokeApiKey = createAsyncThunk(
  "apiKeys/revokeApiKey",
  async ({ keyId, auth0Id }: { keyId: string; auth0Id: string }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/api/v1/api-keys/${keyId}?auth0_id=${encodeURIComponent(auth0Id)}`,
      {
        method: "DELETE",
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to revoke API key");
    }
    return keyId;
  },
);

export const apiKeysSlice = createSlice({
  name: "apiKeys",
  initialState,
  reducers: {
    clearNewKeyDisplay: (state) => {
      state.newKeyDisplay = null;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(setActiveProject, (state) => {
        state.lastFetchedOrgId = null;
        state.status = "idle";
      })
      .addCase(fetchApiKeys.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchApiKeys.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
        state.lastFetchedOrgId = action.meta.arg.orgId;
      })
      .addCase(fetchApiKeys.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || "Something went wrong";
      })
      .addCase(createApiKey.fulfilled, (state, action) => {
        state.items.unshift({
          id: action.payload.id,
          name: action.payload.name,
          key_prefix: action.payload.key_prefix,
          project_id: action.payload.project_id,
          created_by_user_id: action.payload.created_by_user_id,
          parent_key_id: action.payload.parent_key_id,
          is_active: action.payload.is_active,
          created_at: action.payload.created_at,
          last_used_at: action.payload.last_used_at,
        });
        state.newKeyDisplay = action.payload;
      })
      .addCase(accessApiKey.fulfilled, (state, action) => {
        state.items.unshift({
          id: action.payload.id,
          name: action.payload.name,
          key_prefix: action.payload.key_prefix,
          project_id: action.payload.project_id,
          created_by_user_id: action.payload.created_by_user_id,
          parent_key_id: action.payload.parent_key_id,
          is_active: action.payload.is_active,
          created_at: action.payload.created_at,
          last_used_at: action.payload.last_used_at,
        });
        state.newKeyDisplay = action.payload;
      })
      .addCase(revokeApiKey.fulfilled, (state, action) => {
        const keyId = action.payload;
        const existingKey = state.items.find((key) => key.id === keyId);
        if (existingKey) {
          existingKey.is_active = false;
        }
      });
  },
});

export const { clearNewKeyDisplay } = apiKeysSlice.actions;

export default apiKeysSlice.reducer;
