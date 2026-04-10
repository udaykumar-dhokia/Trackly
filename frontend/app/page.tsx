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
import PopularGuides from "@/components/custom/popular-guides";
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";
import { getAllResourceArticles } from "@/lib/resources";

const homepageTitle = "Trackly | The AI Decision Engine";
const homepageDescription =
  "Understand, debug, and optimize your AI systems. Trackly goes beyond logs to give you plain English insights, critical path detection, and auto-optimization suggestions for your AI agents and chains.";

export const metadata: Metadata = {
  title: homepageTitle,
  description: homepageDescription,
  keywords: [
    "AI system visualization",
    "trace visualization",
    "AI decision engine",
    "critical path detection",
    "run comparison",
    "AI cost optimization",
    "AI latency diagnostics",
    "LLM trace graph",
    "agent workflow visualization",
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
        alt: "Trackly visual intelligence dashboard",
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
    slogan: SITE_TAGLINE,
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
      <PopularGuides featuredGuides={featuredGuides} />
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
