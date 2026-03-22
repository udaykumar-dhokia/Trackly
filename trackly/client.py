import os
import time
import requests
import atexit
import threading
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult


# Layer 1 — serialized["id"] (most reliable)
#   LangChain passes a serialized dict to on_llm_start that contains an "id"
#   list built from the LLM class's lc_namespace + class name, e.g.:
#     ChatGroq     → ["langchain_groq", "chat_models", "ChatGroq"]
#     ChatOpenAI   → ["langchain", "chat_models", "openai", "ChatOpenAI"]
#     ChatAnthropic→ ["langchain", "chat_models", "anthropic", "ChatAnthropic"]
#     ChatGoogleGenerativeAI → ["langchain_google_genai", ...]
#     OllamaChat   → ["langchain_ollama", ...]
#   Joining the id list into a single string and doing substring checks is fast
#   and works regardless of what model name the user passes.

# Layer 2 — model name substring (fallback)
#   For cases where serialized is missing or the namespace is unrecognised,
#   fall back to model-name heuristics. This catches direct API wrappers and
#   custom LLM classes that expose a recognisable model string.
#   Note: Groq CANNOT be detected this way — llama/mixtral/gemma model names
#   are shared across many providers (Together, Fireworks, Replicate, etc.).

_NAMESPACE_MAP: list[tuple[str, str]] = [
    ("langchain_groq",          "groq"),
    ("langchain_anthropic",     "anthropic"),
    ("langchain_openai",        "openai"),
    ("langchain_google_genai",  "google"),
    ("langchain_google_vertexai","google"),
    ("langchain_ollama",        "ollama"),
    ("langchain_mistralai",     "mistral"),
    ("langchain_cohere",        "cohere"),
    ("langchain_together",      "together"),
    ("langchain_fireworks",     "fireworks"),
    ("langchain_aws",           "aws-bedrock"),
    ("openai",                  "openai"),
    ("anthropic",               "anthropic"),
    ("google",                  "google"),
]

_MODEL_NAME_MAP: list[tuple[str, str]] = [
    ("claude",   "anthropic"),
    ("gemini",   "google"),
    ("command",  "cohere"),
    ("mistral",  "mistral"),
    ("mixtral",  "mistral"),
    ("gpt-",     "openai"),
    ("o1-",      "openai"),
    ("o3-",      "openai"),
    ("o4-",      "openai"),
    # NOTE: llama / gemma / qwen / deepseek are intentionally omitted here
    # because they are hosted on too many platforms to guess from name alone.
]


def _detect_provider(serialized: Dict[str, Any], model: str) -> str:
    """Return the canonical provider string using the two-layer strategy."""
    lc_id = serialized.get("id", [])
    if lc_id:
        joined = " ".join(str(part).lower() for part in lc_id)
        for needle, provider in _NAMESPACE_MAP:
            if needle in joined:
                return provider

    model_lower = model.lower()
    for needle, provider in _MODEL_NAME_MAP:
        if needle in model_lower:
            return provider

    return "unknown"


class TracklyCallback(BaseCallbackHandler):
    def __init__(
        self,
        trackly_instance,
        feature: Optional[str] = None,
        environment: Optional[str] = None,
    ):
        self.trackly = trackly_instance
        self.feature = feature
        self.environment = environment
        self._start_times: Dict[Any, float] = {}
        self._serialized: Dict[Any, Dict] = {}
        self._model_names: Dict[Any, str] = {}

    def on_llm_start(
        self,
        serialized: Dict[str, Any],
        prompts: List[str],
        **kwargs: Any,
    ):
        run_id = kwargs.get("run_id")
        if not run_id:
            return

        self._start_times[run_id] = time.time()
        self._serialized[run_id] = serialized

        invocation_params = kwargs.get("invocation_params", {})
        model = (
            invocation_params.get("model_name")
            or invocation_params.get("model")
            or invocation_params.get("model_id")
        )
        if model:
            self._model_names[run_id] = model

    def on_chat_model_start(
        self,
        serialized: Dict[str, Any],
        messages: List[List[Any]],
        **kwargs: Any,
    ):
        self.on_llm_start(serialized, [], **kwargs)

    def on_llm_end(self, response: LLMResult, **kwargs: Any):
        run_id = kwargs.get("run_id")
        start = self._start_times.pop(run_id, None)
        serialized = self._serialized.pop(run_id, {})
        latency_ms = int((time.time() - start) * 1000) if start else None

        model = self._model_names.pop(run_id, None)
        llm_output = response.llm_output or {}

        if not model:
            model = llm_output.get("model_name") or llm_output.get("model")

        if not model:
            try:
                gen = response.generations[0][0]
                meta = getattr(getattr(gen, "message", None), "response_metadata", None) or {}
                model = meta.get("model_name") or meta.get("model")
            except (IndexError, AttributeError):
                pass
                
        if not model:
            model = "unknown"

        provider = _detect_provider(serialized, model)

        prompt_tokens = None
        completion_tokens = None
        total_tokens = None

        if "token_usage" in llm_output:
            u = llm_output["token_usage"]
            prompt_tokens     = u.get("prompt_tokens")
            completion_tokens = u.get("completion_tokens")
            total_tokens      = u.get("total_tokens")

        elif "usage" in llm_output:
            u = llm_output["usage"]
            prompt_tokens     = u.get("input_tokens")
            completion_tokens = u.get("output_tokens")

        if prompt_tokens is None:
            try:
                gen = response.generations[0][0]
                usage_meta = getattr(
                    getattr(gen, "message", None), "usage_metadata", None
                )
                if usage_meta:
                    prompt_tokens     = usage_meta.get("input_tokens")
                    completion_tokens = usage_meta.get("output_tokens")
                    total_tokens      = usage_meta.get("total_tokens")
            except (IndexError, AttributeError):
                pass

        if total_tokens is None and (
            prompt_tokens is not None or completion_tokens is not None
        ):
            total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)

        finish_reason = None
        try:
            gen = response.generations[0][0]
            info = getattr(gen, "generation_info", None) or {}
            finish_reason = (
                info.get("finish_reason")
                or info.get("stop_reason")
                or info.get("finishReason")
            )
        except (IndexError, AttributeError):
            pass

        event = {
            "provider":          provider,
            "model":             model,
            "prompt_tokens":     prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens":      total_tokens,
            "latency_ms":        latency_ms,
            "finish_reason":     finish_reason,
            "feature":           self.feature,
            "environment":       self.environment,
            "timestamp":         datetime.now(timezone.utc).isoformat(),
        }

        self.trackly._enqueue(event)

    def on_llm_error(self, error: BaseException, **kwargs: Any):
        """Clean up run state on failure — don't log a cost event."""
        run_id = kwargs.get("run_id")
        self._start_times.pop(run_id, None)
        self._serialized.pop(run_id, None)
        self._model_names.pop(run_id, None)


class Trackly:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        debug: bool = False,
    ):
        self.api_key = api_key or os.getenv("TRACKLY_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Trackly API key is required. "
                "Pass api_key=... or set TRACKLY_API_KEY."
            )

        url = base_url or os.getenv("TRACKLY_BASE_URL", "http://localhost:8000/v1")
        self.base_url = url.rstrip("/")

        self.debug = debug or os.getenv("TRACKLY_DEBUG", "").strip() == "1"

        self._queue: list = []
        self._lock = threading.Lock()

        self._stop_event = threading.Event()
        self._thread = threading.Thread(
            target=self._worker, daemon=True, name="trackly-flusher"
        )
        self._thread.start()
        atexit.register(self.shutdown)

    def callback(
        self,
        feature: Optional[str] = None,
        environment: Optional[str] = None,
    ) -> TracklyCallback:
        """Return a LangChain callback handler for this Trackly instance."""
        return TracklyCallback(self, feature=feature, environment=environment)

    def _enqueue(self, event: Dict[str, Any]):
        with self._lock:
            self._queue.append(event)
        if self.debug:
            print(f"[Trackly] enqueued: provider={event['provider']} "
                  f"model={event['model']} tokens={event.get('total_tokens')}")

    def _worker(self):
        while not self._stop_event.is_set():
            self._stop_event.wait(timeout=2.0)
            self._flush()

    def _flush(self):
        with self._lock:
            if not self._queue:
                return
            batch = self._queue[:]
            self._queue.clear()

        endpoint = self.base_url
        if not endpoint.endswith("/events"):
            endpoint = f"{endpoint}/events"

        for attempt in range(3):
            try:
                res = requests.post(
                    endpoint,
                    json={"events": batch},
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5.0,
                )
                if self.debug:
                    print(f"[Trackly] sent {len(batch)} events → HTTP {res.status_code}")
                return
            except Exception as exc:
                if self.debug:
                    print(f"[Trackly] send failed (attempt {attempt + 1}/3): {exc}")
                if attempt < 2:
                    time.sleep(1.0)

        if self.debug:
            print(f"[Trackly] dropped {len(batch)} events after 3 failed attempts")

    def shutdown(self, timeout: float = 5.0):
        """Flush remaining events and stop the background thread."""
        if self._stop_event.is_set():
            return
        self._stop_event.set()
        if self.debug:
            print("[Trackly] shutting down, flushing...")
        self._flush()
        self._thread.join(timeout=timeout)