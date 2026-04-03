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

> Trackly is a premium LLM observability and cost tracking platform for AI teams.

Trackly helps teams monitor token usage, latency, spend, and model performance across all major providers with zero-configuration overhead.

## Primary Pages
- Home: ${SITE_URL}
- Documentation: ${SITE_URL}/docs
- Resources: ${SITE_URL}/resources
- Changelog: ${SITE_URL}/changelogs
- Pricing: ${SITE_URL}/#pricing

## Core Features
### 1. Observability & Tracing
- **Zero-config provider detection**: Automatic resolution from LangChain namespaces.
- **Trace Graphs**: Visual debugging for nested agents, chains, and complex LLM workflows.
- **Latency Monitoring**: P50 and P95 latency tracking per model and feature.
- **Per-user Attribution**: Track exactly which users are driving costs.

### 2. Cost Management
- **Feature-level Attribution**: Slice usage by functional area (e.g., chat, RAG, summary).
- **Live Model Pricing**: Ingest-time cost computation ensures accuracy even as provider rates change.
- **Budget Alerts**: Real-time notifications for budget thresholds and usage spikes.
- **Multi-project visibility**: Manage multiple environments (dev, staging, prod) in one place.

## Supported Providers
- OpenAI (GPT-4o, GPT-4-turbo)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus/Haiku)
- Google Gemini (1.5 Pro, 1.5 Flash)
- Groq (Llama 3.1, 3.2, 3.3)
- Ollama (Local LLM tracking)
- Mistral, Together AI, Fireworks, AWS Bedrock, Cohere

## Pricing Plans
- **Starter ($0/mo)**: 1,000,000 tokens, 3 projects, 7-day retention.
- **Pro ($29/mo)**: 5,000,000 tokens, unlimited projects, 30-day retention, team collaboration.
- **Scale ($99/mo)**: 10,000,000 tokens, 90-day retention, custom feature tags, priority support.

## Documentation Index
- Installing the Trackly SDK: ${SITE_URL}/docs#installation
- Using LangChain Callbacks: ${SITE_URL}/docs#callbacks
- Native Gemini/Anthropic Wrappers: ${SITE_URL}/docs#native-sdks
- Tracing and Agent Debugging: ${SITE_URL}/docs#tracing
- Technical Ingest API Specs: ${SITE_URL}/docs#backend-api

## Resource Chapters
${chapterLines}

## Full LLM Index
Accessible at: ${SITE_URL}/llms-full.txt
`;

export function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
