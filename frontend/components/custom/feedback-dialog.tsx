"use client";

import { useEffect, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChatTeardropText } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function FeedbackDialog() {
  const { user } = useUser();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(true), 1500);
    const hideTimer = setTimeout(() => setShowTooltip(false), 8000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(
        `${apiUrl}/api/v1/feedback?auth0_id=${encodeURIComponent(user?.sub || "")}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );

      if (response.ok) {
        toast.success("Feedback submitted! We value your feedback.");
        setContent("");
        setIsOpen(false);
      } else {
        toast.error("Failed to submit feedback.");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (open) setShowTooltip(false);
        }}
      >
        <Tooltip open={showTooltip}>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "text-zinc-400 hover:text-white hover:bg-white/5 transition-all duration-500 relative",
                  showTooltip && "text-indigo-400 scale-110",
                )}
                title="Give Feedback"
              >
                <ChatTeardropText
                  size={20}
                  weight={showTooltip ? "fill" : "bold"}
                />
                {showTooltip && (
                  <span className="absolute inset-0 rounded-full bg-indigo-500/20" />
                )}
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="end"
            className="bg-indigo-600 text-white border-none shadow-xl animate-in fade-in slide-in-from-top-1 px-4 py-2"
          >
            <p className="font-medium text-sm">Got feedback? Share it here!</p>
          </TooltipContent>
        </Tooltip>
        <DialogContent className="bg-[#0f0f12] border-white/10 text-zinc-200 sm:max-w-[425px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              Share your Experience
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Your feedback helps us improve Trackly. Testimonials may be
              featured on our landing page.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <Textarea
              placeholder="What do you think about Trackly? (max 1000 characters)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="bg-[#09090b] border-white/5 focus:border-indigo-500/50 min-h-[120px] text-zinc-200 rounded-xl placeholder:text-zinc-600"
              maxLength={1000}
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[120px]"
              >
                {isSubmitting ? "Submitting..." : "Send Feedback"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
