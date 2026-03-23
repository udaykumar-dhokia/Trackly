"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import Header from "@/components/custom/header";
import Footer from "@/components/custom/footer";

const NAV = [
  {
    group: "Getting started",
    items: ["Introduction", "Installation", "Quickstart"],
  },
  {
    group: "SDK",
    items: ["Trackly client", "Callbacks", "Debug mode"],
  },
  {
    group: "Providers",
    items: ["OpenAI", "Anthropic", "Google Gemini", "Groq", "Ollama"],
  },
  {
    group: "Backend API",
    items: [
      "Authentication",
      "Ingest events",
      "Stats & analytics",
      "API reference",
    ],
  },
  {
    group: "Deployment",
    items: ["Self-hosting"],
  },
];

const PROVIDERS_CODE: Record<string, string> = {
  OpenAI: `from langchain_openai import ChatOpenAI
from trackly import Trackly

t = Trackly(api_key="tk_live_...")

llm = ChatOpenAI(
    model="gpt-4o",
    callbacks=[t.callback(feature="chatbot", environment="prod")],
)

llm.invoke("Hello, world!")`,
  Anthropic: `from langchain_anthropic import ChatAnthropic
from trackly import Trackly

t = Trackly(api_key="tk_live_...")

llm = ChatAnthropic(
    model="claude-3-5-sonnet-latest",
    callbacks=[t.callback(feature="chat")],
)

llm.invoke("What is cost tracking?")`,
  "Google Gemini": `from langchain_google_genai import ChatGoogleGenerativeAI
from trackly import Trackly

t = Trackly(api_key="tk_live_...")

llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-pro",
    callbacks=[t.callback(feature="summarizer")],
)

llm.invoke("Explain cost tracking.")`,
  Groq: `from langchain_groq import ChatGroq
from trackly import Trackly

t = Trackly(api_key="tk_live_...")

llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    callbacks=[t.callback(feature="rag-pipeline")],
)

llm.invoke("Hello from Groq!")`,
  Ollama: `from langchain_ollama import ChatOllama
from trackly import Trackly

t = Trackly(api_key="tk_live_...")

llm = ChatOllama(
    model="llama3.2",
    callbacks=[t.callback(feature="local-dev")],
)

llm.invoke("Local tracking with Ollama!")`,
};

function Ic({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[.78rem] bg-[#141418] border border-white/8 text-zinc-200 px-1.5 py-0.5 rounded-none">
      {children}
    </code>
  );
}

function CodeBlock({ lang, children }: { lang: string; children: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="bg-[#060608] border border-white/6 rounded-none overflow-hidden my-4 shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5 bg-white/1.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-[9px] h-[9px] rounded-full bg-[#ff5f57]" />
            <span className="w-[9px] h-[9px] rounded-full bg-[#febc2e]" />
            <span className="w-[9px] h-[9px] rounded-full bg-[#28c840]" />
          </div>
          <span className="font-mono text-[10px] text-zinc-600 ml-1">
            {lang}
          </span>
        </div>
        <button
          onClick={copy}
          className={`font-mono text-[10px] px-2 py-0.5 rounded-none border-2 transition-all ${
            copied
              ? "text-[#34d399] border-[#34d399] bg-[#34d399]/5"
              : "text-zinc-400 border-zinc-700 bg-[#141418] hover:text-white hover:border-white"
          }`}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <SyntaxHighlighter
        language={
          lang.toLowerCase().includes("python")
            ? "python"
            : lang.toLowerCase().includes("bash")
              ? "bash"
              : lang.toLowerCase().includes("json")
                ? "json"
                : lang.toLowerCase().includes(".env")
                  ? "bash"
                  : "python"
        }
        style={vscDarkPlus}
        customStyle={{
          background: "transparent",
          padding: "1rem",
          margin: 0,
          fontSize: "12px",
          lineHeight: "1.5",
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

function Callout({
  type,
  children,
}: {
  type: "info" | "warn" | "success";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-500/[0.06]  border-blue-500/20   text-blue-300",
    warn: "bg-amber-500/[0.06] border-amber-500/20  text-amber-300",
    success: "bg-green-500/[0.06] border-green-500/10  text-[#34d399]",
  };
  const icons = {
    info: "ℹ",
    warn: "⚠",
    success: "✓",
  };
  return (
    <div
      className={`flex gap-2.5 px-3.5 py-3 rounded-none border-2 text-[.8rem] leading-relaxed my-4 ${styles[type]}`}
    >
      <span className="shrink-0 mt-px font-mono font-bold">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

function SectionTitle({
  accentColor = "#a78bfa",
  children,
}: {
  accentColor?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className="text-[1.2rem] font-bold tracking-tight text-white mb-4 mt-8 flex items-center gap-2">
      <span
        className="w-1.5 h-6 rounded-none bg-primary"
        style={{ backgroundColor: accentColor }}
      />
      {children}
    </h2>
  );
}

function Step({
  n,
  label,
  children,
}: {
  n: number;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="w-6 h-6 rounded-none bg-white text-black font-bold text-[11px] flex items-center justify-center shrink-0">
          {n}
        </span>
        <h3 className="text-[.9rem] font-bold text-zinc-100 uppercase tracking-wide">
          {label}
        </h3>
      </div>
      <div className="pl-9">{children}</div>
    </div>
  );
}

export default function DocsPage() {
  const [activeNav, setActiveNav] = useState("Introduction");

  const renderContent = () => {
    switch (activeNav) {
      case "Introduction":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Introduction
            </h1>
            <p className="text-[.95rem] text-zinc-400 leading-relaxed mb-8">
              Trackly is a performance-first LLM observability layer. It
              provides a simple callback interface for Python developers to
              track token usage, costs, and latency across 10+ providers with{" "}
              <span className="text-white font-bold underline decoration-primary underline-offset-4">
                zero added latency
              </span>
              .
            </p>
            <SectionTitle>Core Features</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  title: "Universal",
                  desc: "Support for OpenAI, Anthropic, Gemini, Groq, Ollama and more.",
                },
                {
                  title: "Safe",
                  desc: "Batched background flushing ensures your app never slows down.",
                },
                {
                  title: "Transparent",
                  desc: "Open API schema. Self-host our backend or use our cloud.",
                },
                {
                  title: "Affordable",
                  desc: "Precise token tracking using provider-specific logic.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-4 border-2 border-white/5 bg-white/5"
                >
                  <h4 className="font-bold text-primary text-[.85rem] mb-1 uppercase tracking-widest">
                    {f.title}
                  </h4>
                  <p className="text-[.8rem] text-zinc-500 ">{f.desc}</p>
                </div>
              ))}
            </div>
          </>
        );
      case "Installation":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Installation
            </h1>
            <p className="text-zinc-400 mb-6 ">
              Get up and running in seconds.
            </p>
            <Step n={1} label="Install via PIP">
              <CodeBlock lang="bash">{`pip install trackly`}</CodeBlock>
            </Step>
            <Step n={2} label="Install Extras (Recommended)">
              <p className="text-[.8rem] text-zinc-500 mb-2">
                Install specific provider dependencies to avoid bloat.
              </p>
              <CodeBlock lang="bash">{`# For OpenAI support\npip install "trackly[openai]"\n\n# For Anthropic support\npip install "trackly[anthropic]"\n\n# Install everything\npip install "trackly[all]"`}</CodeBlock>
            </Step>
          </>
        );
      case "Quickstart":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Quickstart
            </h1>
            <Step n={1} label="Grab an API Key">
              <p className="text-zinc-400 text-[.85rem]">
                Sign in to the dashboard and head to <Ic>API Keys</Ic> to create
                your first key.
              </p>
            </Step>
            <Step n={2} label="Configure Environment">
              <CodeBlock lang=".env">{`TRACKLY_API_KEY=tk_live_your_key_here`}</CodeBlock>
            </Step>
            <Step n={3} label="Start Tracking">
              <CodeBlock lang="python">{`from trackly import Trackly\nfrom langchain_openai import ChatOpenAI\n\n# Initialize\nt = Trackly()\n\n# Create callbacks for a specific feature/env\ncb = t.callback(feature="summarizer", environment="prod")\n\n# Pass to LangChain\nllm = ChatOpenAI(callbacks=[cb])\nllm.invoke("You are now being tracked.")`}</CodeBlock>
            </Step>
          </>
        );
      case "Trackly client":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Trackly Client
            </h1>
            <p className="text-zinc-400 mb-6">
              The <Ic>Trackly</Ic> class is the entry point for all
              interactions.
            </p>
            <CodeBlock lang="python">{`from trackly import Trackly\n\nt = Trackly(\n    api_key="...",    # Defaults to os.getenv("TRACKLY_API_KEY")\n    base_url="...",   # Defaults to api.trackly.ai\n    debug=False       # Enable for verbose logs\n)`}</CodeBlock>
            <Callout type="info">
              If no API key is provided during initialization, the client will
              look for the `TRACKLY_API_KEY` environment variable.
            </Callout>
          </>
        );
      case "Callbacks":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Callbacks
            </h1>
            <p className="text-zinc-400 mb-6">
              Callbacks allow you to attach rich metadata to your LLM
              observability data.
            </p>
            <CodeBlock lang="python">{`# Generate a callback with metadata\ncb = t.callback(\n    feature="retrieval",      # Feature name (e.g. chat, rag, summary)\n    environment="production", # Env (e.g. dev, staging, prod)\n    user_id="user_123",       # Attribute cost to a web user\n    session_id="sess_abc"     # Group calls by conversation\n)`}</CodeBlock>
            <SectionTitle>Fields</SectionTitle>
            <ul className="space-y-4 text-[.85rem] text-zinc-400">
              <li>
                <Ic>feature</Ic>: A string identifying the application feature.
              </li>
              <li>
                <Ic>environment</Ic>: Typically `prod`, `dev`, or `staging`.
              </li>
              <li>
                <Ic>user_id</Ic>: String ID of your end user.
              </li>
              <li>
                <Ic>session_id</Ic>: String ID for the session or conversation.
              </li>
            </ul>
          </>
        );
      case "Debug mode":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Debug Mode
            </h1>
            <p className="text-zinc-400 mb-6">
              Toggle verbose logging to troubleshoot event ingestion issues.
            </p>
            <CodeBlock lang="python">{`t = Trackly(debug=True)\n\n# Or set environment variable\n# TRACKLY_DEBUG=1`}</CodeBlock>
            <Callout type="warn">
              Do not enable debug mode in high-traffic production environments
              as it may generate significant log volume.
            </Callout>
          </>
        );
      case "Authentication":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Authentication
            </h1>
            <p className="text-zinc-400 mb-4">
              The Backend API uses Bearer authentication via API Keys.
            </p>
            <CodeBlock lang="bash">{`curl -H "Authorization: Bearer tk_live_..." \\\n     https://api.trackly.ai/v1/health`}</CodeBlock>
            <p className="text-zinc-500 text-[.8rem]  mt-2">
              API Keys are generated per project and provide access to both
              ingestion and stats endpoints for that project.
            </p>
          </>
        );
      case "Ingest events":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Ingest Events
            </h1>
            <p className="text-zinc-400 mb-4 font-mono text-sm underline group-hover:text-primary transition-colors">
              POST /v1/events/ingest
            </p>
            <p className="text-[.85rem] text-zinc-500 mb-4 ">
              Accepts a batch of LLM events. The SDK handles this automatically,
              but you can trigger it manually for custom logging.
            </p>
            <CodeBlock lang="json">{`[\n  {\n    "model": "gpt-4o",\n    "provider": "openai",\n    "prompt_tokens": 150,\n    "completion_tokens": 200,\n    "latency_ms": 1200,\n    "feature": "chatbot"\n  }\n]`}</CodeBlock>
          </>
        );
      case "Stats & analytics":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Stats & Analytics
            </h1>
            <p className="text-zinc-400 mb-4">
              Query your data programmatically to build custom cost-dashboards.
            </p>
            <Step n={1} label="Daily Stats">
              <Ic>GET /v1/stats/daily?project_id=...</Ic>
            </Step>
            <Step n={2} label="Model Usage">
              <Ic>GET /v1/stats/models?project_id=...</Ic>
            </Step>
          </>
        );
      case "API reference":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              API Reference
            </h1>
            <p className="text-zinc-400 mb-6 ">
              Full technical specification for direct integrations.
            </p>
            <div className="space-y-8">
              <div>
                <h3 className="text-white font-bold mb-2 uppercase text-sm border-b border-white/10 pb-1">
                  Ingestion
                </h3>
                <ul className="space-y-2 text-[.85rem] text-zinc-500">
                  <li>
                    <Ic>POST /v1/events/ingest</Ic> - Bulk upload of LLM events.
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-white font-bold mb-2 uppercase text-sm border-b border-white/10 pb-1">
                  Analytics
                </h3>
                <ul className="space-y-2 text-[.85rem] text-zinc-500">
                  <li>
                    <Ic>GET /v1/stats/daily</Ic> - Daily cost & token usage.
                  </li>
                  <li>
                    <Ic>GET /v1/stats/models</Ic> - Usage breakdown by model.
                  </li>
                  <li>
                    <Ic>GET /v1/stats/providers</Ic> - Usage breakdown by
                    provider.
                  </li>
                </ul>
              </div>
            </div>
            <Callout type="info">
              For the full Swagger/OpenAPI spec, visit your hosted backend at{" "}
              <Ic>/docs</Ic> or <Ic>/redoc</Ic>.
            </Callout>
          </>
        );
      case "Self-hosting":
        return (
          <>
            <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
              Self-Hosting
            </h1>
            <p className="text-zinc-400 mb-6 ">
              Run Trackly on your own infrastructure.
            </p>
            <Step n={1} label="Requirements">
              <ul className="list-disc list-inside text-zinc-500 text-[.85rem] space-y-1">
                <li>Docker & Docker Compose</li>
                <li>PostgreSQL 15+</li>
                <li>Redis (Optional, for caching)</li>
              </ul>
            </Step>
            <Step n={2} label="Deploy with Docker">
              <CodeBlock lang="bash">{`docker run -d \\\n  -p 8000:8000 \\\n  -e DATABASE_URL=postgresql://... \\\n  udaykumarnd/trackly-backend:latest`}</CodeBlock>
            </Step>
          </>
        );
      default:
        if (PROVIDERS_CODE[activeNav]) {
          return (
            <>
              <h1 className="text-[2.5rem] font-extrabold tracking-tighter leading-none mb-6  uppercase">
                {activeNav}
              </h1>
              <p className="text-zinc-400 mb-6 ">
                Tracking {activeNav} usage seamlessly.
              </p>
              <CodeBlock lang="python">{PROVIDERS_CODE[activeNav]}</CodeBlock>
              <Callout type="success">
                Ensure you have the required provider package installed via{" "}
                <Ic>
                  pip install "trackly[{activeNav.toLowerCase().split(" ")[0]}]"
                </Ic>
                .
              </Callout>
            </>
          );
        }
        return <p>Section coming soon...</p>;
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0c] selection:bg-primary/30 scroll-smooth relative overflow-hidden docs-root">
      <style>{`
        .docs-root::before {
          content:''; position:absolute; inset:0;
          background-image:linear-gradient(rgba(167,139,250,0.03) 1px,transparent 1px),
            linear-gradient(90deg,rgba(167,139,250,0.03) 1px,transparent 1px);
          background-size:48px 48px;
          mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,black 30%,transparent 100%);
          pointer-events:none; z-index:0;
        }
        .orb { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; z-index:0; }
        .orb-1 { width:600px;height:600px;background:#a78bfa;top:-200px;left:-150px;opacity:0.12; }
        .orb-2 { width:400px;height:400px;background:#f472b6;top:100px;right:-100px;opacity:0.06; }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <Header />

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-24 pb-12 gap-12 relative z-10">
        <aside className="w-64 hidden md:block shrink-0 sticky top-24 h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar pr-4 border-r border-white/5">
          {NAV.map((group) => (
            <div key={group.group} className="mb-8 last:mb-0">
              <h4 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-200 mb-4 px-2">
                {group.group}
              </h4>
              <nav className="flex flex-col gap-1.5">
                {group.items.map((item) => {
                  const isActive = activeNav === item;
                  return (
                    <button
                      key={item}
                      onClick={() => {
                        setActiveNav(item);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className={`
                        text-left px-4 py-2.5 text-[0.85rem] transition-all duration-200 group relative cursor-pointer
                        ${
                          isActive
                            ? "border-2 border-black bg-white font-bold text-black shadow-primary shadow-[4px_4px_0_0] z-10"
                            : "text-zinc-400 hover:text-zinc-200 hover:translate-x-1"
                        }
                      `}
                    >
                      {item}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </aside>

        <main className="flex-1 min-w-0 max-w-3xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {renderContent()}
        </main>
      </div>

      <Footer />
    </div>
  );
}
