"use client"

import { useEffect, useState } from "react"
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks"
import { fetchEvents } from "@/lib/store/features/eventsSlice"
import { CaretLeft, CaretRight, WarningCircle, Funnel, ChartBar } from "@phosphor-icons/react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import Link from "next/link"

export default function EventsPage() {
  const dispatch = useAppDispatch()

  const { activeProjectId, status: projectsStatus } = useAppSelector((state) => state.projects)
  const { data: { items: events, page, has_more, total }, status, error } = useAppSelector((state) => state.events)

  const [currentPage, setCurrentPage] = useState(1)
  const [providerFilter, setProviderFilter] = useState("all")

  useEffect(() => {
    setCurrentPage(1)
  }, [providerFilter])

  useEffect(() => {
    if (activeProjectId) {
      dispatch(fetchEvents({ projectId: activeProjectId, page: currentPage, pageSize: 50, provider: providerFilter }))
    }
  }, [activeProjectId, currentPage, providerFilter, dispatch])


  const nextPage = () => {
    if (has_more) setCurrentPage(p => p + 1)
  }

  const prevPage = () => {
    if (currentPage > 1) setCurrentPage(p => p - 1)
  }

  if (projectsStatus === 'loading' || (projectsStatus === 'idle' && !activeProjectId)) {
    return <div className="p-8 text-zinc-500 font-mono animate-pulse">Initializing Event Subsystem...</div>
  }

  if (!activeProjectId) {
    return (
      <div className="max-w-4xl mx-auto mt-12 p-12 border-4 border-fuchsia-500 bg-[#141418] shadow-[12px_12px_0_0_#d946ef] flex flex-col items-center text-center space-y-6">
        <WarningCircle size={64} weight="duotone" className="text-fuchsia-400" />
        <h1 className="text-3xl font-bold text-white">No Active Project</h1>
        <p className="text-zinc-400 font-mono max-w-lg">
          Please select or create a project to view underlying telemetry and API events.
        </p>
        <Link
          href="/organizations"
          className="bg-fuchsia-500 text-black font-bold py-3 px-6 border-2 border-black shadow-[4px_4px_0_0_#000000] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000000] inline-flex items-center gap-2 transition-all"
        >
          Go to Organizations
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
          <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            Events Log
          </h1>
          <p className="text-zinc-400 font-mono text-sm max-w-3xl leading-relaxed">
            The raw, paginated telemetry stream originating from your API endpoints. Dive into deep tracking markers including tokens, estimated costs, execution latency, and custom feature tags.
          </p>
        </div>

        {/* PROVIDER FILTER */}
        <div className="flex items-center gap-3 bg-[#1a1a24] border-2 border-fuchsia-500/50 px-4 py-2 self-start md:self-auto shadow-[4px_4px_0_0_rgba(217,70,239,0.15)] min-w-[200px]">
          <Funnel size={20} className="text-fuchsia-400" />
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger className="border-none w-full bg-transparent text-white font-bold font-mono text-sm focus:ring-0 px-0 h-auto shadow-none data-[state=open]:bg-transparent">
              <SelectValue placeholder="All Providers" />
            </SelectTrigger>
            <SelectContent className="border-2 border-fuchsia-500/50 text-white font-mono rounded-none">
              <SelectItem value="all" className="focus:bg-fuchsia-500/20 focus:text-white cursor-pointer font-bold">All Providers</SelectItem>
              <SelectItem value="openai" className="focus:bg-fuchsia-500/20 focus:text-white cursor-pointer hover:bg-white/5">OpenAI</SelectItem>
              <SelectItem value="anthropic" className="focus:bg-fuchsia-500/20 focus:text-white cursor-pointer hover:bg-white/5">Anthropic</SelectItem>
              <SelectItem value="google" className="focus:bg-fuchsia-500/20 focus:text-white cursor-pointer hover:bg-white/5">Google</SelectItem>
              <SelectItem value="cohere" className="focus:bg-fuchsia-500/20 focus:text-white cursor-pointer hover:bg-white/5">Cohere</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* EVENTS TABLE CONTAINER */}
      <section className="border-2 border-fuchsia-500/50 bg-[#141418] shadow-[8px_8px_0_0_rgba(217,70,239,0.15)] relative">

        {/* TOOLBAR */}
        <div className="flex items-center justify-between p-4 border-b-2 border-fuchsia-500/50 bg-[#1a1a24]">
          <div className="font-mono text-xs text-zinc-400">
            <span className="text-fuchsia-400 font-bold">{total.toLocaleString()}</span> Events Tracked
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-400 text-xs font-mono">Page {page}</span>
            <div className="flex gap-2">
              <button
                onClick={prevPage}
                disabled={currentPage <= 1 || status === 'loading'}
                className="p-2 bg-[#0f0f12] border-2 border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 focus:outline-none transition-colors text-zinc-300"
              >
                <CaretLeft weight="bold" />
              </button>
              <button
                onClick={nextPage}
                disabled={!has_more || status === 'loading'}
                className="p-2 bg-[#0f0f12] border-2 border-zinc-600 disabled:opacity-30 disabled:cursor-not-allowed hover:border-fuchsia-400 focus:outline-none transition-colors text-zinc-300"
              >
                <CaretRight weight="bold" />
              </button>
            </div>
          </div>
        </div>

        {/* TABLE DATA */}
        {status === 'loading' && events.length === 0 ? (
          <div className="p-16 text-center text-fuchsia-400 font-mono animate-pulse">
            Querying database vectors...
          </div>
        ) : status === 'failed' ? (
          <div className="p-16 text-center text-red-500 font-mono italic">
            Anomalous reading: {error}
          </div>
        ) : events.length === 0 ? (
          <div className="p-24 flex flex-col items-center justify-center text-center">
            <p className="text-zinc-300 mb-2">No events logged yet.</p>
            <p className="text-zinc-500 text-sm max-w-sm mb-6">Install our SDK and route requests through your API keys to see telemetry data appear here in real-time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs whitespace-nowrap">
              <thead className="bg-[#141418] text-zinc-400 uppercase tracking-wider sticky top-0 border-b-2 border-fuchsia-500/20 z-10">
                <tr>
                  <th className="px-4 py-3 border-r border-white/5">Time (UTC)</th>
                  <th className="px-4 py-3 border-r border-white/5">Provider/Model</th>
                  <th className="px-4 py-3 border-r border-white/5 text-right">Tokens (P/C/T)</th>
                  <th className="px-4 py-3 border-r border-white/5 text-right">Cost (USD)</th>
                  <th className="px-4 py-3 border-r border-white/5 text-right">Latency</th>
                  <th className="px-4 py-3 border-r border-white/5">Tags / Feature</th>
                  <th className="px-4 py-3">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-white/5">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-4 py-3 border-r border-white/5 text-zinc-300">
                      {new Date(evt.occurred_at).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3 border-r border-white/5">
                      <span className="text-zinc-500 mr-2">{evt.provider}</span>
                      <span className="text-fuchsia-300 font-semibold">{evt.model}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-white/5 text-right">
                      {evt.prompt_tokens || 0} / {evt.completion_tokens || 0} / <span className="text-zinc-300">{evt.total_tokens || 0}</span>
                    </td>
                    <td className="px-4 py-3 border-r border-white/5 text-right text-emerald-400">
                      ${evt.estimated_cost_usd ? evt.estimated_cost_usd.toFixed(6) : "0.000000"}
                    </td>
                    <td className="px-4 py-3 border-r border-white/5 text-right text-amber-300">
                      {evt.latency_ms ? `${evt.latency_ms}ms` : '-'}
                    </td>
                    <td className="px-4 py-3 border-r border-white/5 max-w-[200px] truncate">
                      {evt.feature && (
                        <span className="mr-2 px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {evt.feature}
                        </span>
                      )}
                      {evt.tags && evt.tags.length > 0 && (
                        <span className="text-zinc-500">
                          [{evt.tags.join(", ")}]
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 truncate max-w-[120px]">
                      {evt.user_id || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
