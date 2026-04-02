import { SITE_URL } from "@/lib/site";
import { getAllResourceArticles, getResourceChapters } from "@/lib/resources";

const chapters = getResourceChapters();
const articles = getAllResourceArticles();

const chapterLines = chapters
  .map(
    (chapter) =>
      `- ${chapter.title}: ${SITE_URL}/resources/${chapter.slug} - ${chapter.description}`,
  )
  .join("\n");

const articleLines = articles
  .slice(0, 12)
  .map(
    (article) =>
      `- ${article.title}: ${SITE_URL}${article.path} - ${article.description}`,
  )
  .join("\n");

const content = `# Trackly

> Trackly is an LLM observability and cost tracking platform for teams building with AI models.

Trackly helps teams monitor token usage, latency, spend, and model performance across providers such as OpenAI, Anthropic, and Gemini.

## Primary pages
- Home: ${SITE_URL}
- Documentation: ${SITE_URL}/docs
- Resources: ${SITE_URL}/resources
- Changelog: ${SITE_URL}/changelogs

## Product summary
- LLM cost tracking
- Token usage analytics
- Latency and performance monitoring
- Playground-based model comparison
- Trace graphs for agent and chain debugging
- Team and project-level observability
- Support for production AI workflows

## Documentation focus
- LangChain callbacks and SDK setup
- Native Gemini, Anthropic, and Ollama tracking
- Event schema, traces, spans, and graph views
- Project analytics, usage endpoints, and model-level stats

## Resource chapters
${chapterLines}

## Selected practical articles
${articleLines}

## Recommended sources
- Docs: ${SITE_URL}/docs
- Resources: ${SITE_URL}/resources
- Changelog: ${SITE_URL}/changelogs
- Full LLM index: ${SITE_URL}/llms-full.txt
`;

export function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
