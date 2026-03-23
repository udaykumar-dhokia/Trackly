"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchProjects,
  createProject,
  setActiveProject,
} from "@/lib/store/features/projectsSlice";
import { Plus, CaretRight, Planet, House } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function OrganizationsPage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const {
    items: projects,
    status,
    error,
    activeProjectId,
  } = useAppSelector((state) => state.projects);

  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user?.org_id) return;
    setIsCreating(true);
    try {
      await dispatch(
        createProject({ orgId: user.org_id as string, name: newProjectName }),
      ).unwrap();
      setNewProjectName("");
      setIsDialogOpen(false);
    } catch (err) {
      console.error("Failed to create project", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <section className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
          Organization
        </h1>
        <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed">
          Manage your top-level organization and underlying projects. Tracking
          data and API keys are isolated within a Project to keep environments
          separate.
        </p>
      </section>

      <section>
        <div className="border border-white/10 bg-[#141418] p-8 relative overflow-hidden shadow-[6px_6px_0_0_#4f46e5]">
          <div className="flex flex-col gap-4 relative z-10">
            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-1">
                Current Organization ID
              </p>
              <p className="font-mono text-sm text-indigo-300 break-all bg-indigo-500/10 inline-block px-3 py-1.5 border border-indigo-500/20">
                {user?.org_id || "Loading..."}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-zinc-500 font-semibold mb-1">
                Owner
              </p>
              <p className="text-zinc-100 font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="absolute -bottom-16 -right-16 text-indigo-500/5 rotate-12 pointer-events-none">
            <Planet weight="fill" size={240} />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h2 className="text-2xl font-bold text-white">Projects</h2>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_0_#4338ca] hover:bg-indigo-500 hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#4338ca] active:shadow-none active:translate-x-[3px] active:translate-y-[3px] transition-all border-2 border-transparent">
                <Plus weight="bold" /> New Project
              </button>
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
                  <input
                    id="projectName"
                    type="text"
                    placeholder="e.g. Production API"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-[#0f0f12] border-2 border-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreating || !newProjectName.trim()}
                  className="group flex items-center justify-center gap-2 border-2 border-transparent bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[4px_4px_0_0_#4338ca] active:translate-y-[2px] active:translate-x-[2px] active:shadow-[2px_2px_0_0_#4338ca]"
                >
                  {isCreating ? "Creating..." : "Launch Project"}
                  {!isCreating && (
                    <Plus
                      weight="bold"
                      className="group-hover:rotate-90 transition-transform"
                    />
                  )}
                </button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {status === "loading" && (
          <p className="text-zinc-500 font-mono animate-pulse">
            Loading active projects...
          </p>
        )}
        {status === "failed" && (
          <p className="text-red-400 font-mono italic">
            Failed to load projects: {error}
          </p>
        )}

        {status === "succeeded" && projects.length === 0 && (
          <div className="border border-dashed border-white/20 p-12 flex flex-col items-center justify-center text-center bg-[#141418]/50">
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
                className={`group border-2 p-6 flex flex-col justify-between min-h-[160px] transition-all
                  ${
                    activeProjectId === proj.id
                      ? "border-indigo-400 bg-[#1a1a24] shadow-[4px_4px_0_0_#818cf8]"
                      : "border-white/10 bg-[#0f0f12] hover:border-white/30 hover:-translate-y-1 hover:shadow-[4px_4px_0_0_#ffffff30]"
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
                  className={`flex items-center gap-1 text-sm font-semibold transition-colors w-max
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
