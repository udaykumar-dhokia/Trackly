"use client";

import { useEffect, useState } from "react";
import { TestimonialCard } from "./testimonial-card";
import { Marquee } from "@/components/ui/marquee";

interface Feedback {
  id: string;
  user_name: string;
  user_photo?: string;
  content: string;
  created_at: string;
}

export default function Testimonials() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      try {
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        const response = await fetch(`${apiUrl}/v1/feedback`);
        if (response.ok) {
          const data = await response.json();
          setFeedbacks(data);
        }
      } catch (error) {
        console.error("Failed to fetch testimonials:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFeedbacks();
  }, []);

  if (loading || feedbacks.length === 0) {
    return null;
  }

  const SHOW_MARQUEE_THRESHOLD = 3;
  const useMarquee = feedbacks.length >= SHOW_MARQUEE_THRESHOLD;

  return (
    <section className="py-24 bg-[#0a0a0c] border-t border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            What our users are saying
          </h2>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            Join developers who are optimizing their LLM costs with Trackly.
          </p>
        </div>

        {useMarquee ? (
          <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden">
            <Marquee pauseOnHover className="[--duration:40s]">
              {feedbacks.map((fb) => (
                <TestimonialCard
                  key={fb.id}
                  name={fb.user_name}
                  photo={fb.user_photo}
                  content={fb.content}
                  className="w-[350px]"
                />
              ))}
            </Marquee>
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-[#0a0a0c]"></div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-1/3 bg-gradient-to-l from-[#0a0a0c]"></div>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {feedbacks.map((fb) => (
              <TestimonialCard
                key={fb.id}
                name={fb.user_name}
                photo={fb.user_photo}
                content={fb.content}
                className="w-[350px]"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
