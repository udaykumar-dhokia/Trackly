"use client";
import React from "react";
import { motion, Variants } from "framer-motion";

export default function QuickStart() {
  const containerVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <section className="relative flex flex-col items-center justify-center px-6 py-12 pb-24 text-zinc-100 bg-[#09090b]">
      <style>{`
        :root {
          --bg:#09090b; --surface:#111114; --border:rgba(255,255,255,0.07);
          --border-bright:rgba(255,255,255,0.13); --text:#f4f4f5; --muted:#71717a;
        }
        .code-card {
          background:var(--surface); border:1px solid var(--border); border-radius:12px;
          overflow:hidden; text-align:left; width:100%; max-width:640px; margin:0 auto;
          box-shadow:0 32px 80px rgba(0,0,0,.5),0 0 0 1px var(--border);
          display:flex; flex-direction:column;
        }
        .code-topbar {
          display:flex; align-items:center; gap:6px; padding:12px 16px;
          border-bottom:1px solid var(--border); background:rgba(255,255,255,.02);
        }
        .wdot { width:10px; height:10px; border-radius:50%; }
        .dot-r{background:#ff5f57}.dot-y{background:#febc2e}.dot-g{background:#28c840}
        .code-filename { margin-left:8px; font-family:'DM Mono',monospace; font-size:11px; color:var(--muted); }
        .code-body {
          padding:18px 20px; font-family:'DM Mono',monospace; flex:1;
          font-size:clamp(11px,2.5vw,13px); line-height:1.75; color:#a1a1aa;
          white-space:pre; overflow-x:auto; -webkit-overflow-scrolling:touch;
        }
        .c-purple{color:#c084fc}.c-green{color:#86efac}.c-amber{color:#fde68a}
        .c-blue{color:#93c5fd}.c-muted{color:#52525b}
      `}</style>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        className="w-full flex flex-col items-center justify-center"
      >
        <motion.h2
          variants={itemVariants}
          className="text-2xl md:text-3xl font-bold mb-6 text-center tracking-tight"
        >
          Install in 2 lines of code
        </motion.h2>
        <motion.div variants={itemVariants} className="code-card">
          <div className="code-topbar">
            <span className="wdot dot-r" />
            <span className="wdot dot-y" />
            <span className="wdot dot-g" />
            <span className="code-filename">main.py</span>
          </div>
          <div className="code-body text-zinc-400">
            <span className="c-purple">from</span> trackly{" "}
            <span className="c-purple">import</span>{" "}
            <span className="c-blue">Trackly</span>
            {"\n"}
            <span className="c-purple">from</span> langchain_anthropic{" "}
            <span className="c-purple">import</span>{" "}
            <span className="c-blue">ChatAnthropic</span>
            {"\n"}
            {"\n"}
            <span className="c-muted"># 1. Init with metadata</span>
            {"\n"}
            trackly <span className="c-amber">=</span>{" "}
            <span className="c-blue">Trackly</span>({"\n"}
            {"  "}feature<span className="c-amber">=</span>
            <span className="c-green">&quot;chatbot&quot;</span>,{"\n"}
            {"  "}environment<span className="c-amber">=</span>
            <span className="c-green">&quot;prod&quot;</span>
            {"\n"}){"\n"}
            {"\n"}
            <span className="c-muted">
              # 2. Attach callback &mdash; that&apos;s it
            </span>
            {"\n"}
            llm <span className="c-amber">=</span>{" "}
            <span className="c-blue">ChatAnthropic</span>({"\n"}
            {"  "}model<span className="c-amber">=</span>
            <span className="c-green">
              &quot;claude-3-5-sonnet-latest&quot;
            </span>
            ,{"\n"}
            {"  "}callbacks<span className="c-amber">=</span>
            [trackly.callback()],{"\n"}){"\n"}
            <span className="c-muted">
              # Every Claude run is now analyzed automatically &check;
            </span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
