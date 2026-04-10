"use client";

import { useCallback, useEffect, useState } from "react";
import { MapTrifold, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOUR_EVENT = "trackly:start-platform-tour";
const TOUR_STORAGE_KEY = "trackly-platform-tour-seen-v1";
const TOUR_PADDING = 10;

type TourStep = {
  selector: string;
  title: string;
  description: string;
};

type HighlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="workspace-switcher"]',
    title: "Workspace switcher",
    description:
      "Change organizations here. Trackly refreshes your active workspace so the visual diagnostics stay aligned with the right team and project.",
  },
  {
    selector: '[data-tour="project-switcher"]',
    title: "Project switcher",
    description:
      "Pick the active project for the current workspace here. Trackly uses this context across graph inspection, comparisons, budgets, and member management.",
  },
  {
    selector: '[data-tour="visualise-nav"]',
    title: "Visualise",
    description:
      "Start here. Visualise turns raw traces into a map of your AI system so you can spot bottlenecks, expensive branches, and risky steps fast.",
  },
  {
    selector: '[data-tour="dashboard-nav"]',
    title: "Dashboard overview",
    description:
      "Use the dashboard for rollups and trends after you understand the run-level story in Visualise.",
  },
  {
    selector: '[data-tour="budgets-nav"]',
    title: "Budgets",
    description:
      "Use budgets to set spend guardrails and quickly spot when a provider, feature, or team is drifting toward its limit.",
  },
  {
    selector: '[data-tour="api-keys-nav"]',
    title: "API keys",
    description:
      "Create and manage ingestion keys here so your SDKs and services can send events into Trackly securely.",
  },
  {
    selector: '[data-tour="org-projects-nav"]',
    title: "Organization projects",
    description:
      "Organization admins can manage shared projects here, organize ownership, and control the spaces teams work inside.",
  },
  {
    selector: '[data-tour="project-context-nav"]',
    title: "Project context",
    description:
      "When a project is active, this section exposes project-specific actions like member management without losing your current workspace context.",
  },
  {
    selector: '[data-tour="page-breadcrumb"]',
    title: "Page context",
    description:
      "The breadcrumb shows where you are and gives you a quick way back to the dashboard.",
  },
  {
    selector: '[data-tour="guide-replay"]',
    title: "Replay the guide",
    description:
      "You can reopen this walkthrough any time from here if you want another quick tour.",
  },
  {
    selector: '[data-tour="feedback-trigger"]',
    title: "Share feedback",
    description:
      "Send feedback directly from the header whenever you spot friction or want to suggest improvements.",
  },
];

function getHighlightRect(element: HTMLElement): HighlightRect {
  const rect = element.getBoundingClientRect();
  return {
    top: Math.max(rect.top - TOUR_PADDING, 12),
    left: Math.max(rect.left - TOUR_PADDING, 12),
    width: rect.width + TOUR_PADDING * 2,
    height: rect.height + TOUR_PADDING * 2,
  };
}

export function GuideReplayButton() {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-300"
      title="Open platform guide"
      data-tour="guide-replay"
      onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}
    >
      <MapTrifold size={20} weight="bold" />
    </Button>
  );
}

export function PlatformTour({ autoStart = false }: { autoStart?: boolean }) {
  const [isIntroOpen, setIsIntroOpen] = useState(
    () =>
      typeof window !== "undefined" &&
      autoStart &&
      localStorage.getItem(TOUR_STORAGE_KEY) !== "true",
  );
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [activeSteps, setActiveSteps] = useState<TourStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(
    null,
  );

  const updateHighlight = useCallback(() => {
    if (!isTourOpen) return;
    const step = activeSteps[currentStep];
    if (!step) {
      setHighlightRect(null);
      return;
    }

    const element = document.querySelector(step.selector);
    if (!(element instanceof HTMLElement)) {
      setHighlightRect(null);
      return;
    }

    element.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
    setHighlightRect(getHighlightRect(element));
  }, [activeSteps, currentStep, isTourOpen]);

  const markSeen = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
  }, []);

  const closeTour = useCallback(
    (persist = true) => {
      setIsIntroOpen(false);
      setIsTourOpen(false);
      setActiveSteps([]);
      setCurrentStep(0);
      setHighlightRect(null);
      if (persist) {
        markSeen();
      }
    },
    [markSeen],
  );

  const startTour = useCallback(() => {
    const steps = TOUR_STEPS.filter(
      (step) => document.querySelector(step.selector) instanceof HTMLElement,
    );

    if (steps.length === 0) {
      return;
    }

    setActiveSteps(steps);
    setIsIntroOpen(false);
    setCurrentStep(0);
    setIsTourOpen(true);
  }, []);

  useEffect(() => {
    const handleReplay = () => {
      setIsIntroOpen(false);
      setIsTourOpen(false);
      requestAnimationFrame(() => {
        startTour();
      });
    };

    window.addEventListener(TOUR_EVENT, handleReplay);
    return () => window.removeEventListener(TOUR_EVENT, handleReplay);
  }, [startTour]);

  useEffect(() => {
    if (!isTourOpen) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      updateHighlight();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isTourOpen, updateHighlight]);

  useEffect(() => {
    if (!isTourOpen) return;

    const handleViewportChange = () => updateHighlight();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isTourOpen, updateHighlight]);

  const step = activeSteps[currentStep];

  if (!isIntroOpen && !isTourOpen) {
    return null;
  }

  return (
    <>
      {isTourOpen && highlightRect ? (
        <>
          <div
            className="fixed z-[90] bg-black/70 backdrop-blur-sm transition-all duration-300"
            style={{
              top: 0,
              left: 0,
              width: "100vw",
              height: highlightRect.top,
            }}
          />
          <div
            className="fixed z-[90] bg-black/70 backdrop-blur-sm transition-all duration-300"
            style={{
              top: highlightRect.top,
              left: 0,
              width: highlightRect.left,
              height: highlightRect.height,
            }}
          />
          <div
            className="fixed z-[90] bg-black/70 backdrop-blur-sm transition-all duration-300"
            style={{
              top: highlightRect.top,
              left: highlightRect.left + highlightRect.width,
              width: `calc(100vw - ${highlightRect.left + highlightRect.width}px)`,
              height: highlightRect.height,
            }}
          />
          <div
            className="fixed z-[90] bg-black/70 backdrop-blur-sm transition-all duration-300"
            style={{
              top: highlightRect.top + highlightRect.height,
              left: 0,
              width: "100vw",
              height: `calc(100vh - ${highlightRect.top + highlightRect.height}px)`,
            }}
          />
          <div
            className="fixed z-[91] rounded-2xl border border-indigo-400/80 bg-white/5 shadow-[0_0_0_1px_rgba(165,180,252,0.35),0_0_38px_rgba(99,102,241,0.25)] transition-all duration-300"
            style={{
              top: highlightRect.top,
              left: highlightRect.left,
              width: highlightRect.width,
              height: highlightRect.height,
            }}
          />
        </>
      ) : (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm" />
      )}

      {isIntroOpen && (
        <div className="fixed inset-0 z-[92] flex items-center justify-center px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-white/10 bg-[#0d0f16] p-7 text-zinc-200 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-400">
                  Welcome to Trackly
                </p>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
                  Take a quick visual intelligence tour
                </h2>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-zinc-500 hover:text-white hover:bg-white/5"
                onClick={() => closeTour(true)}
              >
                <X size={18} />
              </Button>
            </div>

            <p className="text-sm leading-7 text-zinc-400">
              We&apos;ll point out the core places you&apos;ll use most often so
              you can get oriented fast and move from raw events to clear decisions.
            </p>

            <div className="mt-6 grid gap-3 text-sm">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                Start with Visualise, then fan out into trends and controls.
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                Learn where to navigate, retrace steps, and ask for help.
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="ghost"
                className="text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() => closeTour(true)}
              >
                Not now
              </Button>
              <Button
                type="button"
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={startTour}
              >
                Start tour
              </Button>
            </div>
          </div>
        </div>
      )}

      {isTourOpen && step && (
        <div className="fixed bottom-5 right-5 z-[92] w-[min(360px,calc(100vw-2rem))] rounded-[26px] border border-white/10 bg-[#0d0f16] p-5 text-zinc-200 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.28em] text-indigo-400">
                Platform guide
              </p>
              <h3 className="mt-2 text-lg font-black tracking-tight text-white">
                {step.title}
              </h3>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-zinc-500 hover:text-white hover:bg-white/5"
              onClick={() => closeTour(true)}
            >
              <X size={18} />
            </Button>
          </div>

          <p className="text-sm leading-7 text-zinc-400">{step.description}</p>

          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-zinc-500">
              Step {currentStep + 1} of {activeSteps.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="text-zinc-400 hover:text-white hover:bg-white/5"
                onClick={() =>
                  setCurrentStep((value) => Math.max(0, value - 1))
                }
                disabled={currentStep === 0}
              >
                Back
              </Button>
              {currentStep === activeSteps.length - 1 ? (
                <Button
                  type="button"
                  className="bg-indigo-600 text-white hover:bg-indigo-500"
                  onClick={() => closeTour(true)}
                >
                  Finish
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-indigo-600 text-white hover:bg-indigo-500"
                  onClick={() =>
                    setCurrentStep((value) =>
                      Math.min(activeSteps.length - 1, value + 1),
                    )
                  }
                >
                  Next
                </Button>
              )}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {activeSteps.map((_, index) => (
              <span
                key={index}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-300",
                  index === currentStep ? "bg-indigo-400" : "bg-white/10",
                )}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
