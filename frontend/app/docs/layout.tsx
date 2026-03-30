import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs",
  description:
    "Trackly documentation for SDK installation, LangChain callbacks, native provider wrappers, and backend APIs.",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    title: "Docs | Trackly",
    description:
      "Trackly documentation for SDK installation, LangChain callbacks, native provider wrappers, and backend APIs.",
    url: "/docs",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Trackly Docs",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Docs | Trackly",
    description:
      "Trackly documentation for SDK installation, LangChain callbacks, native provider wrappers, and backend APIs.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function DocsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
