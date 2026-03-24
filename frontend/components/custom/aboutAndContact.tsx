"use client";
import React, { useState } from "react";
import { Button } from "../ui/button";
import { ArrowUpRightIcon } from "@phosphor-icons/react";

const SOCIALS = [
  {
    href: "https://github.com/udaykumar-dhokia",
    label: "GitHub",
    handle: "udaykumar-dhokia",
    iconBg: "bg-white/5 border-white/[0.08]",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-zinc-100"
      >
        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
      </svg>
    ),
  },
  {
    href: "https://linkedin.com/in/udthedeveloper",
    label: "LinkedIn",
    handle: "udthedeveloper",
    iconBg: "bg-blue-500/10 border-blue-500/20",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#60a5fa">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  {
    href: "https://twitter.com/udaykumardhokia",
    label: "X / Twitter",
    handle: "@udaykumardhokia",
    iconBg: "bg-white/5 border-white/[0.08]",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#f4f4f5">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
];

const TAGS = [
  { label: "Agentic AI", hi: true },
  { label: "LangChain", hi: true },
  { label: "Full Stack", hi: true },
  { label: "RAG", hi: false },
  { label: "Vector Search", hi: false },
  { label: "FastAPI", hi: false },
  { label: "Flutter", hi: false },
  { label: "PostgreSQL", hi: false },
];

export default function AboutContact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);

    const mailtoString = `mailto:udaykumar.dhokia@gmail.com?subject=${encodeURIComponent(
      formData.subject
    )}&body=${encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    )}`;

    window.location.href = mailtoString;

    setTimeout(() => {
      setSending(false);
      setSubmitted(true);
    }, 1200);
  }

  return (
    <>
      <style>{`
        .ac-section { position: relative; overflow: hidden; }
        .ac-section::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(167,139,250,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167,139,250,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 60% at 20% 50%, black 20%, transparent 80%);
        }
        .about-glow::after {
          content: ''; position: absolute; top: -80px; right: -80px;
          width: 240px; height: 240px; border-radius: 50%;
          background: rgba(167,139,250,0.07); filter: blur(60px); pointer-events: none;
        }
        .contact-glow::after {
          content: ''; position: absolute; bottom: -80px; left: -60px;
          width: 200px; height: 200px; border-radius: 50%;
          background: rgba(52,211,153,0.06); filter: blur(60px); pointer-events: none;
        }
        .social-link { transition: border-color 0.15s, background 0.15s, color 0.15s; }
        .social-link:hover { background: rgba(255,255,255,0.02) !important; }
        .form-input:focus {
          border-color: rgba(167,139,250,0.5) !important;
          box-shadow: 0 0 0 3px rgba(167,139,250,0.08);
          outline: none;
        }
        .pulse-dot { animation: pulse-dot 2s ease-in-out infinite; }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      <section className="ac-section bg-[#09090b] border-t border-white/6 px-6 py-24 text-zinc-100">
        <div className="mx-auto max-w-[1080px] grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <div className="about-glow relative bg-[#0f0f12] border border-white/6 rounded-none p-9 h-full overflow-hidden">
            <div className="flex items-center gap-2 mb-5">
              <span className="block w-[18px] h-px bg-primary/60" />
              <span className="text-[11px] tracking-widest uppercase text-primary">
                About
              </span>
            </div>

            <div className="flex items-center gap-3.5 mb-6">
              <div
                className="w-13 h-13 rounded-none bg-[#141418] border border-white/10 flex items-center justify-content-center shrink-0 overflow-hidden"
                style={{ width: 52, height: 52 }}
              >
                <img
                  src="https://avatars.githubusercontent.com/udaykumar-dhokia"
                  alt="Udaykumar Dhokia"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.style.display = "none";
                    t.parentElement!.innerHTML =
                      '<span style="font-size:18px;font-weight:700;color:#a78bfa;width:100%;height:100%;display:flex;align-items:center;justify-content:center">UD</span>';
                  }}
                />
              </div>
              <div>
                <p className="text-[1.05rem] font-bold tracking-[-0.02em] text-zinc-100">
                  Udaykumar Dhokia
                </p>
                <p className="text-[.8rem] text-zinc-500 mt-0.5">
                  Builder of Trackly · Software Developer
                </p>
              </div>
            </div>

            <p className="text-[.88rem] text-zinc-400 leading-[1.75] mb-6">
              <strong className="text-zinc-200 font-semibold">
                Trackly was built out of a real frustration.
              </strong>{" "}
              While working on agentic AI projects, I had no simple way to know
              how much each feature was costing me — especially when using{" "}
              <strong className="text-zinc-200 font-semibold">Groq</strong> or{" "}
              <strong className="text-zinc-200 font-semibold">Ollama</strong>{" "}
              where model names give no hint about the host platform.
              <br />
              <br />
              I'm a Computer Engineering student from{" "}
              <strong className="text-zinc-200 font-semibold">
                Ahmedabad
              </strong>{" "}
              with a focus on{" "}
              <strong className="text-zinc-200 font-semibold">
                Full Stack Development
              </strong>
              ,{" "}
              <strong className="text-zinc-200 font-semibold">
                Agentic AI
              </strong>
              , and applied AI systems — RAG, vector search, and LLM tooling.
            </p>

            <div className="flex flex-wrap gap-1.5 mb-7">
              {TAGS.map((tag) => (
                <span
                  key={tag.label}
                  className={[
                    "text-[10px] px-2.5 py-1 rounded-none border tracking-[.02em]",
                    tag.hi
                      ? "border-primary/30 text-primary bg-primary/10"
                      : "border-white/10 text-zinc-500 bg-[#141418]",
                  ].join(" ")}
                >
                  {tag.label}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.href}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] border border-white/6 text-zinc-400 no-underline hover:border-white/11 hover:text-zinc-100"
                >
                  <div
                    className={`w-7 h-7 rounded-[7px] border flex items-center justify-center shrink-0 ${s.iconBg}`}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <p className={`text-[.8rem] font-medium text-zinc-100`}>
                      {s.label}
                    </p>
                    <p className="text-[.72rem] text-zinc-600 mt-px">
                      {s.handle}
                    </p>
                  </div>
                  <span className="ml-auto text-[12px] opacity-30">↗</span>
                </a>
              ))}
            </div>
          </div>

          <div className="contact-glow relative bg-[#0f0f12] border border-white/6 rounded-none p-9 h-full overflow-hidden">
            <div className="flex items-center gap-2 mb-5">
              <span
                className="block w-[18px] h-px opacity-60"
                style={{ background: "#34d399" }}
              />
              <span
                className="text-[11px] tracking-widest uppercase"
                style={{ color: "#34d399" }}
              >
                Contact
              </span>
            </div>

            <h2 className="text-[clamp(1.5rem,2.5vw,2rem)] font-extrabold tracking-[-0.03em] leading-[1.15] mb-3">
              Got questions?
              <br />
              <span className="text-primary">Let's talk.</span>
            </h2>
            <p className="text-[.88rem] text-zinc-400 leading-[1.7] mb-7">
              Whether it's a bug, a feature request, a partnership idea, or just
              curiosity about how Trackly works — drop a message and I'll get
              back to you.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                <div>
                  <label className="block text-[10px] tracking-[.06em] uppercase text-zinc-500 mb-1.5">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    placeholder="Jane Smith"
                    className="form-input w-full bg-[#141418] border border-white/10 rounded-[9px] px-3.5 py-2.5 text-[.85rem] text-zinc-100 placeholder-zinc-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] tracking-[.06em] uppercase text-zinc-500 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="jane@acme.com"
                    className="form-input w-full bg-[#141418] border border-white/10 rounded-[9px] px-3.5 py-2.5 text-[.85rem] text-zinc-100 placeholder-zinc-600"
                  />
                </div>
              </div>

              <div className="mb-3.5">
                <label className="block text-[10px] tracking-[.06em] uppercase text-zinc-500 mb-1.5">
                  Subject
                </label>
                <input
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  placeholder="Feature request · Bug report · Partnership"
                  className="form-input w-full bg-[#141418] border border-white/10 rounded-[9px] px-3.5 py-2.5 text-[.85rem] text-zinc-100 placeholder-zinc-600"
                />
              </div>

              <div className="mb-4">
                <label className="block text-[10px] tracking-[.06em] uppercase text-zinc-500 mb-1.5">
                  Message
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={4}
                  placeholder="Tell me what's on your mind..."
                  className="form-input w-full bg-[#141418] border border-white/10 rounded-[9px] px-3.5 py-2.5 text-[.85rem] text-zinc-100 placeholder-zinc-600 resize-none leading-relaxed"
                />
              </div>

              {!submitted ? (
                <Button type="submit" disabled={sending} className="cursor-pointer border-2 border-black bg-white px-5 py-3 font-semibold text-black shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0 transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed w-full">
                  {sending ? (
                    <>
                      <svg
                        className="animate-spin"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <circle cx="12" cy="12" r="10" strokeOpacity=".25" />
                        <path
                          d="M12 2a10 10 0 0 1 10 10"
                          strokeLinecap="round"
                        />
                      </svg>
                      Sending…
                    </>
                  ) : (
                    <>
                      Send Message <ArrowUpRightIcon />
                    </>
                  )}
                </Button>
              ) : (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-[9px] border"
                  style={{
                    background: "rgba(52,211,153,0.08)",
                    borderColor: "rgba(52,211,153,0.2)",
                  }}
                >
                  <span
                    className="pulse-dot w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      background: "#34d399",
                      boxShadow: "0 0 6px #34d399",
                    }}
                  />
                  <span className="text-[.78rem]" style={{ color: "#34d399" }}>
                    Message sent — I'll reply within 24 hours.
                  </span>
                </div>
              )}
            </form>

            <div className="mt-5 pt-4 border-t border-white/6 flex items-center gap-2">
              <span
                className="pulse-dot w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "#34d399", boxShadow: "0 0 6px #34d399" }}
              />
              <span className="text-[.78rem] text-zinc-500">
                Usually responds within{" "}
                <strong className="text-zinc-200 font-semibold">
                  24 hours
                </strong>
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
