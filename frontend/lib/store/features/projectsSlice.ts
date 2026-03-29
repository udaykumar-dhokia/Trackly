import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";

export interface Project {
  id: string;
  org_id: string;
  name: string;
  environment: string | null;
  description: string | null;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  email: string;
  name: string | null;
  profile_photo?: string | null;
  role: string;
  created_at: string;
}

export interface User {
  id: string;
  auth0_id: string;
  email: string;
  name: string | null;
  profile_photo?: string | null;
  org_id: string;
  created_at: string;
}

export interface OrganizationWithRole {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface ProjectsState {
  items: Project[];
  activeProjectId: string | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  members: ProjectMember[];
  membersStatus: "idle" | "loading" | "succeeded" | "failed";
  organizations: OrganizationWithRole[];
  orgMembers: User[];
  orgMembersStatus: "idle" | "loading" | "succeeded" | "failed";
  activeOrgId: string | null;
  orgsStatus: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
  lastFetchedOrgId: string | null;
}

const initialState: ProjectsState = {
  items: [],
  activeProjectId: null,
  status: "idle",
  members: [],
  membersStatus: "idle",
  organizations: [],
  orgMembers: [],
  orgMembersStatus: "idle",
  activeOrgId: null,
  orgsStatus: "idle",
  error: null,
  lastFetchedOrgId: null,
};

export const fetchUserOrgs = createAsyncThunk(
  "projects/fetchUserOrgs",
  async (auth0Id: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/api/v1/users/organizations?auth0_id=${encodeURIComponent(auth0Id)}`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch organizations");
    }
    const data = await response.json();
    return data.organizations as OrganizationWithRole[];
  },
);

export const fetchProjects = createAsyncThunk(
  "projects/fetchProjects",
  async (orgId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/api/v1/organizations/${orgId}/projects`,
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
    description,
  }: {
    orgId: string;
    name: string;
    environment?: string | null;
    description?: string | null;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/api/v1/organizations/${orgId}/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, environment, description }),
      },
    );
    if (!response.ok) {
      throw new Error("Failed to create project");
    }
    return (await response.json()) as Project;
  },
);

export const updateProject = createAsyncThunk(
  "projects/updateProject",
  async ({
    projectId,
    auth0Id,
    name,
    environment,
    description,
  }: {
    projectId: string;
    auth0Id: string;
    name?: string;
    environment?: string | null;
    description?: string | null;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(
      `${apiUrl}/api/v1/projects/${projectId}?auth0_id=${encodeURIComponent(auth0Id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, environment, description }),
      },
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update project");
    }
    return (await response.json()) as Project;
  },
);

export const fetchProjectMembers = createAsyncThunk(
  "projects/fetchProjectMembers",
  async (projectId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${apiUrl}/api/v1/projects/${projectId}/members`);
    if (!response.ok) {
      throw new Error("Failed to fetch members");
    }
    return (await response.json()) as ProjectMember[];
  },
);

export const addProjectMember = createAsyncThunk(
  "projects/addProjectMember",
  async ({
    projectId,
    email,
    role = "member",
    auth0Id,
  }: {
    projectId: string;
    email: string;
    role?: string;
    auth0Id?: string;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let url = `${apiUrl}/api/v1/projects/${projectId}/members`;
    if (auth0Id) {
      url += `?auth0_id=${encodeURIComponent(auth0Id)}`;
    }
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to add member");
    }
    return (await response.json()) as ProjectMember;
  },
);

export const removeProjectMember = createAsyncThunk(
  "projects/removeProjectMember",
  async ({
    projectId,
    userId,
    auth0Id,
  }: {
    projectId: string;
    userId: string;
    auth0Id?: string;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    let url = `${apiUrl}/api/v1/projects/${projectId}/members/${userId}`;
    if (auth0Id) {
      url += `?auth0_id=${encodeURIComponent(auth0Id)}`;
    }
    const response = await fetch(url, {
      method: "DELETE",
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to remove member");
    }
    return userId;
  },
);

export const fetchOrgMembers = createAsyncThunk(
  "projects/fetchOrgMembers",
  async (orgId: string) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${apiUrl}/api/v1/organizations/${orgId}/users`);
    if (!response.ok) {
      throw new Error("Failed to fetch organization members");
    }
    return (await response.json()) as User[];
  },
);

export const addOrgUser = createAsyncThunk(
  "projects/addOrgUser",
  async ({
    orgId,
    email,
    name,
  }: {
    orgId: string;
    email: string;
    name?: string;
  }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const response = await fetch(`${apiUrl}/api/v1/organizations/${orgId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || "Failed to add member to organization");
    }
    return (await response.json()) as User;
  },
);

export const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    setActiveProject: (state, action: PayloadAction<string>) => {
      state.activeProjectId = action.payload;
    },
    setActiveOrg: (state, action: PayloadAction<string>) => {
      state.activeOrgId = action.payload;
      state.items = [];
      state.activeProjectId = null;
      state.status = "idle";
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
      })
      .addCase(updateProject.fulfilled, (state, action) => {
        state.items = state.items.map((project) =>
          project.id === action.payload.id ? action.payload : project,
        );
      })
      .addCase(fetchProjectMembers.pending, (state) => {
        state.membersStatus = "loading";
      })
      .addCase(fetchProjectMembers.fulfilled, (state, action) => {
        state.membersStatus = "succeeded";
        state.members = action.payload;
      })
      .addCase(fetchProjectMembers.rejected, (state) => {
        state.membersStatus = "failed";
      })
      .addCase(addProjectMember.fulfilled, (state, action) => {
        state.members.push(action.payload);
      })
      .addCase(removeProjectMember.fulfilled, (state, action) => {
        state.members = state.members.filter(
          (m) => m.user_id !== action.payload,
        );
      })
      .addCase(fetchOrgMembers.pending, (state) => {
        state.orgMembersStatus = "loading";
      })
      .addCase(fetchOrgMembers.fulfilled, (state, action) => {
        state.orgMembersStatus = "succeeded";
        state.orgMembers = action.payload;
      })
      .addCase(fetchOrgMembers.rejected, (state) => {
        state.orgMembersStatus = "failed";
      })
      .addCase(addOrgUser.fulfilled, (state, action) => {
        state.orgMembers.push(action.payload);
      })
      .addCase(fetchUserOrgs.pending, (state) => {
        state.orgsStatus = "loading";
      })
      .addCase(fetchUserOrgs.fulfilled, (state, action) => {
        state.orgsStatus = "succeeded";
        state.organizations = action.payload;
        if (!state.activeOrgId && action.payload.length > 0) {
          state.activeOrgId = action.payload[0].id;
        }
      })
      .addCase(fetchUserOrgs.rejected, (state) => {
        state.orgsStatus = "failed";
      });
  },
});

export const { setActiveProject, setActiveOrg } = projectsSlice.actions;

export default projectsSlice.reducer;
