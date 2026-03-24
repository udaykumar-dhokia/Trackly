"use client";
import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    n: 1,
    title: "Sign in & view your Dashboard",
    desc: "After signing in, you land on the Trackly Dashboard. If you don't have any projects yet, you'll be prompted to create your first one.",
    img: "/flow/1.png",
  },
  {
    n: 2,
    title: "Navigate to Projects",
    desc: "Head to Organization Settings → Projects to see all your tracking environments. Each project isolates its data and API keys.",
    img: "/flow/2.png",
  },
  {
    n: 3,
    title: "Create a new Project",
    desc: 'Click "+ New Project", give it a name (e.g. "My App"), and hit Launch Project. Projects keep your tracking data cleanly separated.',
    img: "/flow/3.png",
  },
  {
    n: 4,
    title: "Go to API Keys",
    desc: "Navigate to API Keys from the sidebar. You'll need a key to authenticate your SDK calls from your codebase.",
    img: "/flow/4.png",
  },
  {
    n: 5,
    title: "Generate an API Key",
    desc: 'Click "+ Create API Key", give it a descriptive name, and optionally scope it to a specific project for tighter access control.',
    img: "/flow/5.png",
  },
  {
    n: 6,
    title: "Copy your API Key & start tracking",
    desc: "Your key is generated! Copy it immediately — you won't be able to see it again. Drop it into your environment variables and start tracking.",
    img: "/flow/6.png",
  },
];

export default function HowItWorks() {
  const [mounted, setMounted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setMounted(true);
      },
      { threshold: 0.08 },
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <>
      <style>{`
        .hiw-section { position: relative; overflow: hidden; }
        .hiw-section::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(167,139,250,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167,139,250,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 100% 50% at 50% 0%, black 20%, transparent 80%);
        }
        .hiw-reveal { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
        .hiw-reveal.in { opacity: 1; transform: translateY(0); }
        .hiw-img-wrap {
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          overflow: hidden;
          background: #0a0a0c;
          transition: border-color 0.2s, box-shadow 0.3s;
        }
        .hiw-img-wrap:hover {
          border-color: rgba(167,139,250,0.25);
          box-shadow: 0 0 40px rgba(167,139,250,0.08);
        }
        .hiw-img-wrap img {
          width: 100%;
          display: block;
        }
        .hiw-step-badge {
          width: 36px; height: 36px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800;
          background: #a78bfa; color: #09090b;
          border-radius: 0;
          flex-shrink: 0;
        }
        .hiw-connector {
          width: 2px;
          flex: 1;
          background: linear-gradient(to bottom, rgba(167,139,250,0.3), rgba(167,139,250,0.05));
          margin-left: 17px;
        }
      `}</style>

      <section
        ref={sectionRef}
        className="hiw-section bg-[#09090b] border-t border-white/6 px-6 py-24 text-zinc-100"
      >
        <div className="mx-auto max-w-[1080px]">
          <div className={`hiw-reveal ${mounted ? "in" : ""}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-px bg-primary/60" />
              <span className="text-[11px] uppercase tracking-[.12em] text-primary">
                How It Works
              </span>
            </div>
            <h2 className="text-[clamp(1.9rem,3.5vw,2.8rem)] font-extrabold tracking-[-0.03em] leading-[1.1] mb-4 max-w-[660px]">
              Start tracking in{" "}
              <span className="text-primary">6 simple steps</span>
            </h2>
            <p className="text-[.95rem] text-zinc-400 leading-[1.7] max-w-[520px] mb-14">
              From sign-in to your first tracked LLM call — here's everything
              you need to get up and running with Trackly.
            </p>
          </div>

          <div className="flex flex-col gap-0">
            {STEPS.map((step, i) => (
              <div key={step.n} className="flex gap-6">
                <div className="hidden md:flex flex-col items-center">
                  <div
                    className={`hiw-step-badge hiw-reveal ${mounted ? "in" : ""}`}
                    style={{ transitionDelay: `${0.1 + i * 0.1}s` }}
                  >
                    {step.n}
                  </div>
                  {i < STEPS.length - 1 && <div className="hiw-connector" />}
                </div>

                <div
                  className={`flex-1 pb-12 hiw-reveal ${mounted ? "in" : ""}`}
                  style={{ transitionDelay: `${0.12 + i * 0.1}s` }}
                >
                  <div className="flex md:hidden items-center gap-3 mb-3">
                    <div className="hiw-step-badge">{step.n}</div>
                    <h3 className="text-[1.05rem] font-bold tracking-[-0.02em]">
                      {step.title}
                    </h3>
                  </div>

                  <h3 className="hidden md:block text-[1.05rem] font-bold tracking-[-0.02em] mb-2">
                    {step.title}
                  </h3>
                  <p className="text-[.88rem] text-zinc-400 leading-[1.7] mb-4 max-w-[520px]">
                    {step.desc}
                  </p>
                  <div className="hiw-img-wrap max-w-[720px]">
                    <img
                      src={step.img}
                      alt={`Step ${step.n}: ${step.title}`}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
