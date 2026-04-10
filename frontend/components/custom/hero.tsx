"use client";
import React, { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ArrowUpRightIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";

function useCountUp(target: number, duration = 2400, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return value;
}

const PROVIDERS = [
  "OpenAI",
  "Anthropic",
  "Groq",
  "Gemini",
  "Mistral",
  "Ollama",
];

const PROVIDER_LOGOS = [
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRQVRSNCZKUcvSYkmDLtSNNaRwRDh8rz5HxHA&s",
  "https://www.digitalmarketingcommunity.com/wp-content/uploads/2025/06/Claude-logo.jpeg",
  "https://static.vecteezy.com/system/resources/previews/055/687/055/non_2x/rectangle-gemini-google-icon-symbol-logo-free-png.png",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdtQY9Ofk71m8DVL5yV3d_sDPuqzCexABNLA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS_DaHGtoqrk8iozc9mWeQ8_1RXcxTlRI_dWA&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRFVZ9JJ3PrF8m-lYW-rPzJpZJVMzq3CwpdsQ&s",
  "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSqdPRKA0_sLVNpiF5--45w5ql-IgJzqNUtgw&s",
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.1,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1], // Custom easeOutExpo
    },
  },
};

export default function Hero() {
  const [mounted, setMounted] = useState(false);
  const [providerIdx, setProviderIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [totalEvents, setTotalEvents] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);
  const [totalUsers, setTotalUsers] = useState(1200);
  const [featuredUsers, setFeaturedUsers] = useState<
    { name: string | null; email: string; profile_photo: string | null }[]
  >([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/stats/global`,
        );
        const data = await res.json();
        setTotalEvents(data.total_events);
        setTotalTokens(data.total_tokens);
        setTotalUsers(data.total_users || 1200);
        setFeaturedUsers(data.featured_users || []);
      } catch {
        setTotalEvents(4_812_903);
        setTotalTokens(183_450_281);
        setTotalUsers(1200);
      }
    };
    fetchStats();
  }, []);

  const statsRef = useRef(null);
  const events = useCountUp(totalEvents || 4_812_903, 2400, mounted);
  const tokens = useCountUp(totalTokens || 183_450_281, 2400, mounted);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    const id = setInterval(
      () => setProviderIdx((i) => (i + 1) % PROVIDERS.length),
      1800,
    );
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <style>{`
        :root {
          --bg:#09090b; --surface:#111114; --border:rgba(255,255,255,0.07);
          --border-bright:rgba(255,255,255,0.13); --text:#f4f4f5; --muted:#71717a;
          --accent:#a78bfa; --green:#34d399;
        }
        .hero-root {
          background:var(--bg); min-height:100vh;
          color:var(--text); position:relative; overflow:hidden;
        }
        .hero-root::before {
          content:''; position:absolute; inset:0;
          background-image:linear-gradient(rgba(167,139,250,0.03) 1px,transparent 1px),
            linear-gradient(90deg,rgba(167,139,250,0.03) 1px,transparent 1px);
          background-size:48px 48px;
          mask-image:radial-gradient(ellipse 80% 60% at 50% 0%,black 30%,transparent 100%);
          pointer-events:none;
        }
        .orb { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; }
        .orb-1 { width:600px;height:600px;background:var(--color-primary);top:-200px;left:-150px;opacity:.18; }
        .orb-2 { width:400px;height:400px;background:var(--color-secondary);top:100px;right:-100px;opacity:.1; }

        .hero-h1 {
          font-size:clamp(1.9rem,3.5vw,2.8rem); font-weight:800;
          line-height:1.08; letter-spacing:-.03em; margin-bottom:20px;
        }

        .pip-pill {
          display:flex; align-items:center; overflow:hidden;
          border:2px solid rgba(255,255,255,0.12); border-radius:10px;
          background:#141418; font-family:'DM Mono',monospace;
          height:40px; width:100%; max-width:300px;
        }
        .pip-pill-text {
          display:flex; align-items:center; gap:8px;
          flex:1; padding:0 14px; overflow:hidden; min-width:0;
        }
        .pip-pill-copy {
          height:100%; padding:0 16px; background:#fff; color:#000;
          font-weight:700; border-left:2px solid rgba(255,255,255,0.12);
          font-size:12px; cursor:pointer; white-space:nowrap; transition:background .15s;
        }
        .pip-pill-copy:hover { background:#c7d2fe; }

        .stats-row {
          display:grid; grid-template-columns:repeat(4,1fr);
          border:1px solid var(--border); border-radius:12px;
          overflow:hidden; background:var(--surface);
          width:100%; max-width:560px; margin:0 auto;
        }
        .stat-cell { padding:14px 12px; text-align:center; border-right:1px solid var(--border); }
        .stat-cell:last-child { border-right:none; }
        .stat-num {
          font-size:clamp(.95rem,3vw,1.35rem); font-weight:700; color:var(--text);
          letter-spacing:-.02em; font-variant-numeric:tabular-nums;
        }
        .stat-label {
          font-family:'DM Mono',monospace; font-size:10px; color:var(--muted);
          letter-spacing:.05em; text-transform:uppercase; margin-top:3px;
        }

        .provider-logos-wrap { width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
        .provider-logos-wrap::-webkit-scrollbar { display:none; }
        .provider-logos-inner {
          display:flex; align-items:center; justify-content:center;
          gap:6px; padding:0 4px; min-width:max-content; margin:0 auto;
        }
        .provider-logo {
          width:32px; height:32px; border-radius:50%; object-fit:cover;
          border:2px solid rgba(255,255,255,0.08); flex-shrink:0; transition:transform .2s;
        }
        .provider-logo:hover { transform:scale(1.12); }

        @media (max-width:480px) {
          .stats-row { grid-template-columns:repeat(2,1fr); }
          .stat-cell { border-bottom:1px solid var(--border); }
          .stat-cell:nth-child(2n) { border-right:none; }
          .stat-cell:nth-last-child(-n+2) { border-bottom:none; }
          .hero-cta-row { flex-direction:column !important; align-items:stretch !important; }
          .hero-cta-row > * { width:100%; }
          .pip-pill { max-width:100%; }
        }

        .demo-video-container {
          background:var(--surface); border:1px solid var(--border); border-radius:12px;
          overflow:hidden; width:100%; max-width:900px; margin:0 auto;
          box-shadow:0 32px 80px rgba(0,0,0,.5),0 0 0 1px var(--border);
        }
        .demo-video {
          width:100%; height:auto; display:block;
        }
      `}</style>

      <div className="hero-root relative">
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        <section className="relative flex min-h-screen flex-col items-center justify-center px-6 py-24 text-zinc-100">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="mx-auto w-full max-w-[1080px] flex flex-col items-center text-center"
          >
            <motion.div variants={itemVariants} className="mb-8 w-full">
              <div className="provider-logos-wrap">
                <div className="provider-logos-inner">
                  {PROVIDER_LOGOS.map((logo, i) => (
                    <motion.img
                      key={i}
                      src={logo}
                      alt="Provider"
                      className="provider-logo"
                      whileHover={{ scale: 1.15, rotate: 5 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 17,
                      }}
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="hero-h1 w-full max-w-[720px]"
            >
              Find what's wrong with your AI — <span className="text-primary italic">and fix it.</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mb-9 max-w-2xl text-[.95rem] leading-[1.7] text-zinc-400"
            >
              The AI Decision Engine for improving production systems. Automatically
              surface plain-English insights, detect critical paths, and optimize costs
              for your AI agents and chains.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="hero-cta-row mb-6 flex items-center justify-center gap-3"
            >
              <Link href="/docs">
                <Button className="h-10 cursor-pointer border-black bg-white/20 px-5 font-semibold text-white hover:bg-indigo-300 hover:text-black focus:outline-0 focus:ring-2 focus:ring-indigo-300">
                  Read Docs <ArrowUpRightIcon />
                </Button>
              </Link>
              <div className="pip-pill">
                <div className="pip-pill-text">
                  <span style={{ color: "#52525b", flexShrink: 0 }}>$</span>
                  <span
                    style={{
                      color: "#f4f4f5",
                      fontWeight: 700,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 13,
                    }}
                  >
                    pip install trackly
                  </span>
                </div>
                <button
                  className="pip-pill-copy"
                  onClick={() => {
                    navigator.clipboard.writeText("pip install trackly");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="mb-8 flex flex-col items-center gap-4"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="flex">
                  {featuredUsers.length > 0
                    ? featuredUsers.slice(0, 5).map((u, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            border: "2px solid #09090b",
                            background: "#18181b",
                            overflow: "hidden",
                            marginLeft: i === 0 ? 0 : -10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#71717a",
                            zIndex: 5 - i,
                          }}
                        >
                          {u.profile_photo ? (
                            <img
                              src={u.profile_photo}
                              alt="Dev"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                              }}
                            />
                          ) : (
                            (u.name || "U").toUpperCase()
                          )}
                        </motion.div>
                      ))
                    : [
                        "photo-1535713875002-d1d0cf377fde",
                        "photo-1494790108377-be9c29b29330",
                        "photo-1599566150163-29194dcaad36",
                        "photo-1527980965255-d3b416303d12",
                        "photo-1438761681033-6461ffad8d80",
                      ].map((id, i) => (
                        <motion.img
                          key={i}
                          src={`https://images.unsplash.com/${id}?auto=format&fit=crop&w=64&h=64&q=80`}
                          alt="Dev"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            border: "2px solid #09090b",
                            objectFit: "cover",
                            marginLeft: i === 0 ? 0 : -10,
                            zIndex: 5 - i,
                          }}
                        />
                      ))}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1 }}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      border: "2px solid #09090b",
                      background: "#18181b",
                      marginLeft: -10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#71717a",
                    }}
                  >
                    +
                    {totalUsers > 1000
                      ? (totalUsers / 1000).toFixed(1) + "k"
                      : totalUsers}
                  </motion.div>
                </div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "#71717a" }}>
                  Join{" "}
                  {totalUsers > 1000 ? (
                    <span style={{ color: "#f4f4f5" }}>
                      {totalUsers.toLocaleString()}+
                    </span>
                  ) : (
                    ""
                  )}{" "}
                  developers building the future of AI
                </p>
                <p
                  style={{
                    fontSize: 11,
                    color: "#71717a",
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  Questions?{" "}
                  <a
                    href="mailto:support@tracklyai.in"
                    style={{
                      color: "#818cf8",
                      textDecoration: "underline",
                      textUnderlineOffset: 4,
                    }}
                  >
                    support@tracklyai.in
                  </a>
                </p>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              className="w-full flex justify-center mt-4"
            >
              <motion.div
                className="demo-video-container"
                whileInView={{ y: [20, 0], opacity: [0, 1] }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
              >
                <video
                  src="/demo.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="demo-video"
                />
              </motion.div>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-4 w-full">
              <div className="stats-row" ref={statsRef}>
                <div className="stat-cell">
                  <div className="stat-num">{events.toLocaleString()}</div>
                  <div className="stat-label">Events</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num">{tokens.toLocaleString()}</div>
                  <div className="stat-label">Tokens</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num">6</div>
                  <div className="stat-label">Providers</div>
                </div>
                <div className="stat-cell">
                  <div className="stat-num" style={{ color: "var(--accent)" }}>
                    2
                  </div>
                  <div className="stat-label">Lines of code</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </section>
      </div>
    </>
  );
}
