import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Badge } from "@/components/ui/badge";
import ArticleCodeBlock from "@/components/custom/article-code-block";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ClockIcon,
} from "@/components/custom/resource-icons";
import ResourcesShell from "@/components/custom/resources-shell";
import {
  getAdjacentResourceArticles,
  getAllResourceArticles,
  getResourceArticle,
  getResourceBannerImage,
  getResourceChapter,
} from "@/lib/resources";
import { absoluteUrl } from "@/lib/site";

type ArticlePageProps = {
  params: Promise<{
    chapter: string;
    slug: string;
  }>;
};

export async function generateStaticParams() {
  return getAllResourceArticles().map((article) => ({
    chapter: article.chapter,
    slug: article.slug,
  }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { chapter, slug } = await params;
  const article = getResourceArticle(chapter, slug);

  if (!article) {
    return {
      title: "Resources",
    };
  }

  return {
    title: article.title,
    description: article.description,
    keywords: article.tags,
    authors: [{ name: "Trackly" }],
    alternates: {
      canonical: article.path,
    },
    openGraph: {
      title: `${article.title} | Trackly Resources`,
      description: article.description,
      url: article.path,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      section: article.chapterTitle,
      tags: article.tags,
      images: [
        {
          url: `${article.path}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: article.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${article.title} | Trackly Resources`,
      description: article.description,
      images: [`${article.path}/opengraph-image`],
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { chapter, slug } = await params;
  const article = getResourceArticle(chapter, slug);
  const chapterData = getResourceChapter(chapter);

  if (!article || !chapterData) {
    notFound();
  }

  const adjacent = getAdjacentResourceArticles(chapter, slug);
  const bannerImage = getResourceBannerImage(article);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    author: { "@type": "Organization", name: "Trackly" },
    publisher: {
      "@type": "Organization",
      name: "Trackly",
      url: absoluteUrl("/"),
    },
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    keywords: article.tags,
    image: absoluteUrl(`${article.path}/opengraph-image`),
    mainEntityOfPage: absoluteUrl(article.path),
  };

  return (
    <ResourcesShell>
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-28 lg:h-fit backdrop-blur-md">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
            <Link
              href={`/resources/${chapter}`}
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              <ArrowLeftIcon className="h-[14px] w-[14px]" />
              Back to {chapterData.title}
            </Link>

            <div className="mt-6 space-y-2">
              {chapterData.articles.map((chapterArticle) => {
                const active = chapterArticle.slug === article.slug;

                return (
                  <Link
                    key={chapterArticle.path}
                    href={chapterArticle.path}
                    className={`block rounded-xl px-4 py-3 text-sm transition ${
                      active
                        ? "border border-primary bg-primary text-white"
                        : "border border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {chapterArticle.title}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <article className="min-w-0">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          <div className="rounded-xl border border-white/10 bg-[#0c0d11] p-6 sm:p-8 lg:p-10">
            <div className="relative mb-8 aspect-[16/7] overflow-hidden rounded-xl border border-white/10 bg-black/20">
              <Image
                src={bannerImage}
                alt={`${article.title} banner`}
                fill
                className="object-cover"
                priority
                unoptimized={bannerImage.startsWith("data:image")}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0d11]/35 to-transparent" />
            </div>

            <nav className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
              <Link href="/resources" className="transition hover:text-white">
                Resources
              </Link>
              <span>/</span>
              <Link
                href={`/resources/${chapter}`}
                className="transition hover:text-white"
              >
                {chapterData.title}
              </Link>
              <span>/</span>
              <span className="text-zinc-300">{article.title}</span>
            </nav>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Badge
                variant="outline"
                className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-300"
              >
                {article.difficulty}
              </Badge>
              <span className="inline-flex items-center gap-1 text-sm text-zinc-500">
                <ClockIcon className="h-[14px] w-[14px]" />
                {article.readingTime} min read
              </span>
            </div>

            <h1 className="mt-5 max-w-4xl text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              {article.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300">
              {article.description}
            </p>

            <div className="resource-copy mt-10">
              <MDXRemote
                source={article.content}
                components={{
                  pre: ArticleCodeBlock,
                }}
              />
            </div>

            <div className="mt-10 rounded-xl border border-primary/20 bg-primary/8 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/90">
                Trackly
              </p>
              <h2 className="mt-3 text-2xl font-bold text-white">
                Building agents already?
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-300">
                Trackly helps you monitor provider usage, token costs, and
                project-level spend without adding heavy overhead to your app.
              </p>
              <Link
                href="/auth/login?screen_hint=signup"
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-primary hover:text-white"
              >
                Try Trackly
                <ArrowRightIcon className="h-[15px] w-[15px]" />
              </Link>
            </div>

            {adjacent.next ? (
              <div className="mt-10 flex justify-end">
                <Link
                  href={adjacent.next.path}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-primary"
                >
                  Next article: {adjacent.next.title}
                  <ArrowRightIcon className="h-[15px] w-[15px]" />
                </Link>
              </div>
            ) : null}
          </div>
        </article>
      </div>

      <style>{`
        .resource-copy {
          color: #d4d4d8;
          font-size: 0.98rem;
          line-height: 1.9;
        }
        .resource-copy > * + * {
          margin-top: 1.2rem;
        }
        .resource-copy h1,
        .resource-copy h2,
        .resource-copy h3 {
          color: #ffffff;
          font-weight: 700;
          line-height: 1.2;
          letter-spacing: -0.03em;
          margin-top: 2.2rem;
          margin-bottom: 0.8rem;
        }
        .resource-copy h1 {
          font-size: 2rem;
        }
        .resource-copy h2 {
          font-size: 1.55rem;
        }
        .resource-copy h3 {
          font-size: 1.2rem;
        }
        .resource-copy p,
        .resource-copy li {
          color: #d4d4d8;
        }
        .resource-copy ul,
        .resource-copy ol {
          padding-left: 1.35rem;
        }
        .resource-copy li + li {
          margin-top: 0.55rem;
        }
        .resource-copy strong {
          color: #ffffff;
          font-weight: 700;
        }
        .resource-copy code {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.65rem;
          padding: 0.15rem 0.45rem;
          color: #f4f4f5;
          font-size: 0.9em;
        }
        .resource-copy pre {
          overflow-x: auto;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 1rem;
          background: #09090b;
          padding: 1rem;
        }
        .resource-copy pre code {
          background: transparent;
          border: none;
          padding: 0;
        }
        .resource-copy a {
          color: #a5b4fc;
          text-decoration: underline;
          text-decoration-color: rgba(165,180,252,0.5);
        }
      `}</style>
    </ResourcesShell>
  );
}
