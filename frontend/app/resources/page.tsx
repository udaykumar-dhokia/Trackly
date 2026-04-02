import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRightIcon,
  BookOpenIcon,
  ClockIcon,
} from "@/components/custom/resource-icons";
import ResourcesShell from "@/components/custom/resources-shell";
import ResourcesSearch from "@/components/custom/resources-search";
import {
  getAllResourceArticles,
  getResourceChapterBannerImage,
  getResourceChapters,
} from "@/lib/resources";
import { DEFAULT_OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Resources",
  description:
    "Free Trackly resources on AI agents, RAG, LangChain, token tracking, model comparison, traces, and practical LLM observability.",
  keywords: [
    "AI agents tutorial",
    "RAG tutorial",
    "LangChain guide",
    "LLM cost tracking",
    "token tracking",
    "model comparison playground",
    "LLM tracing",
    "Trackly resources",
  ],
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: "Resources | Trackly",
    description:
      "Free Trackly resources on AI agents, RAG, LangChain, token tracking, model comparison, traces, and practical LLM observability.",
    url: "/resources",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Trackly Resources",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Resources | Trackly",
    description:
      "Free Trackly resources on AI agents, RAG, LangChain, token tracking, model comparison, traces, and practical LLM observability.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function ResourcesPage() {
  const chapters = getResourceChapters();
  const allArticles = getAllResourceArticles();
  const featured = [...allArticles]
    .filter((article) => article.featured)
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.publishedAt).getTime() -
        new Date(a.updatedAt ?? a.publishedAt).getTime(),
    )
    .slice(0, 3);
  const startHere =
    chapters.find((chapter) => chapter.slug === "ai-agents")?.articles[0] ??
    allArticles[0];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Trackly Resources",
    description:
      "Practical guides on AI agents, RAG, LangChain, token tracking, model comparison, tracing, and LLM cost visibility.",
    url: "https://tracklyai.in/resources",
    hasPart: chapters.map((chapter) => ({
      "@type": "CreativeWorkSeries",
      name: chapter.title,
      url: `https://tracklyai.in/resources/${chapter.slug}`,
      description: chapter.description,
      numberOfItems: chapter.articles.length,
    })),
    mainEntity: {
      "@type": "ItemList",
      itemListElement: featured.map((article, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://tracklyai.in${article.path}`,
        name: article.title,
      })),
    },
  };

  return (
    <ResourcesShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-14 px-4 sm:px-6 lg:px-8">
        <section className="max-w-4xl pt-2">
          <div className=" max-w-3xl">
            <ResourcesSearch
              articles={allArticles.map((article) => ({
                title: article.title,
                description: article.description,
                chapterTitle: article.chapterTitle,
                tags: article.tags,
                path: article.path,
              }))}
            />
          </div>
          <div className="max-w-3xl">
            <h1 className="mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Practical guides for shipping AI systems.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300 sm:text-lg">
              Trackly Resources is a structured library of practical guides on
              AI agents, RAG pipelines, LangChain, token tracking, model
              comparison, and trace-first debugging for real Python apps.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {startHere ? (
                <Link
                  href={startHere.path}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white hover:text-black"
                >
                  Start with {startHere.title}
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              ) : null}
              <Link
                href="/auth/login?screen_hint=signup"
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                Building agents? Track your LLM costs
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {chapters.map((chapter) => (
            <Link
              key={chapter.slug}
              href={`/resources/${chapter.slug}`}
              className="inset-shadow-xs inset-shadow-white/30 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md p-6 transition hover:-translate-y-1 hover:border-white/40 hover:bg-white/[0.06]"
            >
              <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <Image
                  src={getResourceChapterBannerImage(chapter)}
                  alt={`${chapter.title} thumbnail`}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/40">
                  Chapter {chapter.order}
                </p>
                <BookOpenIcon className="h-[18px] w-[18px] text-zinc-500" />
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                {chapter.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                {chapter.description}
              </p>
              <div className="mt-6 flex items-center justify-between text-sm text-zinc-500">
                <span>{chapter.articles.length} article(s)</span>
                <span className="inline-flex items-center gap-2 text-white">
                  Explore
                  <ArrowRightIcon className="h-[15px] w-[15px]" />
                </span>
              </div>
            </Link>
          ))}
        </section>

        {featured.length > 0 ? (
          <section className=" grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="inset-shadow-xs inset-shadow-white/30 rounded-xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/40">
                Featured reads
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                Start with practical guides, then go deeper.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400">
                These are the most useful hands-on reads if you want to move
                from rough LLM prototypes to observable, cost-aware production
                workflows.
              </p>
            </div>

            <div className="grid gap-4">
              {featured.map((article) => (
                <Link
                  key={article.path}
                  href={article.path}
                  className="rounded-xl border border-white/10 bg-black/20 p-5 transition hover:border-white/40 hover:bg-white/[0.06] backdrop-blur-md"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge
                      variant="outline"
                      className="rounded-xl border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-300"
                    >
                      {article.chapterTitle}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <ClockIcon className="h-[13px] w-[13px]" />
                      {article.readingTime} min read
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold text-white">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-zinc-400">
                    {article.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ResourcesShell>
  );
}
