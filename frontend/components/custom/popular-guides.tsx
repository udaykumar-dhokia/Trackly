"use client";
import React from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";

interface Article {
  path: string;
  chapterTitle: string;
  title: string;
  description: string;
}

interface PopularGuidesProps {
  featuredGuides: Article[];
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

export default function PopularGuides({ featuredGuides }: PopularGuidesProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={containerVariants}
        className="rounded-3xl border border-white/10 bg-white/3 p-6 sm:p-8"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <motion.p
              variants={cardVariants}
              className="text-xs font-bold uppercase tracking-[0.24em] text-white/45"
            >
              Popular Guides
            </motion.p>
            <motion.h2
              variants={cardVariants}
              className="mt-3 text-3xl font-bold tracking-tight text-white"
            >
              Learn the workflows teams actually use in Trackly
            </motion.h2>
            <motion.p
              variants={cardVariants}
              className="mt-3 text-sm leading-7 text-zinc-400"
            >
              Practical articles on token tracking, model comparison, traces,
              agents, and production LLM cost visibility.
            </motion.p>
          </div>
          <motion.div variants={cardVariants}>
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-indigo-300"
            >
              Explore all resources
            </Link>
          </motion.div>
        </div>

        <motion.div
          variants={containerVariants}
          className="mt-8 grid gap-4 lg:grid-cols-3"
        >
          {featuredGuides.map((article) => (
            <motion.div key={article.path} variants={cardVariants}>
              <Link
                href={article.path}
                className="block group rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:border-white/25 hover:bg-white/4"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  {article.chapterTitle}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-white group-hover:text-primary transition-colors">
                  {article.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {article.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
