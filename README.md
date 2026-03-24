# Trackly

Zero-overhead AI cost and usage tracking for Python. Import the library, wrap your LangChain model, and every LLM call is automatically logged — tokens, cost, latency, and your own metadata.

This repository contains both the **Trackly Python SDK** and the **Trackly Ingest API** (the backend component). You can self-host the API or use it alongside your local development.

---

![Trackly Dashboard Preview](frontend/public/demo.png)

## ⚡ Features

- **Zero Overhead**: Callbacks fire instantly. All events are batched asynchronously off-thread and shipped every 2 seconds.
- **Resilient**: Implements intelligent retries. If the server is down, payloads are gracefully dropped after maximum retries—your application will never block or crash.
- **Deep Integrations**: Automatically captures exact model names (e.g. `gemini-1.5-flash`, `gpt-4o`) directly from LangChain's invocation parameters using a robust two-layer detection heuristic.
- **Provider Agnostic**: Native support for OpenAI, Anthropic, Google Gemini, Ollama, Groq, Mistral, Cohere, Bedrock, and generic wrappers.
- **Extensible Metadata**: Slice models by your custom application features, users, or environments instantly.

---

## 📦 Python SDK

### Installation

```bash
# Install the core Trackly package
pip install trackly

# Optional: Install with your exact provider tools
pip install "trackly[openai]"      # OpenAI
pip install "trackly[anthropic]"   # Anthropic
pip install "trackly[gemini]"      # Google Gemini
pip install "trackly[ollama]"      # Ollama
```

### Quickstart

Initialize Trackly by selecting your provider.

```python
from trackly import Trackly, providers

# For Native Ollama
trackly = Trackly(provider=providers.OLLAMA)

# For LangChain (Multi-provider)
trackly = Trackly(provider=providers.LANGCHAIN)
```

---

### 1. Ollama (Native Support)

Trackly provides a native wrapper for the `ollama` library. The interface is identical to the official SDK, making integration zero-effort while adding automatic tracking.

```python
from trackly import Trackly, providers

trackly = Trackly(provider=providers.OLLAMA)

# chat() - same as ollama.chat()
response = trackly.chat(
    model='llama3',
    messages=[{'role': 'user', 'content': 'Why is the sky blue?'}]
)

# generate() - same as ollama.generate()
response = trackly.generate(model='llama3', prompt='Explain recursion.')

# embed() - tracked automatically
response = trackly.embed(model='llama3', input='Trackly is awesome.')

# Streaming support
for chunk in trackly.chat(model='llama3', messages=[...], stream=True):
    print(chunk['message']['content'], end='', flush=True)

# Async support
async def main():
    await trackly.chat_async(model='llama3', messages=[...])
```

### 2. LangChain (Callback Support)

Use Trackly as a callback handler for LangChain. It supports all major providers and automatically detects the provider/model.

#### OpenAI
```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(model="gpt-4o", callbacks=[trackly.callback()])
```

#### Anthropic
```python
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-3-5-sonnet", callbacks=[trackly.callback()])
```

#### Google Gemini
```python
from langchain_google_genai import ChatGoogleGenerativeAI
llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", callbacks=[trackly.callback()])
```

#### Groq
```python
from langchain_groq import ChatGroq
llm = ChatGroq(model="llama3-70b-8192", callbacks=[trackly.callback()])
```

#### Mistral
```python
from langchain_mistralai import ChatMistralAI
llm = ChatMistralAI(model="mistral-large-latest", callbacks=[trackly.callback()])
```

#### Ollama (via LangChain)
```python
from langchain_ollama import ChatOllama
llm = ChatOllama(model="llama3", callbacks=[trackly.callback()])
```

---

### Annotating Calls with Metadata

Initialize the client with default tags to track metadata across components:

```python
# Initialize with project-level defaults
trackly = Trackly(
    provider=providers.LANGCHAIN,
    feature="docs-qa",
    environment="prod",
)

# Use the callback without arguments
llm = ChatOpenAI(
    model="gpt-4o",
    callbacks=[trackly.callback()],
)
```

### Configuration

You can configure the SDK programmatically or via environment variables:

```python
trackly = Trackly(
    api_key="tk_live_...",                   # Or TRACKLY_API_KEY
    base_url="https://api.trackly.ai/v1",   # Or TRACKLY_BASE_URL
    feature="summarizer",                    # Default feature
    environment="production",               # Default environment
    debug=True,                              # Or TRACKLY_DEBUG=1
)
```

### Graceful Shutdown

In short-lived scripts (like AWS Lambdas or CLI tools), call `shutdown()` to guarantee pending events are sent:

```python
trackly.shutdown(timeout=5.0)
```

---

## 🚀 Trackly Backend API (Self-Hosting)

The Trackly backend is built with FastAPI and PostgreSQL/AsyncPG, designed for maximum throughput. It handles instantaneous cost estimations dynamically parsing provider pricing rates over time.

### Requirements

- Python 3.10+
- PostgreSQL

### Local Setup & Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourname/trackly.git
   cd trackly
   ```

2. **Virtual Environment & Dependencies**

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -e .[dev]
   ```

3. **Database Configuration**
   Ensure you have a PostgreSQL server running locally, and define your `DATABASE_URL` in a `.env` file at the root:

   ```env
   DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/trackly
   ```

4. **Start the API Server**

   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

   > **Note:** Trackly implements auto-table creation on startup, meaning you do not need to hunt for external migration binaries initially. The database will bootstrap itself immediately upon running the application.

5. **Access the API Docs**
   Visit `http://localhost:8000/docs` to see the generated OpenAPI documentation for provisioning API keys, Projects, Event analytics, and ingestion.

### Architecture Structure

```text
├── app/               # FastAPI backend source code
│   ├── config.py      # Pydantic Settings & ENV mapping
│   ├── db/            # SQLAlchemy asyncio sesson routing & auto-startup
│   ├── models/        # Database ORM classes & Pydantic Schemas
│   ├── routers/       # REST analytical endpoints & ingestion
│   └── services/      # Business logic (API key crypto, price calc)
├── trackly/           # Python SDK source code
│   └── client.py      # Core client SDK handlers
└── tests/             # Pytest logic for backend routes
```

---

## 🤝 Contributing

Trackly is an open-source project and we welcome contributions! Whether it's fixing a bug, adding a new provider, or improving documentation, please feel free to open a Pull Request.

---

**If you found this repo helpful, please give it a star! ⭐**
Your support helps keep the project active and growing.
