"use client"

import { useUser } from "@auth0/nextjs-auth0/client"
import { Gear, UserCircle, Envelope, IdentificationCard, Buildings } from "@phosphor-icons/react"
import Link from "next/link"

export default function SettingsPage() {
  const { user, isLoading } = useUser()

  if (isLoading) {
    return <div className="p-8 text-zinc-500 font-mono animate-pulse">Loading preferences...</div>
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">

      {/* HEADER */}
      <section className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Gear weight="duotone" className="text-zinc-400" />
          Settings
        </h1>
        <p className="text-zinc-400 text-sm max-w-2xl">
          Manage your account preferences and view identity parameters synced via Auth0.
        </p>
      </section>

      {/* ACCOUNT DETAILS */}
      <section>
        <div className="bg-[#141418] border border-white/10 rounded-xl overflow-hidden shadow-lg space-y-0">
          
          <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-white/5">
             <UserCircle size={40} weight="duotone" className="text-zinc-400" />
             <div>
               <h2 className="text-xl font-semibold text-white">Profile Identity</h2>
               <p className="text-zinc-500 text-xs">Synchronized from your Auth0 Provider</p>
             </div>
          </div>

          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                   <IdentificationCard size={16}/> Full Name
                </label>
                <div className="bg-[#0f0f12] border border-white/5 rounded-lg px-4 py-3 text-zinc-200 shadow-inner">
                   {user?.name}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                   <Envelope size={16}/> Email Address
                </label>
                <div className="bg-[#0f0f12] border border-white/5 rounded-lg px-4 py-3 text-zinc-200 shadow-inner flex items-center justify-between">
                   <span>{user?.email}</span>
                   {user?.email_verified && <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md">Verified</span>}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                   <IdentificationCard size={16}/> Subject UUID
                </label>
                <div className="bg-[#0f0f12] border border-white/5 rounded-lg px-4 py-3 text-zinc-400 font-mono text-sm break-all shadow-inner">
                   {user?.sub}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                   <Buildings size={16}/> Active Organization
                </label>
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg px-4 py-3 text-indigo-300 font-mono text-sm break-all shadow-inner">
                   {user?.org_id as string || 'Unassigned'}
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-5 border-t border-white/5 bg-[#1a1a24] flex justify-end">
             <Link
              href="/auth/logout"
              className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 font-medium py-2 px-6 rounded-lg transition-colors text-sm"
            >
              Sign Out
            </Link>
          </div>

        </div>
      </section>

    </div>
  )
}
