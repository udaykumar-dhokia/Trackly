"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchProjects,
  createProject,
  setActiveProject,
  fetchOrgMembers,
  addOrgUser,
  updateProject,
} from "@/lib/store/features/projectsSlice";
import {
  Plus,
  CaretRight,
  Sparkle,
  PencilSimple,
  Stack,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function OrganizationsPage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const {
    items: projects,
    status,
    error,
    activeProjectId,
    activeOrgId,
    organizations,
    orgMembers,
    orgMembersStatus,
  } = useAppSelector((state) => state.projects);
  const activeOrg = organizations.find((org) => org.id === activeOrgId);
  const canManageProjects =
    activeOrg?.role === "admin" || activeOrg?.role === "owner";

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectEnvironment, setNewProjectEnvironment] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingEnvironment, setEditingEnvironment] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [email, setEmail] = useState("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    exists: boolean;
    inOrg: boolean;
    name: string | null;
  } | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    if (activeOrgId) {
      dispatch(fetchOrgMembers(activeOrgId));
      dispatch(fetchProjects(activeOrgId));
    }
  }, [activeOrgId, dispatch]);

  useEffect(() => {
    const checkEmail = async () => {
      if (!email || !email.includes("@") || !activeOrgId) {
        setEmailStatus(null);
        return;
      }

      setCheckingEmail(true);
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(
          `${apiUrl}/api/v1/users/check?email=${encodeURIComponent(email)}&org_id=${activeOrgId}`,
        );
        const data = await response.json();
        setEmailStatus({
          exists: data.exists,
          inOrg: data.in_org,
          name: data.name,
        });
      } catch (err) {
        console.error("Check failed", err);
      } finally {
        setCheckingEmail(false);
      }
    };

    const timer = setTimeout(checkEmail, 500);
    return () => clearTimeout(timer);
  }, [email, user?.org_id]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !activeOrgId) return;
    setIsCreating(true);
    try {
      await dispatch(
        createProject({
          orgId: activeOrgId,
          name: newProjectName.trim(),
          environment: newProjectEnvironment.trim() || null,
          description: newProjectDescription.trim() || null,
        }),
      ).unwrap();
      setNewProjectName("");
      setNewProjectEnvironment("");
      setNewProjectDescription("");
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setIsCreating(false);
    }
  };

  const openEditDialog = (
    projectId: string,
    name: string,
    environment: string | null,
    description: string | null,
  ) => {
    setEditingProjectId(projectId);
    setEditingName(name);
    setEditingEnvironment(environment || "");
    setEditingDescription(description || "");
  };

  const handleUpdateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId || !user?.sub) return;
    setIsUpdating(true);
    try {
      await dispatch(
        updateProject({
          projectId: editingProjectId,
          auth0Id: user.sub,
          name: editingName.trim(),
          environment: editingEnvironment.trim() || null,
          description: editingDescription.trim() || null,
        }),
      ).unwrap();
      setEditingProjectId(null);
      setEditingName("");
      setEditingEnvironment("");
      setEditingDescription("");
    } catch (err) {
      console.error("Failed to update project", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !activeOrgId) return;
    setIsInviting(true);
    setInviteError(null);
    try {
      await dispatch(
        addOrgUser({ orgId: activeOrgId, email }),
      ).unwrap();
      setEmail("");
      setEmailStatus(null);
    } catch (err: any) {
      setInviteError(err.message || "Failed to invite user");
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <section className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
          Organization Projects
        </h1>
        <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed">
          Manage your organization's projects. Tracking data and API keys are
          isolated within a Project to keep environments separate.
        </p>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-2xl font-bold text-white">Available Projects</h2>
          {canManageProjects && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white bg-white/20">
                  <Plus weight="bold" /> New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="overflow-hidden rounded-xl border border-white/10 bg-[#111218] p-0 text-white shadow-[0_32px_120px_rgba(0,0,0,0.45)]">
                <div className="border-b border-white/8 px-6 py-5">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-3 text-xl font-black tracking-tight">
                      Create New Project
                    </DialogTitle>
                  </DialogHeader>
                  <p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">
                    Define the project name, environment, and a short operating note so your team can recognize this workspace instantly.
                  </p>
                </div>
                <form onSubmit={handleCreateProject} className="space-y-4 px-6 py-6">
                  <Input
                    id="projectName"
                    type="text"
                    placeholder="e.g. Production API"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
                    required
                  />
                  <Input
                    id="projectEnvironment"
                    type="text"
                    placeholder="Environment, e.g. prod, staging, dev"
                    value={newProjectEnvironment}
                    onChange={(e) => setNewProjectEnvironment(e.target.value)}
                    className="h-12 rounded-2xl border-white/10 bg-white/[0.03] px-4 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
                  />
                  <Textarea
                    id="projectDescription"
                    placeholder="What is this project used for? Team, traffic, scope, or deployment notes."
                    value={newProjectDescription}
                    onChange={(e) => setNewProjectDescription(e.target.value)}
                    className="min-h-32 rounded-2xl border-white/10 bg-white/[0.03] px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
                    maxLength={2000}
                  />
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>Optional fields help distinguish environments faster.</span>
                    <span>{newProjectDescription.length}/2000</span>
                  </div>
                  <Button
                    type="submit"
                    disabled={isCreating || !newProjectName.trim()}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/20 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreating ? "Creating..." : "Launch Project"}
                    {!isCreating && <Plus weight="bold" />}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {status === "loading" && (
          <p className="text-zinc-500 font-mono animate-pulse">
            Loading projects...
          </p>
        )}
        {status === "failed" && (
          <p className="text-red-400 font-mono italic">
            Failed to load projects: {error}
          </p>
        )}

        {status === "succeeded" && projects.length === 0 && (
          <div className="border border-dashed border-white/20 p-12 flex flex-col items-center justify-center text-center bg-[#141418]/50 rounded-xl">
            <p className="text-zinc-300 mb-2">No projects found.</p>
            <p className="text-zinc-500 text-sm max-w-sm mb-6">
              Create your primary project below to start tracking API events and
              monitoring LLM costs.
            </p>
          </div>
        )}

        {status === "succeeded" && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className={`group relative overflow-hidden border p-6 flex flex-col justify-between min-h-[220px] transition-all rounded-xl
                  ${activeProjectId === proj.id
                    ? "border-white/20"
                    : "border-white/10 bg-[#0f0f12] hover:border-white/20 hover:-translate-y-1"
                  }
                `}
              >
                <div className="pointer-events-none absolute inset-0" />
                <div>
                  <div className="relative z-10 flex items-start justify-between gap-3 mb-4">
                    <div className="space-y-3">
                      <h3 className="font-bold text-lg text-white truncate pr-4">
                        {proj.name}
                      </h3>
                    </div>
                    {canManageProjects && user?.sub && (
                      <Dialog
                        open={editingProjectId === proj.id}
                        onOpenChange={(open) => {
                          if (!open) {
                            setEditingProjectId(null);
                          } else {
                            openEditDialog(
                              proj.id,
                              proj.name,
                              proj.environment,
                              proj.description,
                            );
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            onClick={() =>
                              openEditDialog(
                                proj.id,
                                proj.name,
                                proj.environment,
                                proj.description,
                              )
                            }
                            className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white"
                          >
                            <PencilSimple size={18} />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="overflow-hidden rounded-xl border border-white/10 bg-[#111218] p-0 text-white">
                          <div className="border-b border-white/8 px-6 py-5">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-black tracking-tight">
                                Edit Project
                              </DialogTitle>
                            </DialogHeader>
                            <p className="mt-2 text-sm text-zinc-400">
                              Update the details your organization sees when choosing this project.
                            </p>
                          </div>
                          <form onSubmit={handleUpdateProject} className="space-y-4 px-6 py-6">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-12 rounded-xl border-white/10 bg-white/[0.03] px-4 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
                              required
                            />
                            <Input
                              value={editingEnvironment}
                              onChange={(e) => setEditingEnvironment(e.target.value)}
                              placeholder="Environment"
                              className="h-12 rounded-xl border-white/10 bg-white/[0.03] px-4 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
                            />
                            <Textarea
                              value={editingDescription}
                              onChange={(e) => setEditingDescription(e.target.value)}
                              placeholder="Describe the purpose, systems, or ownership of this project."
                              maxLength={2000}
                              className="min-h-32 rounded-xl border-white/10 bg-white/[0.03] px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-primary"
                            />
                            <div className="flex items-center justify-between text-xs text-zinc-500">
                              <span>Keep it short and useful for the team.</span>
                              <span>{editingDescription.length}/2000</span>
                            </div>
                            <Button
                              type="submit"
                              disabled={isUpdating || !editingName.trim()}
                              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 bg-white/20"
                            >
                              {isUpdating ? "Saving..." : "Save Changes"}
                            </Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                  <div className="relative z-10 mb-5 flex flex-wrap items-center gap-2">
                    {proj.environment && (
                      <span className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-300">
                        {proj.environment}
                      </span>
                    )}
                  </div>
                  <p className="relative z-10 mb-4 line-clamp-4 text-sm leading-6 text-zinc-400">
                    {proj.description || "No project description yet. Add one to clarify intent, ownership, or deployment scope."}
                  </p>
                </div>

                <button
                  onClick={() => dispatch(setActiveProject(proj.id))}
                  className={`relative z-10 flex items-center gap-1 text-sm font-semibold transition-colors w-max cursor-pointer
                    ${activeProjectId === proj.id ? "text-primary" : "text-zinc-400 group-hover:text-zinc-200"}
                  `}
                >
                  {activeProjectId === proj.id
                    ? "Currently Selected"
                    : "Select Project"}
                  {activeProjectId !== proj.id && <CaretRight weight="bold" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
