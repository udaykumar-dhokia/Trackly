"use client";

import { Check, Rocket, Crown, Star } from "@phosphor-icons/react";
import { Button } from "../ui/button";

const plans = [
  {
    name: "Starter",
    price: "$0",
    description: "Perfect for early-stage experiments and side projects.",
    logs: "50,000",
    features: [
      "3 Projects",
      "7-day Log Retention",
      "Basic Analytics",
      "Community Support",
    ],
    icon: <Star className="size-6 text-amber-400" weight="fill" />,
    buttonText: "Start Free",
    highlight: false,
    comingSoon: false,
  },
  {
    name: "Pro",
    price: "$29",
    description: "For growing teams that need reliable telemetry and insights.",
    logs: "500,000",
    features: [
      "Unlimited Projects",
      "30-day Log Retention",
      "Advanced Analytics",
      "Team Collaboration",
      "Email Support",
    ],
    icon: <Rocket className="size-6 text-indigo-400" weight="fill" />,
    buttonText: "Coming Soon",
    highlight: true,
    comingSoon: true,
  },
  {
    name: "Scale",
    price: "$99",
    description: "Advanced controls for startups with high-volume traffic.",
    logs: "1,000,000",
    features: [
      "Everything in Pro",
      "90-day Log Retention",
      "Custom Feature Tags",
      "Priority Support",
      "SLA Guarantees",
    ],
    icon: <Crown className="size-6 text-fuchsia-400" weight="fill" />,
    buttonText: "Coming Soon",
    highlight: false,
    comingSoon: true,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="py-24 bg-background relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-1/4 -left-24 size-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-24 size-96 bg-primary/5 rounded-full blur-[128px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.4em] text-primary">
            Pricing Plans
          </h2>
          <h3 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter">
            Scalable Telemetry for{" "}
            <span className="text-indigo-500">Early Startups</span>
          </h3>
          <p className="text-muted-foreground font-mono text-sm max-w-2xl mx-auto">
            Transparent pricing based on monthly log volume. No hidden fees,
            just raw performance and deep insights.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`relative flex flex-col p-8 border-4 transition-all rounded-none
                ${
                  plan.highlight
                    ? "bg-card border-indigo-500 shadow-[12px_12px_0_0_#4f46e5]"
                    : "bg-card border-border hover:border-primary shadow-[8px_8px_0_0_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0_0_rgba(0,0,0,0.3)] hover:-translate-y-1 hover:shadow-[12px_12px_0_0_rgba(0,0,0,0.1)] dark:hover:shadow-[12px_12px_0_0_rgba(0,0,0,0.5)]"
                }
              `}
            >
              {plan.highlight && (
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest px-6 py-2 shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff]">
                  Most Popular
                </div>
              )}

              <div className="flex items-center justify-between mb-8">
                <div className="p-3 bg-secondary border border-border">
                  {plan.icon}
                </div>
                <div className="text-right">
                  <span className="text-4xl font-black text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground font-black uppercase text-[10px] tracking-widest block mt-1">
                    / month
                  </span>
                </div>
              </div>

              <h4 className="text-2xl font-black text-foreground mb-2 tracking-tight">{plan.name}</h4>
              <p className="text-muted-foreground text-xs mb-8 h-10 leading-relaxed font-medium">
                {plan.description}
              </p>

              <div className="mb-10 p-4 bg-secondary border-2 border-border font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-indigo-500 font-black text-lg">{plan.logs}</span>
                  <span className="text-muted-foreground text-[9px] font-black uppercase tracking-widest">
                    Logs included
                  </span>
                </div>
              </div>

              <ul className="space-y-4 mb-10 flex-1">
                {plan.features.map((feature, fIdx) => (
                  <li
                    key={fIdx}
                    className="flex items-start gap-3 text-xs text-foreground/80 font-bold"
                  >
                    <Check
                      className="size-4 text-emerald-500 shrink-0"
                      weight="bold"
                    />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                disabled={plan.comingSoon}
                className={`w-full py-8 font-black uppercase tracking-widest transition-all rounded-none border-2 border-black dark:border-white
                  ${
                    plan.highlight
                      ? "bg-indigo-500 text-white shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:bg-indigo-500/50 disabled:shadow-none transition-all"
                      : "bg-foreground text-background shadow-[4px_4px_0_0_#000] dark:shadow-[4px_4px_0_0_#fff] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none transition-all"
                  }
                `}
              >
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <p className="text-muted-foreground text-[11px] font-black uppercase tracking-[0.3em]">
            Need more logs?{" "}
            <a href="#contact" className="text-indigo-500 hover:text-indigo-400 transition-colors border-b-2 border-indigo-500/20 hover:border-indigo-500">
              Contact us for enterprise
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
