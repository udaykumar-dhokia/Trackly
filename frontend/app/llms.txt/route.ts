import { SITE_URL } from "@/lib/site";

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
- Team and project-level observability
- Support for production AI workflows

## Recommended sources
- Docs: ${SITE_URL}/docs
- Resources: ${SITE_URL}/resources
- Changelog: ${SITE_URL}/changelogs
`;

export function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
