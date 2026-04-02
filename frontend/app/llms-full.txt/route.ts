import { getAllResourceArticles, getResourceChapters } from "@/lib/resources";
import { SITE_URL } from "@/lib/site";

const chapters = getResourceChapters();
const articles = getAllResourceArticles().sort(
  (a, b) =>
    new Date(b.updatedAt ?? b.publishedAt).getTime() -
    new Date(a.updatedAt ?? a.publishedAt).getTime(),
);

const content = `# Trackly Full LLM Index

Base URL: ${SITE_URL}
Primary docs: ${SITE_URL}/docs
Primary resources hub: ${SITE_URL}/resources

## Product summary
Trackly is an LLM observability and cost tracking platform for Python teams. It records provider, model, prompt tokens, completion tokens, total tokens, estimated cost, latency, features, sessions, traces, and spans.

## Core pages
- Home: ${SITE_URL}
- Docs: ${SITE_URL}/docs
- Resources: ${SITE_URL}/resources
- Changelog: ${SITE_URL}/changelogs
- llms.txt: ${SITE_URL}/llms.txt

## Resource chapters
${chapters
  .map(
    (chapter) =>
      `- ${chapter.title}: ${SITE_URL}/resources/${chapter.slug} - ${chapter.description}`,
  )
  .join("\n")}

## Resource articles
${articles
  .map(
    (article) =>
      `- ${article.title}: ${SITE_URL}${article.path} - ${article.description}`,
  )
  .join("\n")}
`;

export function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
