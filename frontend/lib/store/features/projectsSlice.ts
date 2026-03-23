import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

export interface Project {
  id: string;
  org_id: string;
  name: string;
  environment: string | null;
}

interface ProjectsState {
  items: Project[];
  activeProjectId: string | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  lastFetchedOrgId: string | null;
}

const initialState: ProjectsState = {
  items: [],
  activeProjectId: null,
  status: "idle",
  error: null,
  lastFetchedOrgId: null,
};

export const fetchProjects = createAsyncThunk(
  "projects/fetchProjects",
  async (orgId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/v1/organizations/${orgId}/projects`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch projects");
    }
    return (await response.json()) as Project[];
  },
);

export const createProject = createAsyncThunk(
  "projects/createProject",
  async ({
    orgId,
    name,
    environment,
  }: {
    orgId: string;
    name: string;
    environment?: string | null;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/v1/organizations/${orgId}/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, environment }),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to create project");
    }
    return (await response.json()) as Project;
  },
);

export const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    setActiveProject: (state, action: PayloadAction<string>) => {
      state.activeProjectId = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
        state.lastFetchedOrgId = action.meta.arg;
        if (!state.activeProjectId && action.payload.length > 0) {
          state.activeProjectId = action.payload[0].id;
        }
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message || "Something went wrong";
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.activeProjectId = action.payload.id;
      });
  },
});

export const { setActiveProject } = projectsSlice.actions;

export default projectsSlice.reducer;
