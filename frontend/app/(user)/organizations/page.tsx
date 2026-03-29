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
} from "@/lib/store/features/projectsSlice";
import {
  Plus,
  CaretRight,
  Planet,
  House,
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  ArrowClockwise,
  Envelope,
  ShieldCheck,
  Database,
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

export default function OrganizationsPage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const {
    items: projects,
    status,
    error,
    activeProjectId,
    activeOrgId,
    orgMembers,
    orgMembersStatus,
  } = useAppSelector((state) => state.projects);

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
        createProject({ orgId: activeOrgId, name: newProjectName }),
      ).unwrap();
      setNewProjectName("");
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setIsCreating(false);
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
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 bg-white/20 px-4 py-2 text-sm font-bold text-white active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all border-2 border-transparent">
                <Plus weight="bold" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="border-2 border-white/10 bg-[#141418] text-white">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">
                  Create New Project
                </DialogTitle>
              </DialogHeader>
              <form
                onSubmit={handleCreateProject}
                className="flex flex-col gap-4 mt-2"
              >
                <div>
                  <label htmlFor="projectName" className="sr-only">
                    Project Name
                  </label>
                  <Input
                    id="projectName"
                    type="text"
                    placeholder="e.g. Production API"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-[#0f0f12] border-2 rounded-xl border-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isCreating || !newProjectName.trim()}
                  className="group flex items-center justify-center gap-2 border-2 border-transparent bg-white/20 px-5 py-3 font-bold text-white hover:bg-white/30 focus:ring-2 focus:ring-white/20 focus:outline-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isCreating ? "Creating..." : "Launch Project"}
                  {!isCreating && (
                    <Plus
                      weight="bold"
                      className="group-hover:rotate-90 transition-transform"
                    />
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
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
                className={`group border-2 p-6 flex flex-col justify-between min-h-[160px] transition-all rounded-xl
                  ${activeProjectId === proj.id
                    ? "border-indigo-400 bg-[#1a1a24]"
                    : "border-white/10 bg-[#0f0f12] hover:border-white/30 hover:-translate-y-1"
                  }
                `}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg text-white truncate pr-4">
                      {proj.name}
                    </h3>
                    {activeProjectId === proj.id && (
                      <span className="text-[10px] px-2 py-0.5 border border-indigo-400/30 text-indigo-400 bg-indigo-400/10 uppercase tracking-wider font-bold">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-zinc-500 break-all mb-4">
                    ID: {proj.id}
                  </p>
                </div>

                <button
                  onClick={() => dispatch(setActiveProject(proj.id))}
                  className={`flex items-center gap-1 text-sm font-semibold transition-colors w-max cursor-pointer
                    ${activeProjectId === proj.id ? "text-indigo-400" : "text-zinc-400 group-hover:text-zinc-200"}
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
