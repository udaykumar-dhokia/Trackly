# Trackly

The AI Decision Engine for improving production AI systems. Find what's wrong with your AI — and fix it.

Zero-overhead intelligence for Python. Import the library, wrap your model, and Trackly automatically surfaces plain-English insights, detects critical paths, and suggests cost optimizations.

---

![Trackly visual intelligence dashboard](frontend/public/graph.png)

## ⚡ Features

- **Auto Insights Engine**: Automatically surface plain-English findings from every run. Detect cost spikes, retry storms, latency bottlenecks, and tool failure rates without manual dashboard reading.
- **Critical Path Detection**: Automatically highlight the slowest, most expensive, and failure steps in every agent run. Visually tagged as the 🔥 Critical Path.
- **Cost Intelligence & Optimization**: Beyond total cost tracking. Per-feature attribution, "wasted token" detection, and model efficiency suggestions (e.g., "Switching to GPT-4o-mini saves 68%").
- **Run Comparison**: Side-by-side comparison of cost, latency, steps, and output diffs. Perfect for prompt testing, model switching, and regression debugging.
- **"What-If" Analysis**: Real-time cost simulation for model swaps. Project how switching LLMs affects your session-level costs before making the change.
- **Interactive Trace Graph**: Visualize complex multi-model AI pipelines with a high-performance 2D force-directed graph.

---

## 📦 Python SDK

### Installation

```bash
# Install the core Trackly package
pip install trackly

# Or install with your exact LangChain provider tools
pip install "trackly[openai]"      # OpenAI / Azure OpenAI
pip install "trackly[anthropic]"   # Anthropic Claude
pip install "trackly[gemini]"      # Google Gemini
pip install "trackly[all]"         # All of the above
```

### Quickstart

```python
from trackly import Trackly
from langchain_openai import ChatOpenAI

# 1. Initialize the client (Reads TRACKLY_API_KEY from environment)
trackly = Trackly(api_key="tk_live_...")

# 2. Attach the callback to your existing LLM
llm = ChatOpenAI(
    model="gpt-4o",
    callbacks=[trackly.callback(feature="chat")],
)

# 3. Use your LLM as normal
response = llm.invoke("Summarise the following contract...")
```

Every call now automatically logs to your Trackly dashboard.

### Native Provider Wrappers

If you prefer using the native SDKs instead of LangChain, Trackly provides high-performance wrappers that capture the same rich metadata.

#### Google Gemini (Native SDK)

Trackly supports the official `google-genai` SDK.

```python
from trackly import Trackly

# Initialize for Gemini (Reads GEMINI_API_KEY from environment)
trackly = Trackly(provider="gemini")

# Use the .models wrapper
response = trackly.models.generate_content(
    model="gemini-1.5-flash",
    contents="Explain quantum computing in one sentence."
)
print(response.text)
```

#### Anthropic (Native SDK)

Trackly supports the official `anthropic` messages API.

```python
from trackly import Trackly

# Initialize for Anthropic (Reads ANTHROPIC_API_KEY from environment)
trackly = Trackly(provider="anthropic")

# Use the .messages wrapper
response = trackly.messages.create(
    model="claude-3-5-sonnet-latest",
    max_tokens=1024,
    messages=[
        {"role": "user", "content": "Hello, Claude"}
    ]
)
print(response.content[0].text)
```

#### Gemini Batch API

Trackly automatically tracks batch job creation and status.

```python
# Create a batch job (Trackly logs 'create' event)
job = trackly.batches.create(
    model="gemini-1.5-flash",
    src="gs://my-bucket/input.json",
    config={"dest": "gs://my-bucket/output/"}
)

# Get job status (Trackly logs 'status_check' on success)
status = trackly.batches.get(name=job.name)
```

#### Ollama (Local LLMs)

Trackly provides a first-class wrapper for the official `ollama` Python
library, including sync calls, async calls, streaming, embeddings, and local
model utility helpers.

```python
from trackly import Trackly

trackly = Trackly(provider="ollama")

# Works just like the official ollama.chat
response = trackly.chat(
    model="llama3",
    messages=[{"role": "user", "content": "Why is the sky blue?"}]
)

# Async wrappers are available too
# await trackly.chat_async(...)
# await trackly.generate_async(...)
# await trackly.embed_async(...)

# Local model utilities are exposed directly
# trackly.list()
# trackly.show("llama3")
# trackly.pull("llama3")
```

### Annotating Calls with Metadata

Register a callback with default tags to track metadata across components easily:

```python
# All calls from this model instance share these defaults
llm = ChatOpenAI(
    model="gpt-4o",
    callbacks=[trackly.callback(
        feature="docs-qa",
        environment="prod",
    )],
)
```

### Configuration

You can configure the SDK programmatically or via environment variables:

```python
trackly = Trackly(
    api_key="tk_live_...",                   # Or TRACKLY_API_KEY (Trackly Backend)
    gemini_api_key="sk-...",                 # Or GEMINI_API_KEY (Google Gemini)
    base_url="https://api.trackly.ai/v1",    # Or TRACKLY_BASE_URL
    debug=True,                              # Or TRACKLY_DEBUG=1
)
```

### Graceful Shutdown

In long-running servers, the background thread and `atexit` handler manage flush events automatically. In short-lived scripts (like AWS Lambdas or testing), call `shutdown()` to guarantee pending queues execute before stopping:

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

## 📬 Questions & Support

Have questions, found a bug, or need help with a custom integration? Drop an email to **[support@tracklyai.in](mailto:support@tracklyai.in)**.

---

**If you found this repo helpful, please give it a star! ⭐**
Your support helps keep the project active and growing.
