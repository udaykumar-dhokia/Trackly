"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { SidebarInset } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowUpRight,
  Calendar,
  ChartLineUp,
  Coins,
  ShieldCheck,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import Link from "next/link";

interface BudgetStatus {
  monthly_token_limit: number | null;
  monthly_cost_limit_usd: number | null;
  current_month_tokens: number;
  current_month_cost_usd: number;
  token_usage_percentage: number | null;
  cost_usage_percentage: number | null;
  token_remaining: number | null;
  cost_remaining_usd: number | null;
  status: string;
  updated_at: string | null;
}

interface UsageData {
  org_id: string;
  plan: string;
  current_month_usage: number;
  current_month_events: number;
  current_month_tokens: number;
  current_month_cost_usd: number;
  plan_limit: number;
  reset_date: string;
  budget: BudgetStatus | null;
}

export default function UsagePage() {
  const { activeOrgId, organizations } = useAppSelector(
    (state) => state.projects,
  );

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeOrgId) {
      return;
    }

    setLoading(true);
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    fetch(`${apiUrl}/api/v1/organizations/${activeOrgId}/usage`)
      .then((res) => res.json())
      .then((data: UsageData) => {
        setUsage(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch usage:", err);
        setLoading(false);
      });
  }, [activeOrgId]);

  const usagePercentage = usage
    ? Math.min((usage.current_month_tokens / usage.plan_limit) * 100, 100)
    : 0;
  const isNearLimit = usagePercentage > 80;
  const isOverLimit = usagePercentage >= 100;

  return (
    <SidebarInset className="bg-background max-w-6xl mx-auto space-y-12">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-8 transition-colors duration-300 md:p-12 rounded-xl">
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-bold tracking-tight text-foreground"
          >
            Usage & Billing
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm font-medium text-muted-foreground opacity-70"
          >
            Monitor monthly usage, watch budgets, and keep spend visible for the
            full workspace.
          </motion.p>
        </div>

        {loading ? (
          <div className="grid gap-6">
            <div className="h-80 animate-pulse border-2 border-border bg-card shadow-[4px_4px_0_0_rgba(0,0,0,0.03)]" />
          </div>
        ) : usage ? (
          <div className="grid gap-8">
            <Card className="overflow-hidden rounded-xl border-2 border-border bg-card shadow-[8px_8px_0_0_rgba(0,0,0,0.03)] dark:shadow-[8px_8px_0_0_rgba(255,255,255,0.02)]">
              <CardHeader className="relative border-b-2 border-border bg-secondary/20 p-8 pb-8">
                <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                  <div className="space-y-1">
                    <CardTitle className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
                      Current Consumption
                    </CardTitle>
                    <div className="flex items-baseline gap-3">
                      <span className="text-5xl font-bold tracking-tight text-foreground">
                        {usage.current_month_tokens.toLocaleString()}
                      </span>
                      <span className="text-sm font-semibold text-muted-foreground opacity-60">
                        / {usage.plan_limit.toLocaleString()} tokens
                      </span>
                    </div>
                  </div>
                  <div className="bg-primary px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary-foreground rounded-xl">
                    {usage.plan.toUpperCase()} PLAN
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 p-8 md:p-10">
                <div className="space-y-4">
                  <div className="flex justify-between text-[11px] font-bold tracking-wider">
                    <span className="text-muted-foreground opacity-60">
                      Monthly Capacity Utilization
                    </span>
                    <span
                      className={
                        isOverLimit
                          ? "text-destructive"
                          : isNearLimit
                            ? "text-amber-500"
                            : "text-emerald-500"
                      }
                    >
                      {usagePercentage.toFixed(1)}% Consumed
                    </span>
                  </div>
                  <div className="h-6 w-full rounded-xl overflow-hidden bg-secondary p-0.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${usagePercentage}%` }}
                      transition={{ duration: 1.2, ease: "circOut" }}
                      className={`h-full rounded-xl ${
                        isOverLimit
                          ? "bg-destructive"
                          : isNearLimit
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      } opacity-90`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                  <InfoTile
                    icon={<Stack size={20} weight="bold" />}
                    color="bg-fuchsia-500"
                    label="Tokens"
                    value={usage.current_month_tokens.toLocaleString()}
                  />
                  <InfoTile
                    icon={<ChartLineUp size={20} weight="bold" />}
                    color="bg-indigo-500"
                    label="Events"
                    value={usage.current_month_events.toLocaleString()}
                  />
                  <InfoTile
                    icon={<Coins size={20} weight="bold" />}
                    color="bg-emerald-500"
                    label="Estimated Spend"
                    value={`$${usage.current_month_cost_usd.toFixed(4)}`}
                  />
                  <InfoTile
                    icon={<Calendar size={20} weight="bold" />}
                    color="bg-amber-500"
                    label="Cycle Reset"
                    value={new Date(usage.reset_date).toLocaleDateString(
                      undefined,
                      {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-3">
              <ActionCard
                icon={<ChartLineUp size={22} weight="bold" />}
                label="Usage Analytics"
                title="Project Trends"
                body="Inspect model-level cost and token movement, then export the filtered analytics report."
                href="/dashboard"
              />
              <ActionCard
                icon={<ShieldCheck size={22} weight="bold" />}
                label="Event Log"
                title="Raw Telemetry"
                body="Drill into filtered events, then export CSV or PDF snapshots for audits and reviews."
                href="/events"
              />
              <ActionCard
                icon={<WarningCircle size={22} weight="bold" />}
                label="Support"
                title="Scaling Help"
                body="If you are brushing up against both plan and budget thresholds, talk to us before routing changes become painful."
                href="/#contact"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 border-2 border-dashed border-border bg-card py-24 text-center">
            <WarningCircle size={48} weight="duotone" className="opacity-30" />
            <div className="space-y-1">
              <p className="font-bold text-foreground">Data Link Severed</p>
              <p className="text-xs text-muted-foreground opacity-60">
                Failed to synchronize with usage metrics. Retry later.
              </p>
            </div>
          </div>
        )}
      </div>
    </SidebarInset>
  );
}

function InfoTile({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl flex items-center gap-5 border-2 border-border bg-secondary/30 p-5 transition-all hover:bg-secondary/50">
      <div
        className={`flex size-11 items-center justify-center text-white rounded-xl ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">
          {label}
        </p>
        <p className="text-base font-bold tracking-tight text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  label,
  title,
  body,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  href: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-5 border-2 border-border bg-card rounded-xl p-7 shadow-[4px_4px_0_0_rgba(0,0,0,0.03)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-10 items-center justify-center text-foreground">
          {icon}
        </div>
        <span className="border border-border bg-secondary/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-bold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="text-xs font-medium leading-relaxed text-muted-foreground opacity-70">
          {body}
        </p>
      </div>
      <Link
        href={href}
        className="mt-2 rounded-xl flex items-center justify-center gap-2 border-2 border-border bg-secondary/50 p-2.5 text-center text-[10px] font-bold uppercase tracking-wider transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
      >
        Open <ArrowUpRight size={14} weight="bold" />
      </Link>
    </motion.div>
  );
}
