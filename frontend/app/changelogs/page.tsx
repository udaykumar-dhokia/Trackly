"use client";

import Header from "@/components/custom/header";
import Footer from "@/components/custom/footer";
import { Badge } from "@/components/ui/badge";
import { Calendar, GitCommit } from "@phosphor-icons/react";

const CHANGELOG_DATA = [
  {
    version: "0.1.6",
    date: "Mar 28, 2026",
    status: "Latest",
    title: "The Anthropic Update",
    changes: [
      { text: "Native Anthropic SDK Support", desc: "Full wrapper for the official anthropic messages API with sync and async support." },
      { text: "UI Refactor & Performance", desc: "Major overhaul of the dashboard and hero sections for faster load times and smoother animations." },
      { text: "Documentation Restructure", desc: "Added dedicated Individual SDK Support sections and a standalone Changelog (you're here!)" },
    ],
  },
  {
    version: "0.1.4",
    date: "Mar 25, 2026",
    status: "Released",
    title: "Google Gemini & Analytics",
    changes: [
      { text: "Native Google Gemini Support", desc: "Direct integration with google-genai for content generation and batch jobs." },
      { text: "Budgets & Export Analytics", desc: "New tools to set cost limits and export usage data to CSV/JSON." },
      { text: "Resend Mail Integration", desc: "Transactional email support for project alerts and member invitations." },
      { text: "API Route Optimization", desc: "Reduced latency for /events ingestion endpoint." },
    ],
  },
  {
    version: "0.1.3",
    date: "Mar 24, 2026",
    status: "Released",
    title: "The Ollama Update",
    changes: [
      { text: "Native Ollama Support", desc: "First-class support for local LLMs via the official ollama Python library." },
      { text: "Rate Limiting & CORS", desc: "Enhanced protection for the ingestion API and broader cross-origin support." },
      { text: "Testimonials & Social Proof", desc: "Added interactive testimonial cards to the landing page." },
      { text: "Interactive How It Works", desc: "Animated section explaining the Trackly flow." },
    ],
  },
  {
    version: "0.1.2",
    date: "Mar 22, 2026",
    status: "Released",
    title: "Prototype & Core Infrastructure",
    changes: [
      { text: "LangChain Support", desc: "Initial library prototype with robust LangChain callback handlers." },
      { text: "Auth0 Integration", desc: "Secure authentication and state management for organizations." },
      { text: "Multi-Organisation & Projects", desc: "Support for multiple organizations and project-based resource allocation." },
      { text: "RBAC & API Keys", desc: "Role-Based Access Control and secure API key management for teams." },
      { text: "Member-wise Logs", desc: "Ability to slice API logs by individual team members." },
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white selection:bg-[#f59e0b]/30">
      <Header />

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-24">
        <div className="mb-16 text-center">
          <Badge className="bg-white/20 rounded-xl text-white border-white/10 mb-4 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white/20">
            Timeline
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tighter mb-4 uppercase">
            Changelog
          </h1>
          <p className="text-zinc-400 text-lg sm:text-xl max-w-2xl mx-auto font-medium">
            The evolution of Trackly. High-performance usage tracking for your LLM applications.
          </p>
        </div>

        <div className="relative">
          <div className="absolute left-[17px] top-4 bottom-4 w-[2px] bg-linear-to-b from-primary via-primary/50 to-transparent opacity-30" />

          <div className="space-y-16">
            {CHANGELOG_DATA.map((release, index) => (
              <div key={release.version} className="relative pl-12 group">
                <div className={`absolute left-0 top-1.5 w-9 h-9 flex items-center justify-center bg-[#09090b] z-10 rounded-xl border-2 transition-transform duration-300 group-hover:scale-110 ${release.status === "Latest" ? "border-primary" : "border-zinc-800"
                  }`}>
                  <GitCommit weight="bold" className={`w-4 h-4 rounded-xl ${release.status === "Latest" ? "text-white" : "text-zinc-500"
                    }`} />
                </div>

                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-bold tracking-tight text-white">
                      v{release.version}
                    </span>
                    <Badge className={`rounded-xl px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${release.status === "Latest"
                      ? "bg-primary text-white"
                      : "bg-zinc-800/50 text-zinc-400 border-transparent"
                      }`}>
                      {release.status}
                    </Badge>
                    <div className="flex items-center gap-2 text-zinc-500 text-sm font-medium leading-none">
                      <Calendar weight="bold" className="w-4 h-4" />
                      {release.date}
                    </div>
                  </div>

                  <div className="border-2 border-white/5 bg-white/2 p-6 sm:p-8 rounded-none shadow-[8px_8px_0_0_#000] group-hover:shadow-[12px_12px_0_0_#000] transition-all duration-300">
                    <h3 className="text-xl font-bold text-white mb-6 tracking-tight">
                      {release.title}
                    </h3>

                    <ul className="space-y-6">
                      {release.changes.map((change, i) => (
                        <li key={i} className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-primary rounded-none rotate-45" />
                            <span className="font-bold text-[.9rem] text-zinc-100 uppercase tracking-wide">
                              {change.text}
                            </span>
                          </div>
                          <p className="pl-4 text-[.85rem] text-zinc-400 leading-relaxed font-medium">
                            {change.desc}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-24 text-center">
          <p className="text-zinc-500 text-sm font-mono tracking-widest uppercase">
            End of history for now.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
