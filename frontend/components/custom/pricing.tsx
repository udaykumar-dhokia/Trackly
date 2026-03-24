"use client";

import { Check } from "@phosphor-icons/react";

const plans = [
  {
    name: "Starter",
    price: "$0",
    period: "forever",
    desc: "For side projects and experiments.",
    logs: "50K",
    features: [
      "3 Projects",
      "7-day log retention",
      "Basic analytics",
      "Community support",
    ],
    accent: "#a78bfa",
    cta: "Start Free",
    comingSoon: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    desc: "For growing teams that need reliable telemetry.",
    logs: "500K",
    features: [
      "Unlimited projects",
      "30-day log retention",
      "Advanced analytics",
      "Team collaboration",
      "Email support",
    ],
    accent: "#818cf8",
    cta: "Coming Soon",
    comingSoon: true,
    popular: true,
  },
  {
    name: "Scale",
    price: "$99",
    period: "/month",
    desc: "Advanced controls for high-volume traffic.",
    logs: "1M",
    features: [
      "Everything in Pro",
      "90-day log retention",
      "Custom feature tags",
      "Priority support",
      "SLA guarantees",
    ],
    accent: "#c084fc",
    cta: "Coming Soon",
    comingSoon: true,
  },
];

export default function Pricing() {
  return (
    <>
      <style>{`
        .pricing-section { position: relative; overflow: hidden; }
        .pricing-section::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(167,139,250,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167,139,250,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 80%);
        }
        .pricing-card {
          background: #0f0f12;
          border: 1px solid rgba(255,255,255,0.06);
          padding: 32px;
          transition: border-color 0.2s, transform 0.2s;
          position: relative; overflow: hidden;
        }
        .pricing-card:hover {
          border-color: rgba(255,255,255,0.11);
          transform: translateY(-2px);
        }
        .pricing-card::after {
          content: ''; position: absolute; inset: 0;
          opacity: 0; transition: opacity 0.3s; pointer-events: none;
          background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(167,139,250,0.05), transparent);
        }
        .pricing-card:hover::after { opacity: 1; }
        .pricing-card.popular {
          border-color: rgba(129,140,248,0.25);
        }
        .pricing-card.popular::after {
          opacity: 0.6;
          background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(129,140,248,0.08), transparent);
        }
        .pricing-btn {
          transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .pricing-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 0 24px rgba(167,139,250,0.3);
        }
      `}</style>

      <section className="pricing-section bg-[#09090b] border-t border-white/6 px-6 py-24 text-zinc-100">
        <div className="mx-auto max-w-[1080px]">
          {/* Header */}
          <div className="mb-14">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-5 h-px bg-primary/60" />
              <span className="text-[11px] uppercase tracking-[.12em] text-primary">
                Pricing
              </span>
            </div>
            <h2 className="text-[clamp(1.9rem,3.5vw,2.8rem)] font-extrabold tracking-[-0.03em] leading-[1.1] mb-4">
              Simple, <span className="text-primary">transparent</span> pricing
            </h2>
            <p className="text-[.95rem] text-zinc-400 leading-[1.7] max-w-[460px]">
              Start free. Scale when you're ready. No hidden fees — just raw
              performance and deep insights.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`pricing-card ${plan.popular ? "popular" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0">
                    <span className="bg-primary text-black text-[9px] font-bold uppercase tracking-[.08em] px-3 py-1.5 block">
                      Popular
                    </span>
                  </div>
                )}

                <p className="text-[.75rem] font-bold uppercase tracking-widest text-zinc-500 mb-5">
                  {plan.name}
                </p>

                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-[2.4rem] font-extrabold tracking-[-0.04em] text-zinc-100">
                    {plan.price}
                  </span>
                  <span className="text-[.8rem] text-zinc-500 font-medium">
                    {plan.period}
                  </span>
                </div>

                <p className="text-[.82rem] text-zinc-500 leading-[1.6] mb-6">
                  {plan.desc}
                </p>

                {/* Log volume badge */}
                <div className="flex items-center gap-2 mb-6 py-2.5 px-3 bg-[#141418] border border-white/6">
                  <span
                    className="text-[1.1rem] font-bold"
                    style={{ color: plan.accent }}
                  >
                    {plan.logs}
                  </span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-[.06em]">
                    logs / month
                  </span>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2.5 text-[.8rem] text-zinc-400"
                    >
                      <Check
                        className="size-3.5 shrink-0"
                        weight="bold"
                        style={{ color: plan.accent }}
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  disabled={plan.comingSoon}
                  className={`cursor-pointer border-2 border-black bg-white px-5 py-3 font-semibold text-black shadow-primary shadow-[4px_4px_0_0] hover:bg-indigo-300 focus:ring-2 focus:ring-indigo-300 focus:outline-0 w-full transition-all disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed
                  `}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="text-center text-[.78rem] text-zinc-600 mt-8">
            Need more?{" "}
            <a
              href="#contact"
              className="text-primary hover:text-[#c4b5fd] transition-colors"
            >
              Contact us for enterprise pricing
            </a>
          </p>
        </div>
      </section>
    </>
  );
}
