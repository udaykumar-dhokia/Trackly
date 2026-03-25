"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { SidebarInset } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartLineUp,
  Crown,
  ShieldCheck,
  Calendar,
  WarningCircle,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import Link from "next/link";

interface UsageData {
  org_id: string;
  plan: string;
  current_month_usage: number;
  plan_limit: number;
  reset_date: string;
}

export default function UsagePage() {
  const { activeOrgId, organizations } = useAppSelector(
    (state) => state.projects,
  );
  const activeOrg = organizations.find((o) => o.id === activeOrgId);

  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeOrgId) {
      setLoading(true);
      fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/organizations/${activeOrgId}/usage`,
      )
        .then((res) => res.json())
        .then((data) => {
          setUsage(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Failed to fetch usage:", err);
          setLoading(false);
        });
    }
  }, [activeOrgId]);

  const usagePercentage = usage
    ? Math.min((usage.current_month_usage / usage.plan_limit) * 100, 100)
    : 0;
  const isNearLimit = usagePercentage > 80;
  const isOverLimit = usagePercentage >= 100;

  return (
    <SidebarInset className="bg-background">
      <div className="flex flex-1 flex-col gap-8 p-8 md:p-12 max-w-6xl mx-auto w-full transition-colors duration-300">
        <div className="space-y-2">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-bold text-foreground tracking-tight"
          >
            Usage & Billing
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-sm font-medium opacity-70"
          >
            Monitor organization throughput and resource allocation.
          </motion.p>
        </div>

        {loading ? (
          <div className="grid gap-6">
            <div className="bg-card border-2 border-border animate-pulse h-80 shadow-[4px_4px_0_0_rgba(0,0,0,0.03)]" />
          </div>
        ) : usage ? (
          <div className="grid gap-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="bg-card border-2 border-border shadow-[8px_8px_0_0_rgba(0,0,0,0.03)] dark:shadow-[8px_8px_0_0_rgba(255,255,255,0.02)] overflow-hidden rounded-none">
                <CardHeader className="border-b-2 border-border pb-8 p-8 relative bg-secondary/20">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-1">
                      <CardTitle className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest opacity-60">
                        Current Consumption
                      </CardTitle>
                      <div className="flex items-baseline gap-3">
                        <span className="text-5xl font-bold text-foreground tracking-tight">
                          {usage.current_month_usage.toLocaleString()}
                        </span>
                        <span className="text-muted-foreground font-semibold text-sm opacity-60">
                          / {usage.plan_limit.toLocaleString()} logs
                        </span>
                      </div>
                    </div>
                    <div className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider border-2 border-foreground shadow-[3px_3px_0_0_#000] dark:shadow-[3px_3px_0_0_#fff]">
                      {usage.plan.toUpperCase()} PLAN
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 md:p-10 space-y-10">
                  <div className="space-y-4">
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider">
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
                    <div className="h-6 w-full bg-secondary border-2 border-border p-0.5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${usagePercentage}%` }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className={`h-full ${
                          isOverLimit
                            ? "bg-destructive"
                            : isNearLimit
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        } opacity-90`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center gap-5 bg-secondary/30 p-5 border-2 border-border transition-all hover:bg-secondary/50">
                      <div className="size-11 flex items-center justify-center bg-indigo-500 text-white border-2 border-foreground shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff]">
                        <Calendar size={20} weight="bold" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                          Cycle Reset Date
                        </p>
                        <p className="text-base text-foreground font-bold tracking-tight">
                          {new Date(usage.reset_date).toLocaleDateString(
                            undefined,
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 bg-secondary/30 p-5 border-2 border-border transition-all hover:bg-secondary/50">
                      <div
                        className={`size-11 flex items-center justify-center text-white border-2 border-foreground shadow-[2px_2px_0_0_#000] dark:shadow-[2px_2px_0_0_#fff] ${isOverLimit ? "bg-destructive" : "bg-emerald-500"}`}
                      >
                        <ShieldCheck size={20} weight="bold" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">
                          System Integrity
                        </p>
                        <p className="text-base text-foreground font-bold tracking-tight">
                          {isOverLimit ? "LIMIT REACHED" : "NOMINAL OPERATION"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col gap-5 p-7 bg-card border-2 border-border shadow-[4px_4px_0_0_rgba(0,0,0,0.03)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.02)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]"
              >
                <div className="size-10 flex items-center justify-center bg-indigo-500/10 border border-indigo-500/20 text-indigo-500">
                  <ChartLineUp size={22} weight="bold" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-foreground font-bold text-lg tracking-tight">
                    Usage Analytics
                  </h3>
                  <p className="text-muted-foreground text-xs font-medium opacity-60 leading-relaxed">
                    Granular breakdown of ingestion patterns across models.
                  </p>
                </div>
                <Link
                  href="/dashboard"
                  className="mt-2 bg-secondary/50 p-2.5 text-center border-2 border-border text-[10px] font-bold uppercase tracking-wider hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all flex items-center justify-center gap-2"
                >
                  Explore Ingests <ArrowUpRight size={14} weight="bold" />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-col gap-5 p-7 bg-card border-2 border-border shadow-[4px_4px_0_0_rgba(0,0,0,0.03)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.02)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]"
              >
                <div className="flex justify-between items-start">
                  <div className="size-10 flex items-center justify-center bg-amber-500/10 border border-amber-500/20 text-amber-500">
                    <Crown size={22} weight="bold" />
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    Upgrades
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-foreground font-bold text-lg tracking-tight">
                    Scaling Plan
                  </h3>
                  <p className="text-muted-foreground text-xs font-medium opacity-60 leading-relaxed">
                    Evolve your workspace with high-throughput quotas.
                  </p>
                </div>
                <Link
                  href="/#pricing"
                  className="mt-2 bg-secondary/50 p-2.5 text-center border-2 border-border text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500 hover:text-black hover:border-amber-500 transition-all flex items-center justify-center gap-2"
                >
                  View Tiers <ArrowUpRight size={14} weight="bold" />
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-col gap-5 p-7 bg-card border-2 border-border shadow-[4px_4px_0_0_rgba(0,0,0,0.03)] dark:shadow-[4px_4px_0_0_rgba(255,255,255,0.02)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_0_rgba(0,0,0,0.05)]"
              >
                <div className="size-10 flex items-center justify-center bg-muted-foreground/10 border border-border text-muted-foreground">
                  <WarningCircle size={22} weight="bold" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-foreground font-bold text-lg tracking-tight">
                    System Support
                  </h3>
                  <p className="text-muted-foreground text-xs font-medium opacity-60 leading-relaxed">
                    Direct access to engineering for mission-critical issues.
                  </p>
                </div>
                <Link
                  href="/#contact"
                  className="mt-2 bg-secondary/50 p-2.5 text-center border-2 border-border text-[10px] font-bold uppercase tracking-wider hover:bg-foreground hover:text-background hover:border-foreground transition-all flex items-center justify-center gap-2"
                >
                  Open Ticket <ArrowUpRight size={14} weight="bold" />
                </Link>
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4 bg-card border-2 border-border border-dashed">
            <WarningCircle
              size={48}
              weight="duotone"
              className="text-muted-foreground opacity-30"
            />
            <div className="space-y-1">
              <p className="text-foreground font-bold">Data Link Severed</p>
              <p className="text-muted-foreground text-xs opacity-60">
                Failed to synchronize with usage metrics. Retry later.
              </p>
            </div>
          </div>
        )}
      </div>
    </SidebarInset>
  );
}
