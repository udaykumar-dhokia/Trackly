"use client";

import { useState } from "react";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChatTeardropText } from "@phosphor-icons/react";

export function FeedbackForm() {
  const { user } = useUser();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiUrl}/api/v1/feedback?auth0_id=${encodeURIComponent(user?.sub || "")}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (response.ok) {
        toast.success("Feedback submitted! It will appear on the landing page once verified.");
        setContent("");
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
    <div className="bg-[#141418] border border-white/10 rounded-none overflow-hidden shadow-lg">
      <div className="p-6 border-b border-white/5 flex items-center gap-4 bg-white/5">
        <div className="p-2 bg-indigo-500/10 rounded-lg">
          <ChatTeardropText size={24} className="text-indigo-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Share your Experience</h2>
          <p className="text-zinc-500 text-xs">Your feedback helps us improve Trackly.</p>
        </div>
      </div>

      <div className="p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="What do you think about Trackly? (max 1000 characters)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="bg-[#0f0f12] border-white/5 focus:border-indigo-500/50 min-h-[120px] text-zinc-200 rounded-lg"
            maxLength={1000}
            required
          />
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-none py-2 px-6"
            >
              {isSubmitting ? "Submitting..." : "Submit Feedback"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
