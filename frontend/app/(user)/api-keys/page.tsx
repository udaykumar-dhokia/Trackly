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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    activeProjectId,
    organizations,
    orgMembers,
  } = useAppSelector((state) => state.projects);

  const activeOrg = organizations.find((o) => o.id === activeOrgId);
  const isAdminOrOwner =
    activeOrg?.role === "admin" || activeOrg?.role === "owner";
  const currentUser = orgMembers.find((m) => m.auth0_id === user?.sub);

  const [isCreating, setIsCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRevokeDialogOpen, setIsRevokeDialogOpen] = useState(false);
  const [keyIdToRevoke, setKeyIdToRevoke] = useState<string | null>(null);
  const [accessingKeyId, setAccessingKeyId] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeOrgId && user?.sub) {
      if (lastFetchedOrgId !== activeOrgId) {
        dispatch(fetchApiKeys({ orgId: activeOrgId, auth0Id: user.sub }));
        dispatch(fetchOrgMembers(activeOrgId));
      }
    }
  }, [activeOrgId, dispatch, lastFetchedOrgId, user?.sub]);

  useEffect(() => {
    if (activeProjectId && activeProjectId !== "none") {
      setSelectedProjectId(activeProjectId);
    }
  }, [activeProjectId]);

  const filteredMasterKeys = keys.filter(
    (k) =>
      !k.parent_key_id &&
      (k.project_id === activeProjectId || k.project_id === null),
  );

  const filteredDerivedKeys = keys.filter(
    (k) => k.parent_key_id && k.project_id === activeProjectId,
  );

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim() || !activeOrgId) return;
    setIsCreating(true);
    try {
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
      setSelectedProjectId(activeProjectId || "none");
      setIsDialogOpen(false);
      toast.success("API Key Created", {
        description: "Your new key is ready to use.",
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

  const handleRevoke = async () => {
    if (!keyIdToRevoke || !user?.sub) return;
    try {
      await dispatch(
        revokeApiKey({ keyId: keyIdToRevoke, auth0Id: user.sub }),
      ).unwrap();
      toast.success("Key revoked successfully");
      setIsRevokeDialogOpen(false);
      setKeyIdToRevoke(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke key");
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

  const renderKeyTable = (
    keys: any[],
    title: string,
    type: "master" | "access",
  ) => {
    if (keys.length === 0) {
      return (
        <div className="p-8 border-2 border-dashed border-white/5 bg-white/5 text-center rounded-xl text-zinc-600 text-xs font-mono italic">
          No {type === "master" ? "master" : "access"} keys found for this
          project scope.
        </div>
      );
    }

    return (
      <div className="w-full overflow-x-auto border-2 border-white/10 bg-[#141418] rounded-xl">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead>
            <tr className="border-b-2 border-white/10 bg-white/5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <th className="px-4 py-3 font-black">Name</th>
              <th className="px-4 py-3 font-black hidden sm:table-cell">
                Scope
              </th>
              <th className="px-4 py-3 font-black hidden md:table-cell">
                Prefix
              </th>
              <th className="px-4 py-3 font-black hidden lg:table-cell">
                Created
              </th>
              <th className="px-4 py-3 font-black text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {keys.map((key) => {
              const linkedProject = projects.find(
                (p) => p.id === key.project_id,
              );
              return (
                <tr
                  key={key.id}
                  className={`group transition-colors ${key.is_active ? "hover:bg-white/5" : "opacity-50 grayscale bg-red-500/5"}`}
                >
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-white text-sm">
                        {key.name}
                      </span>
                      {!key.is_active && (
                        <span className="text-[8px] uppercase font-bold text-red-400 mt-1">
                          Revoked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell">
                    {key.project_id ? (
                      <span className="text-[10px] uppercase font-bold text-indigo-400 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 whitespace-nowrap">
                        {linkedProject ? linkedProject.name : "Project"}
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-0.5 bg-white/5 border border-white/10 whitespace-nowrap">
                        Org-Level
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <code className="text-[10px] text-amber-300/80 font-mono">
                      {key.key_prefix}...
                    </code>
                  </td>
                  <td className="px-4 py-4 hidden lg:table-cell">
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(key.created_at).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!isAdminOrOwner &&
                        key.is_active &&
                        key.project_id &&
                        !key.parent_key_id &&
                        !keys.some(
                          (k) =>
                            k.parent_key_id === key.id &&
                            k.created_by_user_id === currentUser?.id &&
                            k.is_active,
                        ) && (
                          <button
                            onClick={() => handleAccessKey(key.id)}
                            disabled={accessingKeyId === key.id}
                            className="bg-emerald-500 cursor-pointer text-black font-bold px-3 py-1.5 text-[10px] uppercase tracking-tighter border-2 border-transparent hover:border-emerald-400 transition-colors disabled:opacity-50 shadow-[2px_2px_0_0_#065f46] active:translate-y-px active:shadow-none whitespace-nowrap"
                          >
                            {accessingKeyId === key.id
                              ? "Working..."
                              : "Get Access"}
                          </button>
                        )}

                      {key.is_active &&
                        (isAdminOrOwner ||
                          (currentUser &&
                            key.created_by_user_id === currentUser.id)) && (
                          <button
                            onClick={() => {
                              setKeyIdToRevoke(key.id);
                              setIsRevokeDialogOpen(true);
                            }}
                            className="text-zinc-500 hover:text-red-400 transition-colors p-2 border border-transparent hover:border-red-500/30 cursor-pointer"
                            title="Revoke Key"
                          >
                            <Trash size={18} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            API Keys
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-2xl leading-relaxed">
            Manage organizational API keys used to authenticate requests to the
            Trackly ingest API. Keys can be scoped to specific projects to
            cleanly separate traffic.
          </p>
        </div>

        {isAdminOrOwner && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2 bg-white/20 text-white font-black px-6 py-3 active:translate-y-px active:shadow-none transition-all cursor-pointer">
                <Plus weight="bold" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#141418] border-2 border-white/10 text-zinc-100 max-w-md p-8 rounded-xl">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black tracking-tight text-white mb-4">
                  Generate API Key
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateKey} className="flex flex-col gap-6">
                <div className="space-y-2">
                  <label
                    htmlFor="keyName"
                    className="text-xs font-black text-zinc-500 uppercase tracking-widest"
                  >
                    Key Name
                  </label>
                  <Input
                    id="keyName"
                    type="text"
                    placeholder="e.g. Production Worker"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full bg-[#0f0f12] border-2 border-white/10 px-4 py-3 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors rounded-xl"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="projectScope"
                    className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center justify-between"
                  >
                    Scope
                    <span className="text-[10px] text-zinc-600 font-normal normal-case">
                      Optional
                    </span>
                  </label>
                  <Select
                    value={selectedProjectId}
                    onValueChange={(value) => setSelectedProjectId(value)}
                  >
                    <SelectTrigger className="w-full rounded-xl bg-[#0f0f12] border-2 border-white/10 px-4 py-3 text-zinc-100 focus:border-white/10 focus:ring-1 focus:ring-white/10">
                      <SelectValue placeholder="Organization Wide (Default)" />
                    </SelectTrigger>

                    <SelectContent className="bg-[#0f0f12] border-white/10 text-zinc-100 rounded-xl">
                      <SelectItem value="none">
                        Organization Wide (Default)
                      </SelectItem>

                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[10px] text-zinc-600 pt-1 flex gap-2 leading-relaxed">
                    <WarningCircle size={14} className="shrink-0 mt-0.5" />
                    <p>
                      Keys without a project scope cannot log events, they can
                      only manage Top-Level models.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button
                    type="button"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1 px-4 py-3 font-bold text-zinc-400 bg-transparent hover:text-white transition-colors"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating || !newKeyName.trim()}
                    className="flex-1 group cursor-pointer flex items-center justify-center gap-2 border-2 border-transparent bg-white/20 px-5 py-3 font-black text-white hover:bg-white/30 focus:ring-2 focus:ring-amber-500 focus:outline-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isCreating ? "Generating..." : "Generate"}
                    {!isCreating && <Key weight="bold" size={16} />}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </section>

      {newKeyDisplay && (
        <section className="border-2 border-emerald-500 bg-emerald-500/10 p-8 rounded-xl space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle size={32} weight="fill" className="text-emerald-400" />
            <h2 className="text-2xl font-bold text-white">API Key Generated</h2>
          </div>
          <p className="text-zinc-300 font-mono text-sm">
            Please copy this key immediately. You will <strong>never</strong> be
            able to see it again.
          </p>
          <div className="flex items-center gap-4">
            <code className="flex-1 bg-black border-2 border-emerald-500/50 px-4 py-1 font-mono text-emerald-300 text-lg break-all rounded-xl">
              {newKeyDisplay.raw_key}
            </code>
            <Button
              onClick={copyToClipboard}
              className="flex items-center gap-2 bg-emerald-500 text-black font-bold border-2 border-black p-4"
            >
              {copied ? "Copied!" : "Copy"}
              <Copy weight="bold" />
            </Button>
          </div>
          <button
            onClick={() => dispatch(clearNewKeyDisplay())}
            className="text-sm border-b border-emerald-500/50 text-emerald-400 hover:text-emerald-300 transition-colors mt-4"
          >
            I have saved this key safely
          </button>
        </section>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <h2 className="text-2xl font-bold text-white">Active Keys</h2>
          <button
            onClick={() => {
              if (activeOrgId && user?.sub) {
                dispatch(
                  fetchApiKeys({ orgId: activeOrgId, auth0Id: user.sub }),
                );
              }
            }}
            disabled={status === "loading"}
            className="flex cursor-pointer items-center justify-center p-2 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
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
          <div className="border border-dashed border-white/20 p-12 flex flex-col items-center justify-center rounded-xl text-center bg-[#141418]/50">
            <p className="text-zinc-300 mb-2">No API keys found.</p>
            <p className="text-zinc-500 text-sm max-w-sm mb-6">
              Create an API key to start authenticating your backend traffic.
            </p>
          </div>
        )}

        {status === "succeeded" && keys.length > 0 && (
          <div className="space-y-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
                  Master Keys
                </h3>
              </div>
              {renderKeyTable(filteredMasterKeys, "Master Keys", "master")}
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">
                  Access Keys
                </h3>
              </div>
              {renderKeyTable(filteredDerivedKeys, "Access Keys", "access")}
            </div>
          </div>
        )}
      </div>

      <AlertDialog
        open={isRevokeDialogOpen}
        onOpenChange={setIsRevokeDialogOpen}
      >
        <AlertDialogContent className="bg-[#141418] border-2 border-white/10 text-zinc-100 rounded-none shadow-[12px_12px_0_0_#000]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold uppercase tracking-tight text-white">
              Confirm Key Revocation
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 font-mono text-xs">
              This action is irreversible. Once revoked, any application using
              this API key will immediately lose access to the Trackly ingest
              API.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="bg-transparent border-2 border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 rounded-none font-bold transition-all">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              className="bg-red-500 hover:bg-red-400 text-white font-bold rounded-none shadow-[4px_4px_0_0_#991b1b] active:translate-y-px active:shadow-none transition-all"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
