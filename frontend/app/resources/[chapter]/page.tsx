import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeftIcon,
  ClockIcon,
} from "@/components/custom/resource-icons";
import ResourcesShell from "@/components/custom/resources-shell";
import {
  getResourceChapter,
  getResourceChapters,
} from "@/lib/resources";
import { absoluteUrl } from "@/lib/site";

type ChapterPageProps = {
  params: Promise<{
    chapter: string;
  }>;
};

export async function generateStaticParams() {
  return getResourceChapters().map((chapter) => ({
    chapter: chapter.slug,
  }));
}

export async function generateMetadata({
  params,
}: ChapterPageProps): Promise<Metadata> {
  const { chapter } = await params;
  const chapterData = getResourceChapter(chapter);

  if (!chapterData) {
    return {
      title: "Resources",
    };
  }

  return {
    title: chapterData.title,
    description: chapterData.description,
    keywords: [
      chapterData.title,
      ...chapterData.articles.flatMap((article) => article.tags).slice(0, 12),
    ],
    alternates: {
      canonical: `/resources/${chapterData.slug}`,
    },
    openGraph: {
      title: `${chapterData.title} | Trackly Resources`,
      description: chapterData.description,
      url: `/resources/${chapterData.slug}`,
      type: "website",
      images: [
        {
          url: `/resources/${chapterData.slug}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${chapterData.title} chapter`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${chapterData.title} | Trackly Resources`,
      description: chapterData.description,
      images: [`/resources/${chapterData.slug}/opengraph-image`],
    },
  };
}

export default async function ChapterPage({ params }: ChapterPageProps) {
  const { chapter } = await params;
  const chapterData = getResourceChapter(chapter);

  if (!chapterData) {
    notFound();
  }

  return (
    <ResourcesShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: chapterData.title,
            description: chapterData.description,
            url: absoluteUrl(`/resources/${chapterData.slug}`),
            breadcrumb: {
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Resources",
                  item: absoluteUrl("/resources"),
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: chapterData.title,
                  item: absoluteUrl(`/resources/${chapterData.slug}`),
                },
              ],
            },
            mainEntity: {
              "@type": "ItemList",
              itemListElement: chapterData.articles.map((article, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: article.title,
                url: absoluteUrl(article.path),
              })),
            },
          }),
        }}
      />
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:px-8">
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
            >
              <ArrowLeftIcon className="h-[14px] w-[14px]" />
              Back to resources
            </Link>
            <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-white/90">
              Chapter {chapterData.order}
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">
              {chapterData.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              {chapterData.description}
            </p>

            <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">
                Included now
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {chapterData.articles.length} article(s)
              </p>
            </div>
          </div>
        </aside>

        <section className="space-y-5">
          {chapterData.articles.map((article, index) => (
            <Link
              key={article.path}
              href={article.path}
              className="block rounded-xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/40 hover:bg-white/[0.06] backdrop-blur-md"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge
                        variant="outline"
                        className="rounded-full border-white/10 bg-white/5 px-2 py- text-[10px] uppercase tracking-[0.22em] text-zinc-300"
                      >
                        {article.difficulty}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                        <ClockIcon className="h-[13px] w-[13px]" />
                        {article.readingTime} min read
                      </span>
                    </div>
                    <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                      {article.title}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-zinc-400">
                      {article.description}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </ResourcesShell>
  );
}
