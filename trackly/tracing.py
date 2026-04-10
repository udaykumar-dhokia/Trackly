from __future__ import annotations

import asyncio
import contextvars
import functools
import hashlib
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Callable, Optional

if TYPE_CHECKING:
    from .client import Trackly

_active_trace: contextvars.ContextVar[Optional["_TraceContext"]] = contextvars.ContextVar(
    "trackly_active_trace",
    default=None,
)


@dataclass
class SpanRecord:
    span_id: str
    trace_id: str
    parent_span_id: str | None
    name: str
    type: str
    level: int
    status: str = "running"
    status_message: str | None = None
    input_data: Any | None = None
    output_data: Any | None = None
    metadata: dict[str, Any] | None = None
    provider: str | None = None
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    estimated_cost_usd: float | None = None
    latency_ms: int | None = None
    finish_reason: str | None = None
    started_at: str | None = None
    ended_at: str | None = None


@dataclass
class TraceRecord:
    """
    Internal representation of an AI system journey including all steps, spans, and generations.
    Used by the Trackly Decision Engine to compute health scores and fingerprints.
    """
    trace_id: str
    name: str
    session_id: str | None = None
    user_id: str | None = None
    status: str = "running"
    input_data: Any | None = None
    output_data: Any | None = None
    metadata: dict[str, Any] | None = None
    tags: list[str] | None = None
    total_cost_usd: float = 0.0
    total_tokens: int = 0
    total_latency_ms: int = 0
    step_count: int = 0
    pipeline_fingerprint: str | None = None
    health_score: float | None = None
    started_at: str | None = None
    ended_at: str | None = None
    spans: list[SpanRecord] = field(default_factory=list)
    _span_names: list[str] = field(default_factory=list, repr=False)


class _TraceContext:
    def __init__(
        self,
        trackly: Trackly,
        name: str,
        session_id: str | None = None,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        tags: list[str] | None = None,
        capture_io: bool = False,
    ):
        self._trackly = trackly
        self._capture_io = capture_io
        self._trace = TraceRecord(
            trace_id=str(uuid.uuid4()),
            name=name,
            session_id=session_id or trackly.session_id,
            user_id=user_id,
            metadata=metadata,
            tags=tags,
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        self._span_stack: list[SpanRecord] = []
        self._token: contextvars.Token | None = None
        self._start_time = 0.0

    @property
    def trace_id(self) -> str:
        return self._trace.trace_id

    @property
    def current_span_id(self) -> str | None:
        return self._span_stack[-1].span_id if self._span_stack else None

    @property
    def current_level(self) -> int:
        return len(self._span_stack)

    def span(self, name: str, metadata: dict[str, Any] | None = None) -> "_SpanContextManager":
        return _SpanContextManager(self, name, metadata)

    def step(self, name: str, metadata: dict[str, Any] | None = None) -> "_SpanContextManager":
        return self.span(name, metadata)

    def _activate(self) -> None:
        self._token = _active_trace.set(self)
        self._start_time = time.time()
        self._trackly._worker._enqueue(
            {
                "event_type": "trace_start",
                "trace_id": self._trace.trace_id,
                "name": self._trace.name,
                "session_id": self._trace.session_id,
                "user_id": self._trace.user_id,
                "metadata": self._trace.metadata,
                "tags": self._trace.tags,
                "feature": self._trackly.feature,
                "environment": self._trackly.environment,
                "started_at": self._trace.started_at,
                "timestamp": self._trace.started_at,
            }
        )

    def _deactivate(self, error: BaseException | None = None) -> None:
        self._trace.ended_at = datetime.now(timezone.utc).isoformat()
        self._trace.total_latency_ms = int((time.time() - self._start_time) * 1000)
        self._trace.status = "error" if error else "completed"
        self._trace.pipeline_fingerprint = self._compute_fingerprint()
        self._trace.health_score = self._compute_health_score()

        self._trackly._worker._enqueue(
            {
                "event_type": "trace_end",
                "trace_id": self._trace.trace_id,
                "name": self._trace.name,
                "status": self._trace.status,
                "status_message": str(error) if error else None,
                "total_cost_usd": self._trace.total_cost_usd,
                "total_tokens": self._trace.total_tokens,
                "total_latency_ms": self._trace.total_latency_ms,
                "step_count": self._trace.step_count,
                "pipeline_fingerprint": self._trace.pipeline_fingerprint,
                "health_score": self._trace.health_score,
                "session_id": self._trace.session_id,
                "feature": self._trackly.feature,
                "environment": self._trackly.environment,
                "ended_at": self._trace.ended_at,
                "timestamp": self._trace.ended_at,
            }
        )

        if self._token is not None:
            _active_trace.reset(self._token)
            self._token = None

    def _compute_fingerprint(self) -> str:
        key = "|".join(self._trace._span_names)
        return hashlib.sha256(key.encode()).hexdigest()[:16]

    def _compute_health_score(self) -> float:
        score = 100.0
        if self._trace.status == "error":
            score -= 40.0
        error_spans = sum(1 for span in self._trace.spans if span.status == "error")
        if self._trace.step_count > 0:
            score -= error_spans / self._trace.step_count * 30.0
        if self._trace.total_latency_ms > 10000:
            score -= min(20.0, (self._trace.total_latency_ms - 10000) / 5000 * 10.0)
        if self._trace.total_cost_usd > 0.10:
            score -= min(10.0, (self._trace.total_cost_usd - 0.10) / 0.50 * 10.0)
        return round(max(0.0, min(100.0, score)), 1)

    def start_span(
        self,
        name: str,
        span_type: str = "span",
        input_data: Any | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> SpanRecord:
        span = SpanRecord(
            span_id=str(uuid.uuid4()),
            trace_id=self._trace.trace_id,
            parent_span_id=self.current_span_id,
            name=name,
            type=span_type,
            level=self.current_level,
            input_data=input_data if self._capture_io else None,
            metadata=metadata,
            started_at=datetime.now(timezone.utc).isoformat(),
        )
        self._span_stack.append(span)
        self._trace.spans.append(span)
        self._trace._span_names.append(f"{span_type}:{name}")
        self._trace.step_count += 1
        return span

    def end_span(
        self,
        span: SpanRecord,
        output_data: Any | None = None,
        error: BaseException | None = None,
    ) -> None:
        span.ended_at = datetime.now(timezone.utc).isoformat()
        if self._capture_io and output_data is not None:
            span.output_data = output_data
        span.status = "error" if error else "ok"
        if error:
            span.status_message = str(error)

        if span.started_at and span.ended_at:
            start_dt = datetime.fromisoformat(span.started_at)
            end_dt = datetime.fromisoformat(span.ended_at)
            span.latency_ms = int((end_dt - start_dt).total_seconds() * 1000)

        self._trackly._worker._enqueue(
            {
                "event_type": "span",
                "trace_id": span.trace_id,
                "span_id": span.span_id,
                "parent_span_id": span.parent_span_id,
                "name": span.name,
                "type": span.type,
                "level": span.level,
                "status": span.status,
                "status_message": span.status_message,
                "provider": span.provider,
                "model": span.model,
                "prompt_tokens": span.prompt_tokens,
                "completion_tokens": span.completion_tokens,
                "total_tokens": span.total_tokens,
                "estimated_cost_usd": span.estimated_cost_usd,
                "latency_ms": span.latency_ms,
                "finish_reason": span.finish_reason,
                "metadata": span.metadata,
                "input": span.input_data,
                "output": span.output_data,
                "session_id": self._trace.session_id,
                "feature": self._trackly.feature,
                "environment": self._trackly.environment,
                "started_at": span.started_at,
                "ended_at": span.ended_at,
                "timestamp": span.ended_at,
            }
        )

        if span in self._span_stack:
            self._span_stack.remove(span)

    def record_generation(
        self,
        provider: str,
        model: str,
        prompt_tokens: int | None = None,
        completion_tokens: int | None = None,
        total_tokens: int | None = None,
        cost_usd: float | None = None,
        latency_ms: int | None = None,
        finish_reason: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        span = self.start_span(
            name=f"{provider}/{model}",
            span_type="generation",
            metadata=metadata,
        )
        span.provider = provider
        span.model = model
        span.prompt_tokens = prompt_tokens
        span.completion_tokens = completion_tokens
        span.total_tokens = total_tokens
        span.estimated_cost_usd = cost_usd
        span.latency_ms = latency_ms
        span.finish_reason = finish_reason

        if total_tokens:
            self._trace.total_tokens += total_tokens
        if cost_usd:
            self._trace.total_cost_usd += cost_usd

        self.end_span(span)


class _SpanContextManager:
    def __init__(self, ctx: _TraceContext, name: str, metadata: dict[str, Any] | None = None):
        self._ctx = ctx
        self._name = name
        self._metadata = metadata
        self._span: SpanRecord | None = None

    def __enter__(self) -> SpanRecord:
        self._span = self._ctx.start_span(self._name, metadata=self._metadata)
        return self._span

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        if self._span:
            self._ctx.end_span(self._span, error=exc_val)
        return False

    async def __aenter__(self) -> SpanRecord:
        self._span = self._ctx.start_span(self._name, metadata=self._metadata)
        return self._span

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        if self._span:
            self._ctx.end_span(self._span, error=exc_val)
        return False


class _TraceContextManager:
    def __init__(self, ctx: _TraceContext, capture_input: Any = None):
        self._ctx = ctx
        self._capture_input = capture_input

    def __enter__(self) -> _TraceContext:
        if self._ctx._capture_io and self._capture_input is not None:
            self._ctx._trace.input_data = self._capture_input
        self._ctx._activate()
        return self._ctx

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:
        self._ctx._deactivate(error=exc_val)
        return False

    async def __aenter__(self) -> _TraceContext:
        if self._ctx._capture_io and self._capture_input is not None:
            self._ctx._trace.input_data = self._capture_input
        self._ctx._activate()
        return self._ctx

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        self._ctx._deactivate(error=exc_val)
        return False


def get_active_trace() -> _TraceContext | None:
    return _active_trace.get()


def track(
    _func: Callable | None = None,
    *,
    name: str | None = None,
    capture_io: bool = False,
    metadata: dict[str, Any] | None = None,
    trackly_instance: Trackly | None = None,
):
    """
    Decorator/wrapper to track an AI system component or step.

    Trackly automatically records the component execution, captures status, 
    and links it to the active decision engine trace.
    """
    def decorator(func: Callable) -> Callable:
        trace_name = name or func.__qualname__

        def _capture_io(args: tuple[Any, ...], kwargs: dict[str, Any]) -> Any | None:
            if not capture_io:
                return None
            try:
                return {"args": repr(args)[:500], "kwargs": repr(kwargs)[:500]}
            except Exception:
                return None

        def _capture_output(result: Any) -> Any | None:
            if not capture_io:
                return None
            try:
                return repr(result)[:1000]
            except Exception:
                return None

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            ctx = _active_trace.get()
            if ctx is None and trackly_instance is not None:
                with trackly_instance.trace(name=trace_name, capture_io=capture_io):
                    root_ctx = _active_trace.get()
                    if root_ctx is None:
                        return func(*args, **kwargs)
                    span = root_ctx.start_span(trace_name, input_data=_capture_io(args, kwargs), metadata=metadata)
                    try:
                        result = func(*args, **kwargs)
                        root_ctx.end_span(span, output_data=_capture_output(result))
                        return result
                    except BaseException as exc:
                        root_ctx.end_span(span, error=exc)
                        raise
            if ctx is None:
                return func(*args, **kwargs)

            span = ctx.start_span(trace_name, input_data=_capture_io(args, kwargs), metadata=metadata)
            try:
                result = func(*args, **kwargs)
                ctx.end_span(span, output_data=_capture_output(result))
                return result
            except BaseException as exc:
                ctx.end_span(span, error=exc)
                raise

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            ctx = _active_trace.get()
            if ctx is None and trackly_instance is not None:
                async with trackly_instance.trace(name=trace_name, capture_io=capture_io):
                    root_ctx = _active_trace.get()
                    if root_ctx is None:
                        return await func(*args, **kwargs)
                    span = root_ctx.start_span(trace_name, input_data=_capture_io(args, kwargs), metadata=metadata)
                    try:
                        result = await func(*args, **kwargs)
                        root_ctx.end_span(span, output_data=_capture_output(result))
                        return result
                    except BaseException as exc:
                        root_ctx.end_span(span, error=exc)
                        raise
            if ctx is None:
                return await func(*args, **kwargs)

            span = ctx.start_span(trace_name, input_data=_capture_io(args, kwargs), metadata=metadata)
            try:
                result = await func(*args, **kwargs)
                ctx.end_span(span, output_data=_capture_output(result))
                return result
            except BaseException as exc:
                ctx.end_span(span, error=exc)
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    if _func is not None:
        return decorator(_func)
    return decorator


observe = track
Trace = _TraceContext
Span = SpanRecord
