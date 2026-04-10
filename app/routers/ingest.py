from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import LlmEvent, Span, Trace
from app.models.schemas import EventPayload, IngestRequest, IngestResponse
from app.services.auth import authenticate
from app.services.insights_engine import generate_trace_insights
from app.services.pricing import compute_cost
from app.services.project_budgets import maybe_send_project_budget_alert
from app.services.rate_limit import limiter

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post(
    "/events",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest a batch of LLM events from the SDK",
)
@limiter.limit("120/minute")
async def ingest_events(
    request: Request,
    body: IngestRequest,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> IngestResponse:
    api_key = await authenticate(db, authorization)
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if api_key.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This API key is not associated with a project.",
        )

    accepted = 0
    rejected = 0
    llm_events_written = 0
    now = datetime.now(timezone.utc)

    for event in body.events:
        try:
            if event.event_type == "trace_start":
                await _upsert_trace_start(db, api_key.project_id, event, now)
            elif event.event_type == "trace_end":
                await _upsert_trace_end(db, api_key.project_id, event, now)
            elif event.event_type in {"span", "step", "generation"}:
                await _upsert_span(db, api_key.project_id, event, now)
            else:
                await _insert_llm_event(db, api_key.project_id, api_key.id, api_key.parent_key_id, api_key.created_by_user_id, event, now)
                llm_events_written += 1
            accepted += 1
        except Exception:
            logger.exception("Failed to ingest event", extra={"event_type": event.event_type, "trace_id": event.trace_id})
            rejected += 1

    if accepted:
        await db.flush()

    if llm_events_written and api_key.project_id is not None:
        try:
            await maybe_send_project_budget_alert(db, api_key.project_id)
        except Exception:
            logger.exception("Project budget alert check failed for project %s", api_key.project_id)

    return IngestResponse(accepted=accepted, rejected=rejected)


async def _insert_llm_event(
    db: AsyncSession,
    project_id: uuid.UUID,
    api_key_id: uuid.UUID,
    parent_api_key_id: uuid.UUID | None,
    created_by_user_id: uuid.UUID | None,
    event: EventPayload,
    now: datetime,
) -> None:
    occurred_at = _event_timestamp(event, now)
    cost = await compute_cost(db, event, occurred_at)

    extra = dict(event.extra or {})
    if event.trace_id:
        extra["trace_id"] = event.trace_id
    if event.parent_span_id:
        extra["parent_span_id"] = event.parent_span_id

    orm_event = LlmEvent(
        project_id=project_id,
        api_key_id=api_key_id,
        parent_api_key_id=parent_api_key_id,
        provider=event.provider or "unknown",
        model=event.model or "unknown",
        prompt_tokens=event.prompt_tokens,
        completion_tokens=event.completion_tokens,
        total_tokens=_compute_total(event),
        estimated_cost_usd=float(cost) if cost is not None else None,
        latency_ms=event.latency_ms,
        finish_reason=event.finish_reason,
        feature=event.feature,
        user_id=str(created_by_user_id) if created_by_user_id else event.user_id,
        session_id=event.session_id,
        run_id=event.run_id,
        parent_run_id=event.parent_run_id,
        tags=event.tags or None,
        extra=extra or None,
        sdk_version=event.sdk_version,
        occurred_at=occurred_at,
        ingested_at=now,
    )
    db.add(orm_event)


async def _upsert_trace_start(
    db: AsyncSession,
    project_id: uuid.UUID,
    event: EventPayload,
    now: datetime,
) -> None:
    trace = await _get_trace(db, project_id, event.trace_id)
    started_at = event.started_at or _event_timestamp(event, now)

    if trace is None:
        trace = Trace(
            project_id=project_id,
            trace_id=event.trace_id or str(uuid.uuid4()),
            name=event.name or "untitled-trace",
            session_id=event.session_id,
            user_id=event.user_id,
            status=event.status or "running",
            input=event.input,
            metadata_json=event.metadata or None,
            tags=event.tags or None,
            feature=event.feature,
            environment=event.environment,
            started_at=started_at,
            ingested_at=now,
        )
        db.add(trace)
        return

    trace.name = event.name or trace.name
    trace.session_id = event.session_id or trace.session_id
    trace.user_id = event.user_id or trace.user_id
    trace.status = event.status or trace.status or "running"
    trace.input = event.input if event.input is not None else trace.input
    trace.metadata_json = event.metadata or trace.metadata_json
    trace.tags = event.tags or trace.tags
    trace.feature = event.feature or trace.feature
    trace.environment = event.environment or trace.environment
    trace.started_at = trace.started_at or started_at
    trace.ingested_at = now


async def _upsert_trace_end(
    db: AsyncSession,
    project_id: uuid.UUID,
    event: EventPayload,
    now: datetime,
) -> None:
    trace = await _get_trace(db, project_id, event.trace_id)
    ended_at = event.ended_at or _event_timestamp(event, now)

    if trace is None:
        trace = Trace(
            project_id=project_id,
            trace_id=event.trace_id or str(uuid.uuid4()),
            name=event.name or "untitled-trace",
            session_id=event.session_id,
            user_id=event.user_id,
            status=event.status or "completed",
            total_cost_usd=event.total_cost_usd or 0,
            total_tokens=event.total_tokens or 0,
            total_latency_ms=event.latency_ms or event.total_latency_ms or 0,
            step_count=event.step_count or 0,
            pipeline_fingerprint=event.pipeline_fingerprint,
            health_score=event.health_score,
            feature=event.feature,
            environment=event.environment,
            status_message=event.status_message,
            started_at=event.started_at or ended_at,
            ended_at=ended_at,
            ingested_at=now,
        )
        db.add(trace)
        return

    trace.name = event.name or trace.name
    trace.status = event.status or trace.status
    trace.output = event.output if event.output is not None else trace.output
    trace.total_cost_usd = event.total_cost_usd if event.total_cost_usd is not None else trace.total_cost_usd
    trace.total_tokens = event.total_tokens if event.total_tokens is not None else trace.total_tokens
    trace.total_latency_ms = (
        event.total_latency_ms
        if event.total_latency_ms is not None
        else event.latency_ms if event.latency_ms is not None else trace.total_latency_ms
    )
    trace.step_count = event.step_count if event.step_count is not None else trace.step_count
    trace.pipeline_fingerprint = event.pipeline_fingerprint or trace.pipeline_fingerprint
    trace.health_score = event.health_score if event.health_score is not None else trace.health_score
    trace.status_message = event.status_message or trace.status_message
    trace.ended_at = ended_at
    trace.ingested_at = now

    await db.flush()
    span_stmt = select(Span).where(Span.trace_ref_id == trace.id)
    span_result = await db.execute(span_stmt)
    spans = span_result.scalars().all()
    
    try:
        trace.insights = generate_trace_insights(trace, list(spans))
    except Exception:
        logger.exception("Failed to generate highlights for trace %s", trace.trace_id)


async def _upsert_span(
    db: AsyncSession,
    project_id: uuid.UUID,
    event: EventPayload,
    now: datetime,
) -> None:
    trace = await _ensure_trace(db, project_id, event, now)
    span_id = event.span_id or event.run_id or str(uuid.uuid4())
    span_type = event.type or ("generation" if event.provider and event.model else "span")
    started_at = event.started_at or _event_timestamp(event, now)
    ended_at = event.ended_at or event.timestamp or started_at
    latency_ms = event.latency_ms if event.latency_ms is not None else _duration_ms(started_at, ended_at)
    total_tokens = _compute_total(event)

    estimated_cost = event.estimated_cost_usd
    if estimated_cost is None and span_type == "generation" and event.provider and event.model:
        computed = await compute_cost(db, event, ended_at)
        estimated_cost = float(computed) if computed is not None else None

    stmt = select(Span).where(
        Span.project_id == project_id,
        Span.trace_id == (event.trace_id or trace.trace_id),
        Span.span_id == span_id,
    )
    result = await db.execute(stmt)
    span = result.scalar_one_or_none()

    if span is None:
        span = Span(
            project_id=project_id,
            trace_ref_id=trace.id,
            trace_id=event.trace_id or trace.trace_id,
            span_id=span_id,
            parent_span_id=event.parent_span_id,
            name=event.name or event.model or "span",
            type=span_type,
            input=event.input,
            output=event.output,
            metadata_json=event.metadata or None,
            provider=event.provider,
            model=event.model,
            prompt_tokens=event.prompt_tokens,
            completion_tokens=event.completion_tokens,
            total_tokens=total_tokens,
            estimated_cost_usd=estimated_cost,
            latency_ms=latency_ms,
            finish_reason=event.finish_reason,
            level=event.level or 0,
            status=event.status or "ok",
            status_message=event.status_message,
            started_at=started_at,
            ended_at=ended_at,
            ingested_at=now,
        )
        db.add(span)
        return

    span.trace_ref_id = trace.id
    span.parent_span_id = event.parent_span_id or span.parent_span_id
    span.name = event.name or span.name
    span.type = span_type
    span.input = event.input if event.input is not None else span.input
    span.output = event.output if event.output is not None else span.output
    span.metadata_json = event.metadata or span.metadata_json
    span.provider = event.provider or span.provider
    span.model = event.model or span.model
    span.prompt_tokens = event.prompt_tokens if event.prompt_tokens is not None else span.prompt_tokens
    span.completion_tokens = (
        event.completion_tokens if event.completion_tokens is not None else span.completion_tokens
    )
    span.total_tokens = total_tokens if total_tokens is not None else span.total_tokens
    span.estimated_cost_usd = estimated_cost if estimated_cost is not None else span.estimated_cost_usd
    span.latency_ms = latency_ms if latency_ms is not None else span.latency_ms
    span.finish_reason = event.finish_reason or span.finish_reason
    span.level = event.level if event.level is not None else span.level
    span.status = event.status or span.status
    span.status_message = event.status_message or span.status_message
    span.started_at = started_at
    span.ended_at = ended_at
    span.ingested_at = now


async def _ensure_trace(
    db: AsyncSession,
    project_id: uuid.UUID,
    event: EventPayload,
    now: datetime,
) -> Trace:
    trace = await _get_trace(db, project_id, event.trace_id)
    if trace is not None:
        return trace

    trace = Trace(
        project_id=project_id,
        trace_id=event.trace_id or str(uuid.uuid4()),
        name=event.name or event.trace_id or "untitled-trace",
        session_id=event.session_id,
        user_id=event.user_id,
        status="running",
        feature=event.feature,
        environment=event.environment,
        started_at=event.started_at or _event_timestamp(event, now),
        ingested_at=now,
    )
    db.add(trace)
    await db.flush()
    return trace


async def _get_trace(db: AsyncSession, project_id: uuid.UUID, trace_id: str | None) -> Trace | None:
    if not trace_id:
        return None
    stmt = select(Trace).where(Trace.project_id == project_id, Trace.trace_id == trace_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


def _event_timestamp(event: EventPayload, fallback: datetime) -> datetime:
    return event.timestamp or event.ended_at or event.started_at or fallback


def _duration_ms(started_at: datetime | None, ended_at: datetime | None) -> int | None:
    if started_at is None or ended_at is None:
        return None
    return int((ended_at - started_at).total_seconds() * 1000)


def _compute_total(event: EventPayload) -> int | None:
    if event.total_tokens is not None:
        return event.total_tokens
    if event.prompt_tokens is not None or event.completion_tokens is not None:
        return (event.prompt_tokens or 0) + (event.completion_tokens or 0)
    return None
