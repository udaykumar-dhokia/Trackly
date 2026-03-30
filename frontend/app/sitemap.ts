import type { MetadataRoute } from "next";
import { getAllResourceArticles, getResourceChapters } from "@/lib/resources";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/resources`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/docs`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/changelogs`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    ...getResourceChapters().map((chapter) => ({
      url: `${SITE_URL}/resources/${chapter.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
    ...getAllResourceArticles().map((article) => ({
      url: `${SITE_URL}${article.path}`,
      lastModified: new Date(article.updatedAt ?? article.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
