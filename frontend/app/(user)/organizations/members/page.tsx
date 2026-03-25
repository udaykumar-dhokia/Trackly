"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchOrgMembers,
  addOrgUser,
} from "@/lib/store/features/projectsSlice";
import {
  Users,
  UserPlus,
  CheckCircle,
  XCircle,
  ArrowClockwise,
  Envelope,
  ShieldCheck,
  Planet,
} from "@phosphor-icons/react";

export default function OrganizationMembersPage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const { orgMembers, orgMembersStatus, activeOrgId } = useAppSelector(
    (state) => state.projects,
  );

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
          Organization Members
        </h1>
        <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed">
          Manage who has top-level access to your organization. Users added here
          can be assigned to specific projects later.
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
                {activeOrgId || "Loading..."}
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

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-2">
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider">
              Roster
              <span className="ml-2 text-xs font-mono text-zinc-500">
                [{orgMembers.length}]
              </span>
            </h2>
          </div>
          {orgMembersStatus === "loading" && orgMembers.length === 0 && (
            <p className="text-zinc-500 font-mono animate-pulse">
              Fetching roster...
            </p>
          )}
          <div className="space-y-4">
            {orgMembers.map((member) => (
              <div
                key={member.id}
                className="p-5 border-2 border-white/5 bg-[#141418] flex items-center justify-between group shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
              >
                <div className="flex items-center gap-4">
                  <div className="size-10 bg-indigo-500/10 border-2 border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                    {member.name?.[0]?.toUpperCase() ||
                      member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white flex items-center gap-2">
                      {member.name || "Anonymous User"}
                      {user?.email === member.email && (
                        <span className="text-[9px] bg-white/10 text-zinc-400 border border-white/10 px-1.5 py-0.5 uppercase tracking-widest font-bold">
                          Owner
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-zinc-500 font-mono">
                      {member.email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-[#1a1a24] border border-white/10 text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  Member
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="border shadow-lg bg-[#0f0f12] p-6 space-y-6 sticky top-8">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserPlus size={20} className="text-indigo-400" />
              Invite Member
            </h3>
            <form onSubmit={handleInviteUser} className="flex flex-col gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2 font-mono">
                  <Envelope size={14} /> Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="teammate@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full bg-[#141418] border-2 px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:outline-none transition-colors font-mono
                      ${
                        emailStatus?.inOrg
                          ? "border-emerald-500/50"
                          : emailStatus?.exists
                            ? "border-indigo-500/50"
                            : emailStatus?.exists === false &&
                                email.includes("@")
                              ? "border-amber-500/50"
                              : "border-white/10 focus:border-indigo-500"
                      }`}
                    required
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {checkingEmail && (
                      <ArrowClockwise
                        className="animate-spin text-zinc-500"
                        size={16}
                      />
                    )}
                    {!checkingEmail && emailStatus?.inOrg && (
                      <CheckCircle
                        className="text-emerald-500"
                        weight="fill"
                        size={18}
                      />
                    )}
                    {!checkingEmail &&
                      emailStatus?.exists &&
                      !emailStatus.inOrg && (
                        <UserPlus
                          className="text-indigo-500"
                          weight="fill"
                          size={18}
                        />
                      )}
                    {!checkingEmail &&
                      emailStatus?.exists === false &&
                      email.includes("@") && (
                        <XCircle
                          className="text-amber-500"
                          weight="fill"
                          size={18}
                        />
                      )}
                  </div>
                </div>
                {emailStatus?.inOrg && (
                  <p className="text-[10px] text-emerald-500 font-mono italic">
                    Member: {emailStatus.name || "Already in org"}
                  </p>
                )}
                {emailStatus?.exists && !emailStatus.inOrg && (
                  <p className="text-[10px] text-indigo-400 font-mono italic">
                    Found user: {emailStatus.name}. (Can be added)
                  </p>
                )}
                {emailStatus?.exists === false && email.includes("@") && (
                  <p className="text-[10px] text-amber-500 font-mono italic">
                    New user (will be invited).
                  </p>
                )}
              </div>

              {inviteError && (
                <p className="text-xs text-red-500 font-mono bg-red-500/10 p-2 border border-red-500/20">
                  {inviteError}
                </p>
              )}

              <button
                type="submit"
                disabled={isInviting || !email.trim() || emailStatus?.inOrg}
                className="w-full bg-indigo-600 text-white font-bold py-3 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
              >
                {isInviting ? "Adding..." : "Add to Organization"}
              </button>
              {emailStatus?.inOrg && (
                <p className="text-[10px] text-zinc-500 font-mono italic text-center">
                  User is already a member of this organization.
                </p>
              )}
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
