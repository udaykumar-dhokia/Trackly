import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  JetBrains_Mono,
  Bricolage_Grotesque,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";
import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import StoreProvider from "@/lib/store/StoreProvider";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import { GoogleAnalytics } from "@next/third-parties/google";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const notoSans = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-mono",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: "Trackly | Track LLM Costs & Usage",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Monitor and optimize your LLM spending in real-time. Track costs, usage, and performance across all your AI models from one dashboard.",
  keywords: [
    "LLM",
    "AI costs",
    "usage tracking",
    "OpenAI",
    "GPT",
    "Claude",
    "Gemini",
    "API analytics",
    "token usage",
    "AI monitoring",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Trackly | Track LLM Costs & Usage",
    description:
      "Monitor and optimize your LLM spending in real-time. Track costs, usage, and performance across all your AI models.",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Trackly LLM Cost and Usage Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Trackly | Track LLM Costs & Usage",
    description:
      "Monitor and optimize your LLM spending in real-time. Track costs, usage, and performance across all your AI models.",
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: [
      { url: "/web/logo-32.png", sizes: "32x32", type: "image/png" },
      { url: "/web/logo-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/web/logo-96.png",
    shortcut: "/web/logo-32.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full dark",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        jetbrainsMono.variable,
        notoSans.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <Auth0Provider>
          <StoreProvider>
            <TooltipProvider>
              {children}
              <Analytics />
              <GoogleAnalytics
                gaId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!}
              />
              <Toaster position="bottom-right" theme="dark" />
            </TooltipProvider>
          </StoreProvider>
        </Auth0Provider>
      </body>
    </html>
  );
}
