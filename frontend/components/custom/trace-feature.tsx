"use client";
import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Graph, TreeStructure, Intersection } from "@phosphor-icons/react";

export default function TraceFeature() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      className="relative flex flex-col items-center justify-center px-6 py-24 lg:py-32 text-zinc-100 bg-[#09090b] overflow-hidden border-t border-white/5"
    >
      <style>{`
        .trace-grid {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(167, 139, 250, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 139, 250, 0.02) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(circle at center, black 30%, transparent 80%);
          pointer-events: none;
        }
        .trace-orb {
          position: absolute;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(167, 139, 250, 0.05) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .trace-h2 {
          font-size: clamp(1.9rem, 3.5vw, 2.8rem);
          font-weight: 800;
          line-height: 1.08;
          letter-spacing: -0.03em;
        }
        .trace-p {
          font-size: 0.95rem;
          line-height: 1.7;
          color: #a1a1aa;
        }
        .video-wrapper {
          background: #111114;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          overflow: hidden;
          width: 100%;
          box-shadow: 0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.07);
        }
        .video-inner {
          width: 100%;
          height: auto;
          display: block;
        }
      `}</style>

      <div className="trace-grid" />
      <div className="trace-orb" />

      <div className="relative z-10 mx-auto w-full max-w-[1080px]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

          {/* Left Column: Text & Features */}
          <div className="flex flex-col items-start text-left">

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="trace-h2 mb-6"
            >
              Visualize every <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary">
                chain and agent
              </span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="trace-p mb-10 max-w-lg"
            >
              Stop guessing why your chains are slow. Trackly's trace graph reconstructs
              parent-child spans automatically, giving you a crystal-clear map of
              your LLM request lifecycle. No added latency, zero-config.
            </motion.p>

            <div className="flex flex-col gap-6 w-full">
              {[
                { icon: <TreeStructure size={20} />, title: "Automatic Hierarchy", desc: "LangChain chains and nested calls are mapped into a logical tree." },
                { icon: <Graph size={20} />, title: "Interactive Graph", desc: "Pan, zoom, and inspect every node in a 2D force-directed layout." },
                { icon: <Intersection size={20} />, title: "Live Bottleneck Detection", desc: "Identify the slowest span in your entire pipeline instantly." },
              ].map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -16 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.3 + idx * 0.1 }}
                  className="flex items-start gap-4 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform border border-violet-500/10">
                    {item.icon}
                  </div>
                  <div>
                    <h3 className="text-[0.9rem] font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-[0.8rem] text-zinc-500 leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column: Video */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, x: 20 }}
            animate={isInView ? { opacity: 1, scale: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <div className="video-wrapper">
              <video
                src="/trace.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="video-inner"
              />
            </div>
            {/* Subtle reflection/glow similar to Demo */}
            <div className="absolute -inset-4 bg-primary/5 blur-3xl -z-10 rounded-full" />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
