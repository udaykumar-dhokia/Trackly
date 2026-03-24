import os
import time
import requests
import atexit
import threading
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

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


class _TracklyWorker:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        debug: bool = False,
        max_queue_size: int = 5000,
    ):
        self.api_key = api_key or os.getenv("TRACKLY_API_KEY")
        if not self.api_key:
            raise ValueError(
                "Trackly API key is required. "
                "Pass api_key=... or set TRACKLY_API_KEY."
            )

        url = base_url or os.getenv("TRACKLY_BASE_URL", "https://trackly-backend-fxob.onrender.com/v1")
        self.base_url = url.rstrip("/")

        self.debug = debug or os.getenv("TRACKLY_DEBUG", "").strip() == "1"

        self._queue: list = []
        self._max_queue_size = max_queue_size
        self._lock = threading.Lock()

        self._stop_event = threading.Event()
        self._thread = threading.Thread(
            target=self._worker, daemon=True, name="trackly-flusher"
        )
        self._thread.start()
        atexit.register(self.shutdown)

    def _enqueue(self, event: Dict[str, Any]):
        with self._lock:
            if len(self._queue) >= self._max_queue_size:
                # Drop oldest event if queue is full
                self._queue.pop(0)
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


class Trackly(BaseCallbackHandler):
    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        debug: bool = False,
        feature: Optional[str] = None,
        environment: Optional[str] = None,
    ):
        self.provider = provider
        self.feature = feature
        self.environment = environment
        
        # Internal worker handles the queue and flushing
        self._worker = _TracklyWorker(api_key, base_url, debug)
        
        # Ollama clients (lazy loaded)
        self._ollama_async_client = None

        # LangChain specific state
        self._start_times: Dict[Any, float] = {}
        self._serialized: Dict[Any, Dict] = {}
        self._model_names: Dict[Any, str] = {}

    def _get_ollama_async_client(self):
        """Lazy load and reuse the Ollama AsyncClient."""
        if self._ollama_async_client is None:
            from ollama import AsyncClient
            self._ollama_async_client = AsyncClient()
        return self._ollama_async_client

    def callback(self):
        """Backward compatibility: return self as the LangChain callback handler."""
        return self

    # --- LangChain Callback Implementation ---

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

        self._worker._enqueue(event)

    def on_llm_error(self, error: BaseException, **kwargs: Any):
        """Clean up run state on failure — don't log a cost event."""
        run_id = kwargs.get("run_id")
        self._start_times.pop(run_id, None)
        self._serialized.pop(run_id, None)
        self._model_names.pop(run_id, None)

    # --- Ollama Implementation ---

    def chat(self, *args, **kwargs):
        """Wrap ollama.chat and log the usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        
        import ollama
        if kwargs.get('stream'):
            return self._ollama_stream_wrapper(ollama.chat(*args, **kwargs))
        
        response = ollama.chat(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    def generate(self, *args, **kwargs):
        """Wrap ollama.generate and log the usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        
        import ollama
        if kwargs.get('stream'):
            return self._ollama_stream_wrapper(ollama.generate(*args, **kwargs))
        
        response = ollama.generate(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    def list(self):
        """List local models via ollama."""
        import ollama
        return ollama.list()

    def show(self, model):
        """Show model information via ollama."""
        import ollama
        return ollama.show(model)

    def ps(self):
        """List running models via ollama."""
        import ollama
        return ollama.ps()

    def create(self, **kwargs):
        """Create a model via ollama."""
        import ollama
        return ollama.create(**kwargs)

    def copy(self, source, destination):
        """Copy a model via ollama."""
        import ollama
        return ollama.copy(source, destination)

    def delete(self, model):
        """Delete a model via ollama."""
        import ollama
        return ollama.delete(model)

    def pull(self, model, **kwargs):
        """Pull a model via ollama."""
        import ollama
        return ollama.pull(model, **kwargs)

    def push(self, model, **kwargs):
        """Push a model via ollama."""
        import ollama
        return ollama.push(model, **kwargs)

    def embed(self, *args, **kwargs):
        """Generate embeddings via ollama and log usage."""
        import ollama
        response = ollama.embed(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    # --- Ollama Async Methods ---

    async def chat_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.chat and log usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        client = self._get_ollama_async_client()
        if kwargs.get('stream'):
            return self._ollama_async_stream_wrapper(await client.chat(*args, **kwargs))
        response = await client.chat(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    async def generate_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.generate and log usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        client = self._get_ollama_async_client()
        if kwargs.get('stream'):
            return self._ollama_async_stream_wrapper(await client.generate(*args, **kwargs))
        response = await client.generate(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    async def embed_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.embed and log usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        client = self._get_ollama_async_client()
        response = await client.embed(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    # --- Ollama Helpers ---

    def _ollama_stream_wrapper(self, stream):
        for chunk in stream:
            if chunk.get('done'):
                self._log_ollama_event(chunk)
            yield chunk

    async def _ollama_async_stream_wrapper(self, async_gen):
        async for chunk in async_gen:
            if chunk.get('done'):
                self._log_ollama_event(chunk)
            yield chunk

    def _log_ollama_event(self, response: Dict[str, Any]):
        try:
            total_duration = response.get("total_duration", 0)
            prompt_eval_count = response.get("prompt_eval_count", 0)
            eval_count = response.get("eval_count", 0)
            
            is_embedding = "embeddings" in response or "embedding" in response
            
            latency_ms = int(total_duration / 1_000_000)
            
            event = {
                "provider": "ollama",
                "model": response.get("model", "unknown"),
                "prompt_tokens": prompt_eval_count if not is_embedding else None,
                "completion_tokens": eval_count if not is_embedding else None,
                "total_tokens": (prompt_eval_count + eval_count) if not is_embedding else None,
                "latency_ms": latency_ms,
                "feature": self.feature,
                "environment": self.environment,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            
            if is_embedding:
                event["finish_reason"] = "embedding"

            prompt_eval_duration = response.get("prompt_eval_duration")
            eval_duration = response.get("eval_duration")
            if prompt_eval_duration is not None or eval_duration is not None:
                event["metadata"] = {
                    "prompt_eval_duration_ms": int(prompt_eval_duration / 1_000_000) if prompt_eval_duration else None,
                    "eval_duration_ms": int(eval_duration / 1_000_000) if eval_duration else None,
                }

            self._worker._enqueue(event)
        except Exception as exc:
            if self._worker.debug:
                print(f"[Trackly] warning: failed to process Ollama event: {exc}")

    def shutdown(self, timeout: float = 5.0):
        """Flush remaining events and stop the background thread."""
        self._worker.shutdown(timeout)