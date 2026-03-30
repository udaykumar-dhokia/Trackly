import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import readingTime from "reading-time";

export type ResourceDifficulty = "beginner" | "intermediate" | "advanced";

type ResourceChapterMeta = {
  title: string;
  description: string;
  icon?: string;
  order: number;
  articles: string[];
};

export type ResourceArticle = {
  title: string;
  slug: string;
  description: string;
  chapter: string;
  chapterTitle: string;
  order: number;
  tags: string[];
  difficulty: ResourceDifficulty;
  publishedAt: string;
  updatedAt?: string;
  featured?: boolean;
  bannerImage?: string;
  readingTime: number;
  fileName: string;
  path: string;
  excerpt: string;
};

export type ResourceArticleContent = ResourceArticle & {
  content: string;
};

export type ResourceChapter = {
  slug: string;
  title: string;
  description: string;
  icon?: string;
  order: number;
  articles: ResourceArticle[];
};

const CONTENT_ROOT = path.join(process.cwd(), "content", "resources");

function readChapterMeta(chapter: string): ResourceChapterMeta {
  const metaPath = path.join(CONTENT_ROOT, chapter, "_meta.json");
  return JSON.parse(fs.readFileSync(metaPath, "utf8")) as ResourceChapterMeta;
}

function extractExcerpt(content: string, fallback: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return lines[0] ?? fallback;
}

function readArticle(
  chapter: string,
  articleFileName: string,
): ResourceArticleContent {
  const chapterMeta = readChapterMeta(chapter);
  const filePath = path.join(CONTENT_ROOT, chapter, `${articleFileName}.mdx`);
  const file = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(file);
  const minutes = Math.max(1, Math.ceil(readingTime(content).minutes));

  return {
    title: String(data.title),
    slug: String(data.slug),
    description: String(data.description),
    chapter: String(data.chapter ?? chapter),
    chapterTitle: String(data.chapterTitle ?? chapterMeta.title),
    order: Number(data.order),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    difficulty: (data.difficulty ?? "beginner") as ResourceDifficulty,
    publishedAt: String(data.publishedAt),
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
    featured: Boolean(data.featured),
    bannerImage: data.bannerImage ? String(data.bannerImage) : undefined,
    readingTime: minutes,
    fileName: articleFileName,
    path: `/resources/${chapter}/${String(data.slug)}`,
    excerpt: extractExcerpt(content, String(data.description)),
    content,
  };
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function escapeSvgText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapTitle(title: string, maxLineLength = 18, maxLines = 3) {
  const words = title.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLineLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.slice(0, maxLines);
}

function buildResourceBannerImage({
  seedKey,
  title,
  label,
  size = "large",
}: {
  seedKey: string;
  title: string;
  label: string;
  size?: "large" | "card";
}) {
  const palettes = [
    { start: "#312e81", end: "#1d4ed8", accent: "#f8fafc", glow: "#6366f1" },
    { start: "#0f172a", end: "#0f766e", accent: "#ecfeff", glow: "#14b8a6" },
    { start: "#3f1d12", end: "#7c2d12", accent: "#fff7ed", glow: "#fb923c" },
    { start: "#111827", end: "#4338ca", accent: "#eef2ff", glow: "#818cf8" },
    { start: "#1f2937", end: "#7c3aed", accent: "#faf5ff", glow: "#c084fc" },
    { start: "#172554", end: "#1e3a8a", accent: "#eff6ff", glow: "#60a5fa" },
  ];

  const seed = hashString(seedKey);
  const palette = palettes[seed % palettes.length];
  const isCard = size === "card";
  const lines = wrapTitle(title, isCard ? 14 : 18, isCard ? 2 : 3);
  const offsetA = 40 + (seed % 180);
  const offsetB = 460 + (seed % 220);
  const circleX = 860 - (seed % 180);
  const circleY = 150 + (seed % 120);
  const badge = escapeSvgText(label.toUpperCase());
  const titleX = isCard ? 92 : 72;
  const titleY = isCard ? 270 : 188;
  const titleGap = isCard ? 102 : 64;
  const titleFontSize = isCard ? 90 : 52;
  const badgeX = isCard ? 92 : 72;
  const badgeY = isCard ? 78 : 72;
  const badgeWidth = isCard ? 250 : 220;
  const badgeHeight = isCard ? 54 : 48;
  const badgeTextX = isCard ? 122 : 100;
  const badgeTextY = isCard ? 114 : 103;
  const badgeFontSize = isCard ? 20 : 18;
  const titleMarkup = lines
    .map(
      (line, index) =>
        `<text x="${titleX}" y="${titleY + index * titleGap}" fill="${palette.accent}" font-family="Inter, Arial, sans-serif" font-size="${titleFontSize}" font-weight="800">${escapeSvgText(line)}</text>`,
    )
    .join("");

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="700" viewBox="0 0 1600 700">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.start}" />
          <stop offset="100%" stop-color="${palette.end}" />
        </linearGradient>
        <linearGradient id="mesh" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02" />
        </linearGradient>
        <filter id="blur">
          <feGaussianBlur stdDeviation="56" />
        </filter>
      </defs>

      <rect width="1600" height="700" fill="url(#bg)" />
      <rect width="1600" height="700" fill="url(#mesh)" opacity="0.38" />

      <g stroke="rgba(255,255,255,0.12)" stroke-width="1">
        <path d="M0 ${offsetA} H1600" />
        <path d="M0 ${offsetA + 120} H1600" />
        <path d="M0 ${offsetA + 240} H1600" />
        <path d="M0 ${offsetA + 360} H1600" />
        <path d="M220 0 V700" />
        <path d="M480 0 V700" />
        <path d="M740 0 V700" />
        <path d="M1000 0 V700" />
        <path d="M1260 0 V700" />
      </g>

      <circle cx="${circleX}" cy="${circleY}" r="170" fill="${palette.glow}" opacity="0.28" filter="url(#blur)" />
      <circle cx="${offsetB}" cy="590" r="140" fill="#ffffff" opacity="0.10" filter="url(#blur)" />

      <rect x="${badgeX}" y="${badgeY}" rx="22" ry="22" width="${badgeWidth}" height="${badgeHeight}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.16)" />
      <text x="${badgeTextX}" y="${badgeTextY}" fill="${palette.accent}" font-family="Inter, Arial, sans-serif" font-size="${badgeFontSize}" font-weight="700" letter-spacing="4">${badge}</text>

      ${titleMarkup}

      <text x="${isCard ? 94 : 76}" y="615" fill="rgba(255,255,255,0.72)" font-family="Inter, Arial, sans-serif" font-size="${isCard ? 22 : 20}" font-weight="500">Trackly Resources</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getResourceBannerImage(
  article: Pick<
    ResourceArticle,
    "chapter" | "slug" | "title" | "chapterTitle" | "bannerImage"
  >,
) {
  if (article.bannerImage) {
    return article.bannerImage;
  }

  return buildResourceBannerImage({
    seedKey: `${article.chapter}:${article.slug}`,
    title: article.title,
    label: article.chapterTitle,
    size: "large",
  });
}

export function getResourceChapterBannerImage(
  chapter: Pick<ResourceChapter, "slug" | "title" | "order">,
) {
  return buildResourceBannerImage({
    seedKey: `chapter:${chapter.slug}`,
    title: chapter.title,
    label: `Chapter ${chapter.order}`,
    size: "card",
  });
}

function summarizeArticle(article: ResourceArticleContent): ResourceArticle {
  const { content, ...rest } = article;
  void content;
  return rest;
}

export function getResourceChapters(): ResourceChapter[] {
  const entries = fs
    .readdirSync(CONTENT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  return entries
    .map((chapter) => {
      const meta = readChapterMeta(chapter);
      const articles = meta.articles
        .map((articleFileName) => readArticle(chapter, articleFileName))
        .sort((a, b) => a.order - b.order)
        .map((article) => summarizeArticle(article));

      return {
        slug: chapter,
        title: meta.title,
        description: meta.description,
        icon: meta.icon,
        order: meta.order,
        articles,
      };
    })
    .sort((a, b) => a.order - b.order);
}

export function getResourceChapter(chapter: string) {
  return getResourceChapters().find((item) => item.slug === chapter);
}

export function getAllResourceArticles() {
  return getResourceChapters().flatMap((chapter) => chapter.articles);
}

export function getResourceArticle(chapter: string, slug: string) {
  const chapterData = getResourceChapter(chapter);
  if (!chapterData) {
    return undefined;
  }

  const articleSummary = chapterData.articles.find(
    (item) => item.slug === slug,
  );
  if (!articleSummary) {
    return undefined;
  }

  return readArticle(chapter, articleSummary.fileName);
}

export function getAdjacentResourceArticles(chapter: string, slug: string) {
  const chapterData = getResourceChapter(chapter);
  if (!chapterData) {
    return { previous: undefined, next: undefined };
  }

  const index = chapterData.articles.findIndex(
    (article) => article.slug === slug,
  );
  if (index === -1) {
    return { previous: undefined, next: undefined };
  }

  return {
    previous: chapterData.articles[index - 1],
    next: chapterData.articles[index + 1],
  };
}
