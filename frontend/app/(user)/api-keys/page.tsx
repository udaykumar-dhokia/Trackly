"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { toast } from "sonner";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  fetchApiKeys,
  createApiKey,
  revokeApiKey,
  clearNewKeyDisplay,
  accessApiKey,
} from "@/lib/store/features/apiKeysSlice";
import { fetchOrgMembers } from "@/lib/store/features/projectsSlice";
import {
  Key,
  Plus,
  Trash,
  WarningCircle,
  CheckCircle,
  Copy,
  ArrowClockwise,
} from "@phosphor-icons/react";

export default function ApiKeysPage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const {
    items: keys,
    status,
    newKeyDisplay,
    lastFetchedOrgId,
  } = useAppSelector((state) => state.apiKeys);
  const { 
    items: projects, 
    activeOrgId, 
    organizations,
    orgMembers 
  } = useAppSelector(
    (state) => state.projects,
  );

  const activeOrg = organizations.find((o) => o.id === activeOrgId);
  const isAdminOrOwner = activeOrg?.role === "admin" || activeOrg?.role === "owner";

  const [isCreating, setIsCreating] = useState(false);
  const [accessingKeyId, setAccessingKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeOrgId) {
      if (lastFetchedOrgId !== activeOrgId) {
        dispatch(fetchApiKeys(activeOrgId));
        dispatch(fetchOrgMembers(activeOrgId));
      }
    }
  }, [activeOrgId, dispatch, lastFetchedOrgId]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !activeOrgId) return;
    setIsCreating(true);
    try {
      const currentUser = orgMembers.find(m => m.auth0_id === user?.sub);
      
      const payloadProjectId =
        selectedProjectId === "none" ? null : selectedProjectId;
      await dispatch(
        createApiKey({
          orgId: activeOrgId,
          name: newKeyName,
          projectId: payloadProjectId,
          userId: currentUser?.id,
        }),
      ).unwrap();
      setNewKeyName("");
      setSelectedProjectId("none");
      toast.success("API Key Created", {
        description: "Your new key is ready to use."
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to create key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAccessKey = async (keyId: string) => {
    if (!user?.sub) return;
    setAccessingKeyId(keyId);
    try {
      await dispatch(
        accessApiKey({
          keyId,
          auth0Id: user.sub,
        }),
      ).unwrap();
      window.scrollTo({ top: 0, behavior: "smooth" });
      toast.success("Access key generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate access key");
    } finally {
      setAccessingKeyId(null);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (
      confirm(
        "Are you sure you want to revoke this key? It will immediately stop working.",
      )
    ) {
      try {
        await dispatch(revokeApiKey(keyId)).unwrap();
        toast.success("Key revoked successfully");
      } catch (err: any) {
        toast.error("Failed to revoke key");
      }
    }
  };

  const copyToClipboard = () => {
    if (newKeyDisplay) {
      navigator.clipboard.writeText(newKeyDisplay.raw_key);
      setCopied(true);
      toast.success("Key copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <section className="flex flex-col gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
          API Keys
        </h1>
        <p className="text-zinc-400 font-mono text-sm max-w-3xl leading-relaxed">
          Manage organizational API keys used to authenticate requests to the
          Trackly ingest API. Keys can be scoped to specific projects to cleanly
          separate traffic.
        </p>
      </section>

      {newKeyDisplay && (
        <section className="border-4 border-emerald-500 bg-emerald-500/10 p-8 shadow-[8px_8px_0_0_#10b981] space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={32} weight="fill" className="text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">API Key Generated</h2>
          </div>
          <p className="text-zinc-300 font-mono text-sm">
            Please copy this key immediately. You will <strong>never</strong> be
            able to see it again.
          </p>
          <div className="flex items-center gap-4">
            <code className="flex-1 bg-black border-2 border-emerald-500/50 p-4 font-mono text-emerald-300 text-lg break-all">
              {newKeyDisplay.raw_key}
            </code>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-2 bg-emerald-500 text-black font-bold border-2 border-black p-4 shadow-[4px_4px_0_0_#000] hover:translate-y-px hover:translate-x-px hover:shadow-[3px_3px_0_0_#000] active:shadow-none active:translate-y-[4px] active:translate-x-[4px] transition-all"
            >
              {copied ? "Copied!" : "Copy"}
              <Copy weight="bold" />
            </button>
          </div>
          <button
            onClick={() => dispatch(clearNewKeyDisplay())}
            className="text-sm border-b border-emerald-500/50 text-emerald-400 hover:text-emerald-300 transition-colors mt-4"
          >
            I have saved this key safely
          </button>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <h2 className="text-2xl font-bold text-white">Active Keys</h2>
            <button
              onClick={() => {
                if (activeOrgId) dispatch(fetchApiKeys(activeOrgId));
              }}
              disabled={status === "loading"}
              className="flex items-center justify-center p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
              title="Refresh API Keys"
            >
              <ArrowClockwise
                weight="bold"
                size={20}
                className={status === "loading" ? "animate-spin" : ""}
              />
            </button>
          </div>

          {status === "loading" && (
            <div className="text-zinc-500 font-mono animate-pulse">
              Loading secure keys...
            </div>
          )}

          {status === "succeeded" && keys.length === 0 && (
            <div className="border border-dashed border-white/20 p-12 flex flex-col items-center justify-center text-center bg-[#141418]/50">
              <p className="text-zinc-300 mb-2">No API keys found.</p>
              <p className="text-zinc-500 text-sm max-w-sm mb-6">
                Create an API key to start authenticating your backend traffic.
              </p>
            </div>
          )}

          {status === "succeeded" && keys.length > 0 && (
            <div className="space-y-4">
              {keys.map((key) => {
                const linkedProject = projects.find(
                  (p) => p.id === key.project_id,
                );
                return (
                  <div
                    key={key.id}
                    className={`p-6 border-2 transition-all flex items-center justify-between
                              ${key.is_active ? "border-white/10 bg-[#141418] hover:border-white/30" : "border-red-500/20 bg-red-500/5 opacity-50"}
                          `}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg text-white">
                          {key.name}
                        </h3>
                        {key.parent_key_id && (
                          <span className="text-[10px] uppercase font-bold text-emerald-400 border border-emerald-500/30 px-2 py-0.5 bg-emerald-500/10">
                            Derived
                          </span>
                        )}
                        {!key.parent_key_id && (
                          <span className="text-[10px] uppercase font-bold text-indigo-400 border border-indigo-500/30 px-2 py-0.5 bg-indigo-500/10">
                            Master
                          </span>
                        )}
                        {!key.is_active && (
                          <span className="text-[10px] uppercase font-bold text-red-400 border border-red-500/30 px-2 py-0.5 bg-red-500/10">
                            Revoked
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono">
                        <span className="text-amber-300/80 tracking-wider">
                          Prefix: {key.key_prefix}...
                        </span>

                        {key.project_id ? (
                          <span className="text-indigo-400 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20">
                            Project:{" "}
                            {linkedProject
                              ? linkedProject.name
                              : key.project_id.split("-")[0]}
                          </span>
                        ) : (
                          <span className="text-zinc-500 px-2 py-0.5 bg-white/5 border border-white/10">
                            Org-Level
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">
                        Created: {new Date(key.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!isAdminOrOwner && key.is_active && key.project_id && (
                        <button
                          onClick={() => handleAccessKey(key.id)}
                          disabled={accessingKeyId === key.id}
                          className="bg-emerald-500 text-black font-bold px-4 py-2 text-sm border-2 border-transparent hover:border-emerald-400 transition-colors disabled:opacity-50"
                        >
                          {accessingKeyId === key.id ? "Working..." : "Access"}
                        </button>
                      )}

                      {key.is_active && (isAdminOrOwner || key.created_by_user_id) && (
                        <button
                          onClick={() => handleRevoke(key.id)}
                          className="text-zinc-500 hover:text-red-400 transition-colors p-2 border border-transparent hover:border-red-500/30"
                        >
                          <Trash size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          {isAdminOrOwner && (
            <div className="border-2 border-white/10 bg-[#141418] p-6 sticky top-8 shadow-[6px_6px_0_0_rgba(255,255,255,0.05)]">
              <h3 className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-4">
                Generate API Key
            </h3>
            <form onSubmit={handleCreateKey} className="flex flex-col gap-6">
              <div className="space-y-2">
                <label
                  htmlFor="keyName"
                  className="text-sm font-bold text-zinc-300 uppercase tracking-widest"
                >
                  Key Name
                </label>
                <input
                  id="keyName"
                  type="text"
                  placeholder="e.g. Production Worker"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full bg-[#0f0f12] border-2 border-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="projectScope"
                  className="text-sm font-bold text-zinc-300 uppercase tracking-widest flex items-center justify-between"
                >
                  Scope
                  <span className="text-[10px] text-zinc-500 font-normal normal-case">
                    Optional
                  </span>
                </label>
                <select
                  id="projectScope"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full bg-[#0f0f12] border-2 border-white/10 px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors appearance-none cursor-pointer"
                >
                  <option value="none">Organization Wide (Default)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <div className="text-xs text-zinc-500 pt-1 flex gap-2">
                  <WarningCircle size={14} className="shrink-0 mt-0.5" />
                  <p>
                    Keys without a project scope cannot log events, they can
                    only manage Top-Level models.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating || !newKeyName.trim()}
                className="mt-4 group flex items-center justify-center gap-2 border-2 border-transparent bg-amber-500 px-5 py-4 font-bold text-black hover:bg-amber-400 focus:ring-2 focus:ring-amber-500 focus:outline-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[4px_4px_0_0_#b45309] active:translate-y-[2px] active:translate-x-[2px] active:shadow-[2px_2px_0_0_#b45309]"
              >
                {isCreating ? "Generating..." : "Generate Secure Key"}
                {!isCreating && (
                  <Plus
                    weight="bold"
                    className="group-hover:rotate-90 transition-transform"
                  />
                )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
