"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EnvelopeSimpleOpen, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

function UnsubscribePageContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState(
    "Click below to confirm and stop receiving Trackly emails.",
  );

  const payload = useMemo(
    () => ({
      id: searchParams.get("id") ?? "",
      audience_id: searchParams.get("audience_id") ?? "",
    }),
    [searchParams],
  );

  const hasValidParams = Boolean(payload.id && payload.audience_id);

  const handleUnsubscribe = async () => {
    if (!hasValidParams || status === "loading" || status === "success") {
      return;
    }

    setStatus("loading");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      let response = await fetch(`${apiUrl}/api/v1/emails/unsubscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        const query = new URLSearchParams(payload).toString();
        response = await fetch(`${apiUrl}/api/v1/emails/unsubscribe?${query}`, {
          method: "GET",
        });
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.detail ||
          data?.message ||
          "Something went wrong while unsubscribing. Please try again.",
        );
      }

      setStatus("success");
      setMessage(
        data?.message ||
          "You have been successfully removed from our mailing list.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while unsubscribing. Please try again.",
      );
    }
  };

  return (
    <main className="min-h-screen bg-[#07080d] text-zinc-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-16">
        <section className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[#0d0f16]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" className="text-sm font-semibold tracking-tight text-white">
              Trackly
            </Link>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">
              Email preferences
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-500/10 text-indigo-300">
              {status === "success" ? (
                <CheckCircle size={28} weight="fill" />
              ) : status === "error" ? (
                <WarningCircle size={28} weight="fill" />
              ) : (
                <EnvelopeSimpleOpen size={28} weight="fill" />
              )}
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-400">
                Unsubscribe
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
                Manage your Trackly emails
              </h1>
            </div>
          </div>

          <p className="mt-6 text-sm leading-7 text-zinc-400">{message}</p>

          {!hasValidParams && (
            <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm leading-7 text-amber-100">
              This unsubscribe link is incomplete or expired. If you still want
              to opt out, contact support at{" "}
              <a
                href="mailto:support@tracklyai.in"
                className="font-semibold text-white underline underline-offset-4"
              >
                support@tracklyai.in
              </a>
              .
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={!hasValidParams || status === "loading" || status === "success"}
              className="bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-indigo-950/60 disabled:text-zinc-500"
              onClick={handleUnsubscribe}
            >
              {status === "loading"
                ? "Unsubscribing..."
                : status === "success"
                  ? "Unsubscribed"
                  : "Confirm unsubscribe"}
            </Button>

            <Button
              type="button"
              asChild
              variant="ghost"
              className="text-zinc-300 hover:bg-white/5 hover:text-white"
            >
              <Link href="/">Back to Trackly</Link>
            </Button>
          </div>

          <div className="mt-8 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4 text-xs leading-6 text-zinc-500">
            We only process the unsubscribe request after you confirm on this
            page. That keeps the email link user-facing while the actual removal
            still happens through the backend API.
          </div>
        </section>
      </div>
    </main>
  );
}

function UnsubscribePageFallback() {
  return (
    <main className="min-h-screen bg-[#07080d] text-zinc-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.12),transparent_30%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-16">
        <section className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[#0d0f16]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-400">
            Unsubscribe
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white">
            Loading your email preferences
          </h1>
          <p className="mt-6 text-sm leading-7 text-zinc-400">
            We&apos;re preparing your unsubscribe page.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={<UnsubscribePageFallback />}>
      <UnsubscribePageContent />
    </Suspense>
  );
}
