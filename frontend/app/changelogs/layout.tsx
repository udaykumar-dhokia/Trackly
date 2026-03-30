import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "Follow Trackly releases, product improvements, SDK updates, and infrastructure changes.",
  alternates: {
    canonical: "/changelogs",
  },
  openGraph: {
    title: "Changelog | Trackly",
    description:
      "Follow Trackly releases, product improvements, SDK updates, and infrastructure changes.",
    url: "/changelogs",
    type: "website",
    images: [
      {
        url: DEFAULT_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Trackly Changelog",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Changelog | Trackly",
    description:
      "Follow Trackly releases, product improvements, SDK updates, and infrastructure changes.",
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function ChangelogLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
