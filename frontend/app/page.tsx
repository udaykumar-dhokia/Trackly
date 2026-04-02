import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/custom/header";
import Hero from "@/components/custom/hero";
import QuickStart from "@/components/custom/quick-start";
import TraceFeature from "@/components/custom/trace-feature";
import Features from "@/components/custom/features";
import Pricing from "@/components/custom/pricing";
import HowItWorks from "@/components/custom/howItWorks";
import AboutContact from "@/components/custom/aboutAndContact";
import Footer from "@/components/custom/footer";
import Testimonials from "@/components/custom/testimonials";
import { absoluteUrl, DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";
import { getAllResourceArticles } from "@/lib/resources";

const homepageTitle = "Trackly | LLM Observability, Cost Tracking & Usage Analytics";
const homepageDescription =
  "Track LLM costs, token usage, latency, and model performance in one place. Trackly helps teams monitor OpenAI, Anthropic, Gemini, and other AI workloads with production-ready observability.";

export const metadata: Metadata = {
  title: homepageTitle,
  description: homepageDescription,
  keywords: [
    "LLM observability",
    "LLM cost tracking",
    "AI usage analytics",
    "OpenAI cost monitoring",
    "Anthropic usage tracking",
    "Gemini usage tracking",
    "token tracking dashboard",
    "AI latency monitoring",
    "LLM analytics platform",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: homepageTitle,
    description: homepageDescription,
    url: "/",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Trackly LLM observability dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: homepageTitle,
    description: homepageDescription,
    images: [DEFAULT_OG_IMAGE],
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/web/logo-96.png"),
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: homepageDescription,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: homepageDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Primary navigation",
    itemListElement: [
      {
        "@type": "SiteNavigationElement",
        position: 1,
        name: "Documentation",
        url: absoluteUrl("/docs"),
      },
      {
        "@type": "SiteNavigationElement",
        position: 2,
        name: "Resources",
        url: absoluteUrl("/resources"),
      },
      {
        "@type": "SiteNavigationElement",
        position: 3,
        name: "Changelog",
        url: absoluteUrl("/changelogs"),
      },
    ],
  },
];

const page = () => {
  const featuredGuides = getAllResourceArticles()
    .filter((article) => article.featured)
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.publishedAt).getTime() -
        new Date(a.updatedAt ?? a.publishedAt).getTime(),
    )
    .slice(0, 3);

  return (
    <div>
      {structuredData.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <Header />
      <Hero />
      <QuickStart />
      <section className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/45">
                Popular Guides
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">
                Learn the workflows teams actually use in Trackly
              </h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Practical articles on token tracking, model comparison, traces,
                agents, and production LLM cost visibility.
              </p>
            </div>
            <Link
              href="/resources"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-indigo-300"
            >
              Explore all resources
            </Link>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {featuredGuides.map((article) => (
              <Link
                key={article.path}
                href={article.path}
                className="rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:border-white/25 hover:bg-white/[0.04]"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/45">
                  {article.chapterTitle}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-white">
                  {article.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-zinc-400">
                  {article.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <TraceFeature />
      <Testimonials />
      <Features />
      <HowItWorks />
      <Pricing />
      <AboutContact />
      <Footer />
    </div>
  );
};

export default page;
