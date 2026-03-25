import os
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from .worker import _TracklyWorker
from .utils import _detect_provider
from .providers_impl.ollama import _OllamaHandler
from .providers_impl.gemini import GeminiModelsWrapper, GeminiBatchesWrapper


class Trackly(BaseCallbackHandler):
    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        debug: bool = False,
        feature: str = "default",
        environment: str = "production",
        gemini_api_key: Optional[str] = None,
    ):
        super().__init__()
        self.provider = provider
        self.feature = feature
        self.environment = environment
        self.gemini_api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        
        self._worker = _TracklyWorker(api_key, base_url, debug)
        
        self._ollama_handler = None
        self._ollama_async_client = None
        self._gemini_wrapper = None
        self._gemini_batches_wrapper = None

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

    @property
    def models(self):
        """Access Gemini models wrapper."""
        if self.provider != "gemini":
            raise ValueError(
                "Trackly instance not configured for Gemini provider. "
                "Initialize with provider='gemini'."
            )
        if self._gemini_wrapper is None:
            self._gemini_wrapper = GeminiModelsWrapper(self)
        return self._gemini_wrapper

    @property
    def batches(self):
        """Access Gemini batches wrapper."""
        if self.provider != "gemini":
            raise ValueError(
                "Trackly instance not configured for Gemini provider. "
                "Initialize with provider='gemini'."
            )
        if self._gemini_batches_wrapper is None:
            self._gemini_batches_wrapper = GeminiBatchesWrapper(self)
        return self._gemini_batches_wrapper

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
    # --- Helper methods ---

    def _get_ollama_handler(self):
        if self._ollama_handler is None:
            self._ollama_handler = _OllamaHandler(self)
        return self._ollama_handler

    # --- Ollama Implementation ---

    def chat(self, *args, **kwargs):
        """Wrap ollama.chat and log the usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return self._get_ollama_handler().chat(*args, **kwargs)

    def generate(self, *args, **kwargs):
        """Wrap ollama.generate and log the usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return self._get_ollama_handler().generate(*args, **kwargs)

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
        return self._get_ollama_handler().embed(*args, **kwargs)

    # --- Ollama Async Methods ---

    async def chat_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.chat and log usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return await self._get_ollama_handler().chat_async(*args, **kwargs)

    async def generate_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.generate and log usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return await self._get_ollama_handler().generate_async(*args, **kwargs)

    async def embed_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.embed and log usage."""
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return await self._get_ollama_handler().embed_async(*args, **kwargs)


    def _log_gemini_event(self, model: str, response: Any, latency_ms: int):
        """Log a cost event for Google Gemini usage."""
        try:
            usage = getattr(response, "usage_metadata", None)
            prompt_tokens = getattr(usage, "prompt_token_count", None)
            completion_tokens = getattr(usage, "candidates_token_count", None)
            total_tokens = getattr(usage, "total_token_count", None)
            
            finish_reason = None
            try:
                if response.candidates:
                    finish_reason = str(response.candidates[0].finish_reason)
            except (AttributeError, IndexError):
                pass

            event = {
                "provider": "google",
                "model": model,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "latency_ms": latency_ms,
                "finish_reason": finish_reason,
                "feature": self.feature,
                "environment": self.environment,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            
            self._worker._enqueue(event)
        except Exception as exc:
            if self._worker.debug:
                print(f"[Trackly] warning: failed to process Gemini event: {exc}")

    def _log_gemini_batch_event(self, model: str, response: Any, action: str):
        """Log a cost event for Google Gemini Batch usage."""
        try:
            event = {
                "provider": "google-batch",
                "model": model,
                "action": action,
                "feature": self.feature,
                "environment": self.environment,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {
                    "job_name": getattr(response, "name", "unknown"),
                    "state": str(getattr(response, "state", "initiated")),
                }
            }
            
            if hasattr(response, "state") and str(response.state) == "JOB_STATE_SUCCEEDED":
                pass

            self._worker._enqueue(event)
        except Exception as exc:
            if self._worker.debug:
                print(f"[Trackly] warning: failed to process Gemini Batch event: {exc}")

    def shutdown(self, timeout: float = 5.0):
        """Flush remaining events and stop the background thread."""
        self._worker.shutdown(timeout)
