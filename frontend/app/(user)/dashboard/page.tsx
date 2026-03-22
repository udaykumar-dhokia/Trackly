"use client"

import { useEffect, useState } from "react"
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks"
import { fetchDashboardStats } from "@/lib/store/features/statsSlice"
import { Coins, Database, ChartBar, Clock, WarningCircle, CaretRight, Funnel } from "@phosphor-icons/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

export default function DashboardPage() {
  const dispatch = useAppDispatch()

  // Read state from Redux
  const { items: projects, activeProjectId, status: projectsStatus } = useAppSelector((state) => state.projects)
  const { summary, models, status: statsStatus, error: statsError } = useAppSelector((state) => state.stats)

  const activeProject = projects.find(p => p.id === activeProjectId)

  // Local state for filtering
  const [providerFilter, setProviderFilter] = useState("all")

  useEffect(() => {
    // Whenever the active project or provider filter changes, fetch updated stats
    if (activeProjectId) {
      dispatch(fetchDashboardStats({ projectId: activeProjectId, provider: providerFilter }))
    }
  }, [activeProjectId, providerFilter, dispatch])

  // Content rendering based on state
  if (projectsStatus === 'loading' || (projectsStatus === 'idle' && !activeProjectId)) {
    return <div className="p-8 text-zinc-500 font-mono animate-pulse">Initializing Dashboard...</div>
  }

  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto mt-12 p-12 border-4 border-indigo-500 bg-[#141418] shadow-[12px_12px_0_0_#4f46e5] flex flex-col items-center text-center space-y-6">
        <WarningCircle size={64} weight="duotone" className="text-indigo-400" />
        <h1 className="text-3xl font-bold text-white">No Projects Found</h1>
        <p className="text-zinc-400 font-mono max-w-lg">
          You need a project to start tracking your AI costs and usage. Projects isolated your LLM tracking environments.
        </p>
        <Link
          href="/organizations"
          className="bg-indigo-500 text-white font-bold py-3 px-6 border-2 border-black shadow-[4px_4px_0_0_#000000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000000] inline-flex items-center gap-2 transition-all"
        >
          Create Your First Project
          <CaretRight weight="bold" />
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10">

      {/* HEADER SECTION */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Overview
            </h1>
            <span className="text-xs px-3 py-1 font-mono uppercase font-bold border-2 border-indigo-400 bg-indigo-400/10 text-indigo-300">
              Project: {activeProject?.name || 'Unknown'}
            </span>
          </div>
          <p className="text-zinc-400 font-mono text-sm max-w-3xl leading-relaxed">
            Aggregated analytics covering the last 30 days of LLM execution history. Track costs closely and optimize your average routing latency.
          </p>
        </div>

        {/* PROVIDER FILTER */}
        <div className="flex items-center gap-3 bg-[#1a1a24] border-2 border-white/10 px-4 py-2 self-start md:self-auto min-w-[200px]">
            <Funnel size={20} className="text-zinc-400" />
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="border-none w-full bg-transparent text-white font-bold font-mono text-sm focus:ring-0 px-0 h-auto shadow-none data-[state=open]:bg-transparent">
                  <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a24] border-2 border-white/10 text-white font-mono rounded-none">
                  <SelectItem value="all" className="focus:bg-white/10 focus:text-white cursor-pointer font-bold">All Providers</SelectItem>
                  <SelectItem value="openai" className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5">OpenAI</SelectItem>
                  <SelectItem value="anthropic" className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5">Anthropic</SelectItem>
                  <SelectItem value="google" className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5">Google</SelectItem>
                  <SelectItem value="cohere" className="focus:bg-white/10 focus:text-white cursor-pointer hover:bg-white/5">Cohere</SelectItem>
              </SelectContent>
            </Select>
        </div>
      </section>

      {/* STATS LOADING OR ERROR */}
      {statsStatus === 'loading' && <div className="p-8 text-indigo-400 font-mono border-2 border-white/10 bg-[#141418] animate-pulse shadow-[6px_6px_0_0_#818cf8]">Computing analytics matrix...</div>}
      {statsStatus === 'failed' && <div className="p-8 text-red-500 font-mono border-2 border-red-500/50 bg-[#141418] shadow-[6px_6px_0_0_#ef4444]">Error: {statsError}</div>}

      {/* SUMMARY STATS GRID */}
      {statsStatus === 'succeeded' && summary && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Estimated Cost"
            value={`$${summary.total_cost_usd.toFixed(4)}`}
            icon={<Coins weight="duotone" className="text-emerald-400" size={32} />}
            colorClass="border-emerald-500 shadow-[6px_6px_0_0_#10b981]"
          />
          <MetricCard
            title="Total Events"
            value={summary.total_events.toLocaleString()}
            icon={<ChartBar weight="duotone" className="text-indigo-400" size={32} />}
            colorClass="border-indigo-500 shadow-[6px_6px_0_0_#4f46e5]"
          />
          <MetricCard
            title="Total Tokens"
            value={summary.total_tokens.toLocaleString()}
            icon={<Database weight="duotone" className="text-fuchsia-400" size={32} />}
            colorClass="border-fuchsia-500 shadow-[6px_6px_0_0_#d946ef]"
          />
          <MetricCard
            title="Avg Latency"
            value={summary.avg_latency_ms ? `${summary.avg_latency_ms.toFixed(0)} ms` : 'N/A'}
            icon={<Clock weight="duotone" className="text-amber-400" size={32} />}
            colorClass="border-amber-500 shadow-[6px_6px_0_0_#f59e0b]"
          />
        </section>
      )}

      {/* MODEL BREAKDOWN TABLE */}
      {statsStatus === 'succeeded' && models && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6 uppercase tracking-wider">Usage By Model</h2>
          {models.length === 0 ? (
            <div className="bg-[#141418] border-2 border-white/10 p-8 text-zinc-500 font-mono">
              No models inferred in the last 30 days. Send events via the API to populate.
            </div>
          ) : (
            <div className="border-2 border-white/10 overflow-hidden bg-[#141418] shadow-[8px_8px_0_0_rgba(255,255,255,0.05)]">
              <table className="w-full text-left font-mono text-sm">
                <thead className="bg-[#1a1a24] border-b-2 border-white/10 text-zinc-400 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-4 border-r-2 border-white/10">Provider</th>
                    <th className="px-6 py-4 border-r-2 border-white/10">Model</th>
                    <th className="px-6 py-4 border-r-2 border-white/10 text-right">Events</th>
                    <th className="px-6 py-4 border-r-2 border-white/10 text-right">Tokens</th>
                    <th className="px-6 py-4 text-right">Cost (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-white/10">
                  {models.map((m, i) => (
                    <tr key={`${m.provider}-${m.model}-${i}`} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 border-r-2 border-white/10 font-bold text-zinc-300">{m.provider}</td>
                      <td className="px-6 py-4 border-r-2 border-white/10 text-indigo-300">{m.model}</td>
                      <td className="px-6 py-4 border-r-2 border-white/10 text-right">{m.event_count.toLocaleString()}</td>
                      <td className="px-6 py-4 border-r-2 border-white/10 text-right text-zinc-400">{m.total_tokens.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right text-emerald-400 font-bold">${m.total_cost_usd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

    </div>
  )
}

function MetricCard({ title, value, icon, colorClass }: { title: string, value: string | number, icon: React.ReactNode, colorClass: string }) {
  return (
    <div className={`bg-[#141418] border-2 p-6 flex flex-col justify-between h-40 ${colorClass}`}>
      <div className="flex justify-between items-start">
        <p className="text-zinc-400 font-bold uppercase tracking-wider text-xs">{title}</p>
        {icon}
      </div>
      <p className="text-3xl font-extrabold text-white">{value}</p>
    </div>
  )
}
