"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { fetchEvents } from "@/lib/store/features/eventsSlice";
import { fetchProjectMembers } from "@/lib/store/features/projectsSlice";
import {
  CaretLeft,
  CaretRight,
  WarningCircle,
  Funnel,
  ArrowClockwise,
  Users,
} from "@phosphor-icons/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function EventsPage() {
  const { user } = useUser();
  const dispatch = useAppDispatch();
  const {
    activeProjectId,
    status: projectsStatus,
    members,
  } = useAppSelector((state) => state.projects);
  const {
    data: { items: events, page, has_more, total },
    status,
    error,
    lastFetchedParams,
  } = useAppSelector((state) => state.events);

  const [currentPage, setCurrentPage] = useState(1);
  const [providerFilter, setProviderFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("");
  const [featureFilter, setFeatureFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    setCurrentPage(1);
  }, [
    providerFilter,
    memberFilter,
    modelFilter,
    featureFilter,
    startDate,
    endDate,
    activeProjectId,
  ]);

  useEffect(() => {
    if (activeProjectId && user?.sub) {
      dispatch(fetchProjectMembers({ projectId: activeProjectId, auth0Id: user.sub }));
    }
  }, [activeProjectId, dispatch, user?.sub]);

  useEffect(() => {
    if (!activeProjectId || !user?.sub) return;

    const model = modelFilter.trim() || undefined;
    const feature = featureFilter.trim() || undefined;
    const start = toStartIso(startDate);
    const end = toEndExclusiveIso(endDate);
    const needsFetch =
      !lastFetchedParams ||
      lastFetchedParams.projectId !== activeProjectId ||
      lastFetchedParams.page !== currentPage ||
      lastFetchedParams.provider !== providerFilter ||
      lastFetchedParams.userId !== memberFilter ||
      lastFetchedParams.model !== model ||
      lastFetchedParams.feature !== feature ||
      lastFetchedParams.start !== start ||
      lastFetchedParams.end !== end;

    if (needsFetch) {
      dispatch(
        fetchEvents({
          projectId: activeProjectId,
          auth0Id: user?.sub || "",
          page: currentPage,
          pageSize: 50,
          provider: providerFilter,
          userId: memberFilter,
          model,
          feature,
          start,
          end,
        }),
      );
    }
  }, [
    activeProjectId,
    currentPage,
    providerFilter,
    memberFilter,
    modelFilter,
    featureFilter,
    startDate,
    endDate,
    dispatch,
    lastFetchedParams,
    user?.sub,
  ]);

  const refreshEvents = () => {
    if (!activeProjectId || !user?.sub) return;
    dispatch(
      fetchEvents({
        projectId: activeProjectId,
        auth0Id: user?.sub || "",
        page: currentPage,
        pageSize: 50,
        provider: providerFilter,
        userId: memberFilter,
        model: modelFilter.trim() || undefined,
        feature: featureFilter.trim() || undefined,
        start: toStartIso(startDate),
        end: toEndExclusiveIso(endDate),
      }),
    );
  };

  if (
    projectsStatus === "loading" ||
    (projectsStatus === "idle" && !activeProjectId)
  ) {
    return (
      <div className="p-8 font-mono text-zinc-500 animate-pulse">
        Initializing Event Subsystem...
      </div>
    );
  }

  if (!activeProjectId) {
    return (
      <div className="mx-auto mt-12 flex max-w-4xl flex-col items-center space-y-6 border-2 border-white/10 bg-[#141418] p-12 text-center rounded-xl">
        <WarningCircle size={64} weight="duotone" className="text-white" />
        <h1 className="text-3xl font-bold text-white">No Active Project</h1>
        <p className="max-w-lg font-mono text-zinc-400">
          Please select or create a project to view underlying telemetry and API
          events.
        </p>
        <Button className="bg-white/20">
          <Link
            href="/organizations"
            className="inline-flex items-center gap-2 px-6 py-3 font-bold text-white"
          >
            Go to Organizations
            <CaretRight weight="bold" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-extrabold tracking-tight text-white">
              Events Log
            </h1>
            <p className="max-w-2xl font-mono text-sm leading-relaxed text-zinc-400">
              The raw telemetry stream for your project. Apply filters and
              inspect who generated spend.
            </p>
          </div>
          <button
            onClick={refreshEvents}
            disabled={status === "loading"}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-fuchsia-400 transition-colors cursor-pointer hover:text-fuchsia-300 disabled:opacity-50"
            title="Refresh Events"
          >
            <ArrowClockwise
              weight="bold"
              size={20}
              className={status === "loading" ? "animate-spin" : ""}
            />
          </button>
        </div>

        <div className="rounded-xl p-2 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
            <Funnel size={14} weight="bold" />
            Filters
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Select value={providerFilter} onValueChange={setProviderFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-2 border-white/10 bg-[#141418] px-3 text-xs font-mono font-bold text-white shadow-none outline-none ring-0 focus:ring-0 focus:border-white/20">
                <SelectValue placeholder="All Providers" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-white/10 bg-[#1a1a24] font-mono text-white">
                <SelectItem value="all">All Providers</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="mistral">Mistral</SelectItem>
                <SelectItem value="cohere">Cohere</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>

            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger className="h-10 w-full rounded-xl border-2 border-white/10 bg-[#141418] px-3 text-xs font-mono font-bold text-white shadow-none outline-none ring-0 focus:ring-0 focus:border-white/20">
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-2 border-white/10 bg-[#1a1a24] font-mono text-white">
                <SelectItem value="all">All Members</SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={modelFilter}
              onChange={(e) => setModelFilter(e.target.value)}
              placeholder="Model"
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-indigo-400"
            />
            <Input
              value={featureFilter}
              onChange={(e) => setFeatureFilter(e.target.value)}
              placeholder="Feature"
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-fuchsia-400"
            />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-white/30"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className=" w-full border-2 rounded-xl border-white/10 bg-[#141418] px-3 text-xs font-mono text-white outline-none transition focus:border-white/30"
            />
          </div>
        </div>
      </section>

      <section className="relative border-2 border-white/10 bg-[#141418] rounded-xl">
        <div className="flex items-center justify-between border-b-2 border-white/10 bg-[#1a1a24] rounded-t-xl p-4">
          <div className="font-mono text-xs text-zinc-400">
            <span className="font-bold text-fuchsia-400">
              {total.toLocaleString()}
            </span>{" "}
            Events Tracked
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs text-zinc-400">Page {page}</span>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  currentPage > 1 && setCurrentPage((value) => value - 1)
                }
                disabled={currentPage <= 1 || status === "loading"}
                className="border-2 border-zinc-600 bg-[#0f0f12] p-2 text-zinc-300 transition-colors hover:border-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <CaretLeft weight="bold" />
              </button>
              <button
                onClick={() => has_more && setCurrentPage((value) => value + 1)}
                disabled={!has_more || status === "loading"}
                className="border-2 border-zinc-600 bg-[#0f0f12] p-2 text-zinc-300 transition-colors hover:border-fuchsia-400 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <CaretRight weight="bold" />
              </button>
            </div>
          </div>
        </div>

        {status === "loading" && events.length === 0 ? (
          <div className="p-16 text-center font-mono text-fuchsia-400 animate-pulse">
            Querying database vectors...
          </div>
        ) : status === "failed" ? (
          <div className="p-16 text-center font-mono italic text-red-500">
            Anomalous reading: {error}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-24 text-center">
            <p className="mb-2 text-zinc-300">
              No events matched the current filters.
            </p>
            <p className="mb-6 max-w-sm text-sm text-zinc-500">
              Adjust the filters or send more telemetry through your Trackly
              keys to populate this view.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-left font-mono text-xs">
              <thead className="sticky top-0 z-10 border-b-2 border-fuchsia-500/20 bg-[#141418] uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="border-r border-white/5 px-4 py-3">
                    Time (UTC)
                  </th>
                  <th className="border-r border-white/5 px-4 py-3">
                    Provider/Model
                  </th>
                  <th className="border-r border-white/5 px-4 py-3 text-right">
                    Tokens (P/C/T)
                  </th>
                  <th className="border-r border-white/5 px-4 py-3 text-right">
                    Cost (USD)
                  </th>
                  <th className="border-r border-white/5 px-4 py-3 text-right">
                    Latency
                  </th>
                  <th className="border-r border-white/5 px-4 py-3">
                    Tags / Feature
                  </th>
                  <th className="px-4 py-3">User ID</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-white/5">
                {events.map((evt) => (
                  <tr
                    key={evt.id}
                    className="group transition-colors hover:bg-white/5"
                  >
                    <td className="border-r border-white/5 px-4 py-3 text-zinc-300">
                      {new Date(evt.occurred_at)
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                    </td>
                    <td className="border-r border-white/5 px-4 py-3">
                      <span className="mr-2 text-zinc-500">{evt.provider}</span>
                      <span className="font-semibold text-fuchsia-300">
                        {evt.model}
                      </span>
                    </td>
                    <td className="border-r border-white/5 px-4 py-3 text-right">
                      {evt.prompt_tokens || 0} / {evt.completion_tokens || 0} /{" "}
                      <span className="text-zinc-300">
                        {evt.total_tokens || 0}
                      </span>
                    </td>
                    <td className="border-r border-white/5 px-4 py-3 text-right text-emerald-400">
                      ${(evt.estimated_cost_usd || 0).toFixed(6)}
                    </td>
                    <td className="border-r border-white/5 px-4 py-3 text-right text-amber-300">
                      {evt.latency_ms ? `${evt.latency_ms}ms` : "-"}
                    </td>
                    <td className="max-w-[220px] truncate border-r border-white/5 px-4 py-3">
                      {evt.feature && (
                        <span className="mr-2 border border-indigo-500/30 bg-indigo-500/20 px-1.5 py-0.5 text-indigo-300">
                          {evt.feature}
                        </span>
                      )}
                      {evt.tags && evt.tags.length > 0 && (
                        <span className="text-zinc-500">
                          [{evt.tags.join(", ")}]
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {evt.user_id ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="group/user flex cursor-help items-center gap-2">
                                <Avatar
                                  size="sm"
                                  className="size-6 shrink-0 border border-white/10"
                                >
                                  {evt.user_photo && (
                                    <AvatarImage
                                      src={evt.user_photo}
                                      alt={evt.user_name || evt.user_id}
                                    />
                                  )}
                                  <AvatarFallback className="bg-fuchsia-500/10 text-[10px] font-bold text-fuchsia-400">
                                    {(evt.user_name || evt.user_id)
                                      .substring(0, 2)
                                      .toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="max-w-[110px] truncate text-zinc-500 transition-colors group-hover/user:text-zinc-300">
                                  {evt.user_name || evt.user_id}
                                </span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="rounded-none border-2 border-fuchsia-500/50 bg-[#1a1a24] font-mono text-white shadow-[4px_4px_0_0_rgba(217,70,239,0.2)]"
                            >
                              <div className="flex flex-col gap-0.5">
                                <span className="font-bold text-fuchsia-400">
                                  {evt.user_name || "Unknown User"}
                                </span>
                                <span className="text-[10px] text-zinc-400">
                                  {evt.user_id}
                                </span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-zinc-700">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function toStartIso(value: string) {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

function toEndExclusiveIso(value: string) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}
