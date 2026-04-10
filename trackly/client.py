import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.outputs import LLMResult

from .constants import Providers
from .providers_impl.anthropic import AnthropicMessagesWrapper
from .providers_impl.gemini import GeminiBatchesWrapper, GeminiModelsWrapper
from .providers_impl.ollama import _OllamaHandler
from .tracing import _TraceContext, _TraceContextManager, observe as _observe_decorator, get_active_trace
from .utils import _detect_provider
from .worker import _TracklyWorker


class Trackly(BaseCallbackHandler):
    """
    The AI Decision Engine for improving production AI systems.

    Trackly helps teams find what's wrong with their AI — and fix it. Automatically
    surface plain-English insights, detect critical paths, and optimize costs
    across your AI agents and chains.
    """
    def __init__(
        self,
        provider: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        debug: bool = False,
        feature: str = "default",
        environment: str = "production",
        gemini_api_key: Optional[str] = None,
        anthropic_api_key: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        super().__init__()
        self.provider = provider
        self.feature = feature
        self.environment = environment
        self.session_id = session_id
        self.gemini_api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        self.anthropic_api_key = anthropic_api_key or os.getenv("ANTHROPIC_API_KEY")

        self._worker = _TracklyWorker(api_key, base_url, debug)
        self._ollama_handler = None
        self._ollama_async_client = None
        self._gemini_wrapper = None
        self._gemini_batches_wrapper = None
        self._anthropic_messages_wrapper = None

        self._start_times: Dict[Any, float] = {}
        self._serialized: Dict[Any, Dict[str, Any]] = {}
        self._model_names: Dict[Any, str] = {}
        self._parent_run_ids: Dict[Any, Optional[str]] = {}

    def _get_ollama_async_client(self):
        if self._ollama_async_client is None:
            from ollama import AsyncClient

            self._ollama_async_client = AsyncClient()
        return self._ollama_async_client

    def _trace_event_context(self) -> dict[str, str]:
        active = get_active_trace()
        if active is None:
            return {}
        context = {"trace_id": active.trace_id}
        if active.current_span_id:
            context["parent_span_id"] = active.current_span_id
        return context

    def set_session(self, session_id: Optional[str]) -> None:
        self.session_id = session_id

    def callback(self):
        return self

    def trace(
        self,
        name: str = "untitled-trace",
        session_id: Optional[str] = None,
        user_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        capture_io: bool = False,
    ) -> _TraceContextManager:
        ctx = _TraceContext(
            trackly=self,
            name=name,
            session_id=session_id,
            user_id=user_id,
            metadata=metadata,
            tags=tags,
            capture_io=capture_io,
        )
        return _TraceContextManager(ctx)

    def span(self, name: str, metadata: Optional[Dict[str, Any]] = None):
        ctx = get_active_trace()
        if ctx is None:
            from contextlib import nullcontext

            return nullcontext()
        return ctx.span(name, metadata=metadata)

    def step(self, name: str, metadata: Optional[Dict[str, Any]] = None):
        return self.span(name, metadata=metadata)

    def observe(
        self,
        _func: Optional[Callable] = None,
        *,
        name: Optional[str] = None,
        capture_io: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        return _observe_decorator(
            _func,
            name=name,
            capture_io=capture_io,
            metadata=metadata,
            trackly_instance=self,
        )

    def track(
        self,
        _func: Optional[Callable] = None,
        *,
        name: Optional[str] = None,
        capture_io: bool = False,
        metadata: Optional[Dict[str, Any]] = None,
    ):
        return self.observe(
            _func,
            name=name,
            capture_io=capture_io,
            metadata=metadata,
        )

    @property
    def models(self):
        if self.provider != "gemini":
            raise ValueError("Trackly instance not configured for Gemini provider. Initialize with provider='gemini'.")
        if self._gemini_wrapper is None:
            self._gemini_wrapper = GeminiModelsWrapper(self)
        return self._gemini_wrapper

    @property
    def batches(self):
        if self.provider != "gemini":
            raise ValueError("Trackly instance not configured for Gemini provider. Initialize with provider='gemini'.")
        if self._gemini_batches_wrapper is None:
            self._gemini_batches_wrapper = GeminiBatchesWrapper(self)
        return self._gemini_batches_wrapper

    @property
    def messages(self):
        if self.provider != Providers.ANTHROPIC:
            raise ValueError(
                "Trackly instance not configured for Anthropic provider. Initialize with provider='anthropic'."
            )
        if self._anthropic_messages_wrapper is None:
            self._anthropic_messages_wrapper = AnthropicMessagesWrapper(self)
        return self._anthropic_messages_wrapper

    def on_llm_start(self, serialized: Dict[str, Any], prompts: List[str], **kwargs: Any):
        run_id = kwargs.get("run_id")
        if not run_id:
            return

        self._start_times[run_id] = time.time()
        self._serialized[run_id] = serialized
        self._parent_run_ids[run_id] = kwargs.get("parent_run_id")

        invocation_params = kwargs.get("invocation_params", {})
        model = (
            invocation_params.get("model_name")
            or invocation_params.get("model")
            or invocation_params.get("model_id")
        )
        if model:
            self._model_names[run_id] = model

    def on_chat_model_start(self, serialized: Dict[str, Any], messages: List[List[Any]], **kwargs: Any):
        self.on_llm_start(serialized, [], **kwargs)

    def on_llm_end(self, response: LLMResult, **kwargs: Any):
        run_id = kwargs.get("run_id")
        start = self._start_times.pop(run_id, None)
        serialized = self._serialized.pop(run_id, {})
        parent_run_id = self._parent_run_ids.pop(run_id, None)
        latency_ms = int((time.time() - start) * 1000) if start else None

        model = self._model_names.pop(run_id, None)
        llm_output = response.llm_output or {}

        if not model:
            model = llm_output.get("model_name") or llm_output.get("model")
        if not model:
            try:
                generation = response.generations[0][0]
                meta = getattr(getattr(generation, "message", None), "response_metadata", None) or {}
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
            usage = llm_output["token_usage"]
            prompt_tokens = usage.get("prompt_tokens")
            completion_tokens = usage.get("completion_tokens")
            total_tokens = usage.get("total_tokens")
        elif "usage" in llm_output:
            usage = llm_output["usage"]
            prompt_tokens = usage.get("input_tokens")
            completion_tokens = usage.get("output_tokens")

        if prompt_tokens is None:
            try:
                generation = response.generations[0][0]
                usage_meta = getattr(getattr(generation, "message", None), "usage_metadata", None)
                if usage_meta:
                    prompt_tokens = usage_meta.get("input_tokens")
                    completion_tokens = usage_meta.get("output_tokens")
                    total_tokens = usage_meta.get("total_tokens")
            except (IndexError, AttributeError):
                pass

        if total_tokens is None and (prompt_tokens is not None or completion_tokens is not None):
            total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)

        finish_reason = None
        try:
            generation = response.generations[0][0]
            info = getattr(generation, "generation_info", None) or {}
            finish_reason = info.get("finish_reason") or info.get("stop_reason") or info.get("finishReason")
        except (IndexError, AttributeError):
            pass

        extra = self._trace_event_context() or None
        event = {
            "provider": provider,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "latency_ms": latency_ms,
            "finish_reason": finish_reason,
            "feature": self.feature,
            "environment": self.environment,
            "session_id": self.session_id,
            "run_id": str(run_id) if run_id else None,
            "parent_run_id": str(parent_run_id) if parent_run_id else None,
            "extra": extra,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._worker._enqueue(event)

        active = get_active_trace()
        if active:
            active.record_generation(
                provider=provider,
                model=model,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                cost_usd=None,
                latency_ms=latency_ms,
                finish_reason=finish_reason,
            )

    def on_llm_error(self, error: BaseException, **kwargs: Any):
        run_id = kwargs.get("run_id")
        self._start_times.pop(run_id, None)
        self._serialized.pop(run_id, None)
        self._model_names.pop(run_id, None)
        self._parent_run_ids.pop(run_id, None)

    def _get_ollama_handler(self):
        if self._ollama_handler is None:
            self._ollama_handler = _OllamaHandler(self)
        return self._ollama_handler

    def chat(self, *args, **kwargs):
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return self._get_ollama_handler().chat(*args, **kwargs)

    def generate(self, *args, **kwargs):
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return self._get_ollama_handler().generate(*args, **kwargs)

    def list(self):
        import ollama

        return ollama.list()

    def show(self, model):
        import ollama

        return ollama.show(model)

    def ps(self):
        import ollama

        return ollama.ps()

    def create(self, **kwargs):
        import ollama

        return ollama.create(**kwargs)

    def copy(self, source, destination):
        import ollama

        return ollama.copy(source, destination)

    def delete(self, model):
        import ollama

        return ollama.delete(model)

    def pull(self, model, **kwargs):
        import ollama

        return ollama.pull(model, **kwargs)

    def push(self, model, **kwargs):
        import ollama

        return ollama.push(model, **kwargs)

    def embed(self, *args, **kwargs):
        return self._get_ollama_handler().embed(*args, **kwargs)

    async def chat_async(self, *args, **kwargs):
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return await self._get_ollama_handler().chat_async(*args, **kwargs)

    async def generate_async(self, *args, **kwargs):
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return await self._get_ollama_handler().generate_async(*args, **kwargs)

    async def embed_async(self, *args, **kwargs):
        if self.provider != "ollama":
            raise ValueError("Trackly instance not configured for Ollama provider.")
        return await self._get_ollama_handler().embed_async(*args, **kwargs)

    def _log_gemini_event(self, model: str, response: Any, latency_ms: int):
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
                "session_id": self.session_id,
                "run_id": str(uuid.uuid4()),
                "extra": self._trace_event_context() or None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._worker._enqueue(event)

            active = get_active_trace()
            if active:
                active.record_generation(
                    provider="google",
                    model=model,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    latency_ms=latency_ms,
                    finish_reason=finish_reason,
                )
        except Exception as exc:
            if self._worker.debug:
                print(f"[Trackly] warning: failed to process Gemini event: {exc}")

    def _log_gemini_batch_event(self, model: str, response: Any, action: str):
        try:
            extra = {
                "action": action,
                "job_name": getattr(response, "name", "unknown"),
                "state": str(getattr(response, "state", "initiated")),
            }
            trace_context = self._trace_event_context()
            if trace_context:
                extra.update(trace_context)

            event = {
                "provider": "google-batch",
                "model": model,
                "feature": self.feature,
                "environment": self.environment,
                "session_id": self.session_id,
                "extra": extra,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._worker._enqueue(event)
        except Exception as exc:
            if self._worker.debug:
                print(f"[Trackly] warning: failed to process Gemini Batch event: {exc}")

    def _log_anthropic_event(self, response: Any, latency_ms: int):
        try:
            usage = getattr(response, "usage", None)
            prompt_tokens = getattr(usage, "input_tokens", None)
            completion_tokens = getattr(usage, "output_tokens", None)
            total_tokens = None
            if prompt_tokens is not None or completion_tokens is not None:
                total_tokens = (prompt_tokens or 0) + (completion_tokens or 0)

            model_name = getattr(response, "model", "unknown")
            stop_reason = getattr(response, "stop_reason", None)
            extra = {"message_id": getattr(response, "id", None)}
            trace_context = self._trace_event_context()
            if trace_context:
                extra.update(trace_context)

            event = {
                "provider": Providers.ANTHROPIC,
                "model": model_name,
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "latency_ms": latency_ms,
                "finish_reason": stop_reason,
                "feature": self.feature,
                "environment": self.environment,
                "session_id": self.session_id,
                "run_id": str(uuid.uuid4()),
                "extra": extra,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            self._worker._enqueue(event)

            active = get_active_trace()
            if active:
                active.record_generation(
                    provider=Providers.ANTHROPIC,
                    model=model_name,
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=total_tokens,
                    latency_ms=latency_ms,
                    finish_reason=stop_reason,
                )
        except Exception as exc:
            if self._worker.debug:
                print(f"[Trackly] warning: failed to process Anthropic event: {exc}")

    def shutdown(self, timeout: float = 5.0):
        self._worker.shutdown(timeout)
