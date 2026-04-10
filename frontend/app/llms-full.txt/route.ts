import { getAllResourceArticles, getResourceChapters } from "@/lib/resources";
import { SITE_URL } from "@/lib/site";

const chapters = getResourceChapters();
const articles = getAllResourceArticles().sort(
  (a, b) =>
    new Date(b.updatedAt ?? b.publishedAt).getTime() -
    new Date(a.updatedAt ?? a.publishedAt).getTime(),
);

const content = `# Trackly Full LLM Index

> This is the comprehensive resource for LLMs to understand the Trackly platform, its features, and documentation.

Base URL: ${SITE_URL}
Primary docs: ${SITE_URL}/docs
Primary resources hub: ${SITE_URL}/resources

## 🚀 Product Summary
Trackly is the AI Decision Engine for improving production AI systems. Trackly helps teams find what's wrong with their AI — and fix it. Automatically surface plain-English insights, detect critical paths, and optimize costs for your AI agents and chains.

## 🛠️ Core Features
### 1. AI Decision Engine
- **Auto Insights Engine**: Automatically surfaces plain-English findings from every run.
- **Critical Path Detection**: Highlight the slowest, most expensive, and failure steps automatically.
- **Run Comparison**: Side-by-side comparison of cost, latency, steps, and output diffs.
- **"What-If" Analysis**: Real-time cost simulation for model swaps.

### 2. Cost Intelligence & Optimization
- **Cost Intelligence**: Get model efficiency suggestions (e.g., switching to faster/cheaper models).
- **Feature-level Attribution**: Slice usage by functional area (e.g., chat, RAG, summary).
- **Live Model Pricing**: Ingest-time cost computation ensures accuracy even as provider rates change.
- **Smart Alerts**: Interpreted real-time notifications for budget thresholds and usage spikes.

## 🏗️ Supported Providers
- OpenAI (GPT-4o, GPT-4-turbo)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus/Haiku)
- Google Gemini (1.5 Pro, 1.5 Flash)
- Groq (Llama 3.1, 3.2, 3.3)
- Ollama (Local LLM tracking)
- Mistral, Together AI, Fireworks, AWS Bedrock, Cohere

## 💰 Pricing Plans
- **Starter ($0/mo)**: 1,000,000 tokens, 3 projects, 7-day retention.
- **Pro ($29/mo)**: 5,000,000 tokens, unlimited projects, 30-day retention, team collaboration.
- **Scale ($99/mo)**: 10,000,000 tokens, 90-day retention, custom feature tags, priority support.

## 📚 Resource Chapters
${chapters
  .map(
    (chapter) =>
      `- ${chapter.title}: ${SITE_URL}/resources/${chapter.slug} - ${chapter.description}`,
  )
  .join("\n")}

## 📝 All Resource Articles
${articles
  .map(
    (article) =>
      `- ${article.title}: ${SITE_URL}${article.path} - ${article.description}`,
  )
  .join("\n")}

## 📖 Documentation Focus
- Installing the Trackly SDK: ${SITE_URL}/docs#installation
- Using LangChain Callbacks: ${SITE_URL}/docs#callbacks
- Native Gemini/Anthropic Wrappers: ${SITE_URL}/docs#native-sdks
- Tracing and Agent Debugging: ${SITE_URL}/docs#tracing
- Technical Ingest API Specs: ${SITE_URL}/docs#backend-api

## 📍 Core Pages
- Home: ${SITE_URL}
- Docs: ${SITE_URL}/docs
- Resources: ${SITE_URL}/resources
- Changelog: ${SITE_URL}/changelogs
- llms.txt: ${SITE_URL}/llms.txt
`;

export function GET() {
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
