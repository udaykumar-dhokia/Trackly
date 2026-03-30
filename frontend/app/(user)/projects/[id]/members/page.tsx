"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchProjectMembers,
  addProjectMember,
  removeProjectMember,
  fetchOrgMembers,
} from "@/lib/store/features/projectsSlice";
import {
  Users,
  UserPlus,
  Trash,
  WarningCircle,
  CaretLeft,
  ArrowClockwise,
  Envelope,
  IdentificationBadge,
  ShieldCheck,
  CheckCircle,
  XCircle,
  User,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useUser } from "@auth0/nextjs-auth0/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProjectMembersPage() {
  const params = useParams();
  const projectId = params.id as string;
  const { user: authUser } = useUser();
  const dispatch = useAppDispatch();

  const {
    items: projects,
    members,
    membersStatus,
    orgMembers,
    orgMembersStatus,
    activeProjectId,
    organizations,
    activeOrgId,
  } = useAppSelector((state) => state.projects);
  const project = projects.find((p) => p.id === projectId);
  const activeOrg = organizations.find((o) => o.id === activeOrgId);
  const isOrgAdmin = activeOrg?.role === "admin" || activeOrg?.role === "owner";

  const currentProjectMember = members.find((m) => m.email === authUser?.email);
  const isProjectAdmin = currentProjectMember?.role === "admin" || isOrgAdmin;

  const router = useRouter();

  useEffect(() => {
    if (activeProjectId && activeProjectId !== projectId) {
      router.push(`/projects/${activeProjectId}/members`);
    }
  }, [activeProjectId, projectId, router]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    exists: boolean;
    inOrg: boolean;
    name: string | null;
  } | null>(null);

  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const [memberIdToRemove, setMemberIdToRemove] = useState<string | null>(null);

  useEffect(() => {
    const checkEmail = async () => {
      if (!email || !email.includes("@") || !project?.org_id) {
        setEmailStatus(null);
        return;
      }

      setCheckingEmail(true);
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(
          `${apiUrl}/api/v1/users/check?email=${encodeURIComponent(email)}&org_id=${project.org_id}`,
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
  }, [email, project?.org_id]);

  useEffect(() => {
    if (projectId && authUser?.sub) {
      dispatch(fetchProjectMembers({ projectId, auth0Id: authUser.sub }));
    }
  }, [projectId, dispatch, authUser?.sub]);

  useEffect(() => {
    if (project?.org_id) {
      dispatch(fetchOrgMembers(project.org_id));
    }
  }, [project?.org_id, dispatch]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsAdding(true);
    setAddError(null);
    try {
      await dispatch(
        addProjectMember({
          projectId,
          email,
          role,
          auth0Id: authUser?.sub || undefined,
        }),
      ).unwrap();
      setEmail("");
      setEmailStatus(null);
      toast.success("Member added to project", {
        description: `${email} has been granted ${role} access.`,
      });
    } catch (err: any) {
      const msg = err.message || "Failed to add member";
      setAddError(msg);
      toast.error(msg);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!memberIdToRemove || !authUser?.sub) return;
    try {
      await dispatch(
        removeProjectMember({
          projectId,
          userId: memberIdToRemove,
          auth0Id: authUser.sub,
        }),
      ).unwrap();
      toast.success("Member removed");
      setIsRemoveDialogOpen(false);
      setMemberIdToRemove(null);
    } catch (err: any) {
      toast.error("Failed to remove member");
    }
  };

  if (!project && membersStatus !== "loading") {
    return (
      <div className="p-8 text-red-500 font-mono">
        Project not found or you don't have access.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Project Members
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-3xl leading-relaxed">
            Manage user access and roles for{" "}
            <span className="text-indigo-300 font-bold">{project?.name}</span>.
            Members added here will be able to view dashboards, telemetry, and
            manage API keys for this project.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Current Members
              <span className="text-xs px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                {members.length}
              </span>
            </h2>
            <button
              onClick={() => dispatch(fetchProjectMembers({ projectId, auth0Id: authUser?.sub || "" }))}
              disabled={membersStatus === "loading"}
              className="flex items-center cursor-pointer justify-center p-2 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh Members"
            >
              <ArrowClockwise
                weight="bold"
                size={20}
                className={membersStatus === "loading" ? "animate-spin" : ""}
              />
            </button>
          </div>

          {membersStatus === "loading" && members.length === 0 && (
            <div className="text-zinc-500 font-mono animate-pulse">
              Hydrating member list...
            </div>
          )}

          <div className="space-y-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-6 border-2 border-white/10 bg-[#141418] rounded-xl hover:border-white/20 transition-all flex items-center justify-between group shadow-[4px_4px_0_0_rgba(255,255,255,0.02)]"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 bg-indigo-500/10 border-2 rounded-xl border-indigo-500/20 flex items-center justify-center overflow-hidden text-indigo-400 font-bold shrink-0">
                    {member.profile_photo ? (
                      <img
                        src={member.profile_photo}
                        alt={member.name || "Member"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      member.name?.[0]?.toUpperCase() ||
                      member.email[0].toUpperCase()
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      {member.name || "Anonymous User"}
                      {authUser?.email === member.email && (
                        <span className="text-[10px] bg-white/10 text-zinc-400 border border-white/10 px-1.5 py-0.5 uppercase tracking-tighter">
                          You
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono">
                      {member.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {authUser?.email !== member.email && isProjectAdmin && (
                    <button
                      onClick={() => {
                        setMemberIdToRemove(member.user_id);
                        setIsRemoveDialogOpen(true);
                      }}
                      className="cursor-pointer text-zinc-600 hover:text-red-400 transition-colors p-2"
                      title="Remove Member"
                    >
                      <Trash size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isProjectAdmin && (
          <div className="lg:col-span-1">
            <div className="rounded-xl bg-[#141418] p-8 sticky top-8 space-y-6">
              <h3 className="text-xl font-bold text-white uppercase tracking-tighter">
                Add Collaborator
              </h3>

              {orgMembers.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <User size={14} /> Quick Add (Org Member)
                  </label>

                  <Select
                    value={orgMembers.find((m) => m.email === email)?.email || ""}
                    onValueChange={(value) => {
                      if (value) setEmail(value)
                    }}
                  >
                    <SelectTrigger className="w-full bg-[#0f0f12] border-2 border-white/10 px-4 py-3 text-zinc-100 focus:border-indigo-500 focus:ring-0 focus:ring-offset-0 transition-colors font-mono rounded-xl h-auto">
                      <SelectValue placeholder="Select a teammate..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0f12] border border-white/10 text-zinc-100 rounded-xl">
                      {orgMembers
                        .filter(
                          (m) =>
                            !members.some((pm) => pm.email === m.email) &&
                            m.email !== authUser?.email
                        )
                        .map((member) => (
                          <SelectItem
                            key={member.id}
                            value={member.email}
                            className="font-mono text-sm text-zinc-200 focus:bg-white/5 focus:text-white cursor-pointer"
                          >
                            {member.name || member.email}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <p className="text-[9px] text-zinc-500 font-mono italic px-1">
                    Choose from existing organization members
                  </p>
                </div>
              )}

              <div className="relative flex items-center gap-4 py-2">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                  or
                </span>
                <div className="flex-1 h-px bg-white/5" />
              </div>

              <form onSubmit={handleAddMember} className="flex flex-col gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <Envelope size={14} /> User Email
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full rounded-xl bg-[#0f0f12] border-2 px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:outline-none transition-colors font-mono
                ${emailStatus?.inOrg
                          ? "border-emerald-500/50"
                          : emailStatus?.exists
                            ? "border-indigo-500/50"
                            : emailStatus?.exists === false && email.includes("@")
                              ? "border-amber-500/50"
                              : "border-white/10 focus:border-indigo-500"
                        }`}
                      required
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                      {checkingEmail && (
                        <ArrowClockwise className="animate-spin text-zinc-500" size={16} />
                      )}
                      {!checkingEmail && emailStatus?.inOrg && (
                        <CheckCircle className="text-emerald-500" weight="fill" size={18} />
                      )}
                      {!checkingEmail && emailStatus?.exists && !emailStatus.inOrg && (
                        <UserPlus className="text-indigo-500" weight="fill" size={18} />
                      )}
                      {!checkingEmail && emailStatus?.exists === false && email.includes("@") && (
                        <XCircle className="text-amber-500" weight="fill" size={18} />
                      )}
                    </div>
                  </div>
                  {emailStatus?.inOrg && (
                    <p className="text-[10px] text-emerald-500 font-mono mt-1 italic">
                      Member found: {emailStatus.name}
                    </p>
                  )}
                  {emailStatus?.exists && !emailStatus.inOrg && (
                    <p className="text-[10px] text-indigo-400 font-mono mt-1 italic">
                      External user: {emailStatus.name} (Will be added to org)
                    </p>
                  )}
                  {emailStatus?.exists === false && email.includes("@") && (
                    <p className="text-[10px] text-amber-500 font-mono mt-1 italic">
                      New user (will be invited).
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <IdentificationBadge size={14} /> Role
                  </label>

                  <Select value={role} onValueChange={(value) => setRole(value)}>
                    <SelectTrigger className="w-full bg-[#0f0f12] border-2 border-white/10 px-4 py-3 text-zinc-100 focus:border-indigo-500 focus:ring-0 focus:ring-offset-0 transition-colors font-mono rounded-xl h-auto">
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0f0f12] border border-white/10 text-zinc-100 rounded-xl">
                      <SelectItem
                        value="member"
                        className="font-mono text-sm text-zinc-200 focus:bg-white/5 focus:text-white cursor-pointer"
                      >
                        Project Member
                      </SelectItem>
                      <SelectItem
                        value="admin"
                        className="font-mono text-sm text-zinc-200 focus:bg-white/5 focus:text-white cursor-pointer"
                      >
                        Project Admin
                      </SelectItem>
                      <SelectItem
                        value="viewer"
                        className="font-mono text-sm text-zinc-200 focus:bg-white/5 focus:text-white cursor-pointer"
                      >
                        Viewer Only
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {addError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-mono flex gap-2">
                    <WarningCircle size={14} className="shrink-0" />
                    {addError}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isAdding || !email.trim()}
                  className="group flex items-center justify-center gap-2 bg-white/20 text-white font-bold py-4 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed tracking-tighter"
                >
                  {isAdding ? "Inviting..." : "Grant Access"}
                </Button>
              </form>

              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  Note: Users must already be registered within your organization
                  to be added to specific projects.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent className="bg-[#141418] border-2 border-white/10 text-zinc-100 rounded-none shadow-[12px_12px_0_0_#4f46e5]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold uppercase tracking-tight text-white">
              Remove Member?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 font-mono text-xs">
              This will immediately revoke their access to this project. They
              will no longer be able to view dashboards or manage API keys here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-transparent border-2 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 rounded-none font-bold transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-none shadow-[4px_4px_0_0_#4338ca] active:translate-y-px active:shadow-none transition-all"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
