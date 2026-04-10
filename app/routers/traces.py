from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import LlmEvent, Span, Trace
from app.models.schemas import (
    TraceDetailResponse,
    TraceGraphEdge,
    TraceGraphNode,
    TraceGraphResponse,
    TraceGraphSummary,
    TraceInsightItem,
    TraceInsightsResponse,
    TraceListItem,
    TraceListResponse,
    TraceSessionListResponse,
    TraceSessionSummary,
    TraceSpanResponse,
)
from app.services.project_access import require_project_access_by_auth0_id

router = APIRouter()

UNGROUPED_SESSION = "__ungrouped__"


@router.get(
    "/projects/{project_id}/traces/sessions",
    response_model=TraceSessionListResponse,
    summary="List traces for a project (compatibility alias for the graph view)",
)
async def list_trace_sessions(
    project_id: uuid.UUID,
    auth0_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> TraceSessionListResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    trace_sessions = await _list_trace_sessions(db, project_id, page, page_size)
    if trace_sessions.total > 0:
        return trace_sessions
    return await _list_legacy_sessions(db, project_id, page, page_size)


@router.get(
    "/projects/{project_id}/traces/graph",
    response_model=TraceGraphResponse,
    summary="Get trace graph data",
)
async def get_trace_graph(
    project_id: uuid.UUID,
    auth0_id: str,
    session_id: str = Query(..., description="Trace ID or legacy session ID to visualize"),
    db: AsyncSession = Depends(get_db),
) -> TraceGraphResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    trace = await _get_trace(db, project_id, session_id)
    if trace is not None:
        return await _build_graph_from_trace(db, trace)
    return await _build_legacy_graph(db, project_id, session_id)


@router.get(
    "/projects/{project_id}/traces",
    response_model=TraceListResponse,
    summary="List trace records for a project",
)
async def list_traces(
    project_id: uuid.UUID,
    auth0_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> TraceListResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    count_stmt = select(func.count(Trace.id)).where(Trace.project_id == project_id)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Trace)
        .where(Trace.project_id == project_id)
        .order_by(func.coalesce(Trace.ended_at, Trace.started_at).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    traces = (await db.execute(stmt)).scalars().all()

    return TraceListResponse(
        traces=[
            TraceListItem(
                trace_id=trace.trace_id,
                name=trace.name,
                session_id=trace.session_id,
                user_id=trace.user_id,
                status=trace.status,
                total_cost_usd=float(trace.total_cost_usd or 0),
                total_tokens=int(trace.total_tokens or 0),
                total_latency_ms=int(trace.total_latency_ms or 0),
                step_count=int(trace.step_count or 0),
                started_at=trace.started_at,
                ended_at=trace.ended_at,
            )
            for trace in traces
        ],
        total=total,
    )


@router.get(
    "/projects/{project_id}/traces/insights",
    response_model=TraceInsightsResponse,
    summary="Get high-level trace insights for a project",
)
async def get_trace_insights(
    project_id: uuid.UUID,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> TraceInsightsResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    recent_stmt = (
        select(Trace)
        .where(Trace.project_id == project_id)
        .order_by(func.coalesce(Trace.ended_at, Trace.started_at).desc())
        .limit(200)
    )
    traces = (await db.execute(recent_stmt)).scalars().all()

    insights: list[TraceInsightItem] = []
    if traces:
        avg_cost = sum(float(t.total_cost_usd or 0) for t in traces) / len(traces)
        avg_latency = sum(int(t.total_latency_ms or 0) for t in traces) / len(traces)
        costliest = max(traces, key=lambda item: float(item.total_cost_usd or 0))
        slowest = max(traces, key=lambda item: int(item.total_latency_ms or 0))
        errors = [trace for trace in traces if trace.status == "error"]

        insights.append(
            TraceInsightItem(
                type="cost",
                name=costliest.name,
                message=f"Highest total trace cost in the recent sample: ${float(costliest.total_cost_usd or 0):.4f}.",
                value=float(costliest.total_cost_usd or 0),
            )
        )
        insights.append(
            TraceInsightItem(
                type="latency",
                name=slowest.name,
                message=f"Slowest trace in the recent sample: {int(slowest.total_latency_ms or 0)}ms.",
                value=int(slowest.total_latency_ms or 0),
            )
        )
        insights.append(
            TraceInsightItem(
                type="baseline",
                name="Recent Baseline",
                message=f"Average recent trace cost is ${avg_cost:.4f} and average latency is {avg_latency:.0f}ms.",
                value=f"${avg_cost:.4f} / {avg_latency:.0f}ms",
            )
        )
        if errors:
            insights.append(
                TraceInsightItem(
                    type="errors",
                    name="Error Rate",
                    message=f"{len(errors)} of {len(traces)} recent traces ended in error.",
                    value=round(len(errors) / len(traces) * 100, 2),
                )
            )

    bottleneck_stmt = (
        select(
            Span.name,
            func.avg(Span.latency_ms).label("avg_latency_ms"),
            func.avg(Span.estimated_cost_usd).label("avg_cost_usd"),
            func.count(Span.id).label("occurrences"),
        )
        .where(Span.project_id == project_id)
        .group_by(Span.name)
        .order_by(func.avg(Span.latency_ms).desc())
        .limit(3)
    )
    bottlenecks = (await db.execute(bottleneck_stmt)).all()
    for item in bottlenecks:
        insights.append(
            TraceInsightItem(
                type="span_bottleneck",
                name=item.name,
                message=f"Avg latency {float(item.avg_latency_ms or 0):.0f}ms across {int(item.occurrences or 0)} spans.",
                value=float(item.avg_latency_ms or 0),
            )
        )

    return TraceInsightsResponse(project_id=project_id, insights=insights)


@router.get(
    "/projects/{project_id}/traces/{trace_id}",
    response_model=TraceDetailResponse,
    summary="Get full detail for a trace",
)
async def get_trace_detail(
    project_id: uuid.UUID,
    trace_id: str,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> TraceDetailResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    trace = await _get_trace(db, project_id, trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")

    graph = await _build_graph_from_trace(db, trace)
    return TraceDetailResponse(
        trace_id=trace.trace_id,
        name=trace.name,
        session_id=trace.session_id,
        user_id=trace.user_id,
        status=trace.status,
        metadata=trace.metadata_json,
        tags=trace.tags or [],
        total_cost_usd=float(trace.total_cost_usd or 0),
        total_tokens=int(trace.total_tokens or 0),
        total_latency_ms=int(trace.total_latency_ms or 0),
        step_count=int(trace.step_count or 0),
        pipeline_fingerprint=trace.pipeline_fingerprint,
        health_score=float(trace.health_score) if trace.health_score is not None else None,
        started_at=trace.started_at,
        ended_at=trace.ended_at,
        graph=graph,
        insights=trace.insights,
    )


@router.get(
    "/projects/{project_id}/traces/{trace_id}/spans",
    response_model=list[TraceSpanResponse],
    summary="List spans for a trace",
)
async def get_trace_spans(
    project_id: uuid.UUID,
    trace_id: str,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[TraceSpanResponse]:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    trace = await _get_trace(db, project_id, trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail="Trace not found")

    spans = await _get_spans_for_trace(db, trace.trace_id)
    return [
        TraceSpanResponse(
            trace_id=span.trace_id,
            span_id=span.span_id,
            parent_span_id=span.parent_span_id,
            name=span.name,
            type=span.type,
            level=int(span.level or 0),
            status=span.status,
            status_message=span.status_message,
            provider=span.provider,
            model=span.model,
            prompt_tokens=span.prompt_tokens,
            completion_tokens=span.completion_tokens,
            total_tokens=span.total_tokens,
            estimated_cost_usd=float(span.estimated_cost_usd) if span.estimated_cost_usd is not None else None,
            latency_ms=span.latency_ms,
            finish_reason=span.finish_reason,
            input=span.input,
            output=span.output,
            metadata=span.metadata_json,
            started_at=span.started_at,
            ended_at=span.ended_at,
        )
        for span in spans
    ]


async def _list_trace_sessions(
    db: AsyncSession,
    project_id: uuid.UUID,
    page: int,
    page_size: int,
) -> TraceSessionListResponse:
    count_stmt = select(func.count(Trace.id)).where(Trace.project_id == project_id)
    total = (await db.execute(count_stmt)).scalar_one()
    if total == 0:
        return TraceSessionListResponse(sessions=[], total=0)

    trace_stmt = (
        select(Trace)
        .where(Trace.project_id == project_id)
        .order_by(func.coalesce(Trace.ended_at, Trace.started_at).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    traces = (await db.execute(trace_stmt)).scalars().all()
    trace_ids = [trace.trace_id for trace in traces]

    span_stats: dict[str, dict[str, Any]] = {}
    if trace_ids:
        span_stmt = (
            select(
                Span.trace_id,
                func.count(Span.id).label("event_count"),
                func.coalesce(func.sum(Span.estimated_cost_usd), 0).label("total_cost"),
                func.coalesce(func.sum(Span.total_tokens), 0).label("total_tokens"),
                func.coalesce(func.sum(Span.latency_ms), 0).label("total_latency_ms"),
                func.array_agg(distinct(Span.model)).label("distinct_models"),
            )
            .where(Span.project_id == project_id, Span.trace_id.in_(trace_ids))
            .group_by(Span.trace_id)
        )
        for row in (await db.execute(span_stmt)).all():
            span_stats[row.trace_id] = {
                "event_count": int(row.event_count or 0),
                "total_cost": float(row.total_cost or 0),
                "total_tokens": int(row.total_tokens or 0),
                "total_latency_ms": int(row.total_latency_ms or 0),
                "distinct_models": [model for model in (row.distinct_models or []) if model],
            }

    sessions = []
    for trace in traces:
        stats = span_stats.get(trace.trace_id, {})
        sessions.append(
            TraceSessionSummary(
                session_id=trace.trace_id,
                trace_id=trace.trace_id,
                name=trace.name,
                status=trace.status,
                event_count=int(stats.get("event_count", trace.step_count or 0)),
                total_cost=float(stats.get("total_cost", trace.total_cost_usd or 0)),
                total_tokens=int(stats.get("total_tokens", trace.total_tokens or 0)),
                total_latency_ms=int(stats.get("total_latency_ms", trace.total_latency_ms or 0)),
                distinct_models=stats.get("distinct_models", []),
                first_event=trace.started_at,
                last_event=trace.ended_at or trace.started_at,
                session_group=trace.session_id,
                user_id=trace.user_id,
            )
        )

    return TraceSessionListResponse(sessions=sessions, total=total)


async def _build_graph_from_trace(db: AsyncSession, trace: Trace) -> TraceGraphResponse:
    spans = await _get_spans_for_trace(db, trace.trace_id)
    nodes = [
        TraceGraphNode(
            id=span.span_id,
            label=span.name if span.type != "generation" else (span.model or span.name),
            provider=span.provider or "application",
            model=span.model or span.name,
            node_type=span.type,
            name=span.name,
            total_tokens=int(span.total_tokens or 0),
            prompt_tokens=int(span.prompt_tokens or 0),
            completion_tokens=int(span.completion_tokens or 0),
            estimated_cost_usd=float(span.estimated_cost_usd or 0),
            latency_ms=int(span.latency_ms or 0),
            feature=None,
            finish_reason=span.finish_reason,
            occurred_at=span.started_at,
            event_count=1,
            run_id=span.span_id,
            parent_run_id=span.parent_span_id,
            status=span.status,
            level=int(span.level or 0),
        )
        for span in spans
    ]
    edges = [
        TraceGraphEdge(source=span.parent_span_id, target=span.span_id)
        for span in spans
        if span.parent_span_id
    ]
    models = sorted({span.model for span in spans if span.model})
    times = [span.started_at for span in spans]
    summary = TraceGraphSummary(
        total_cost=sum(node.estimated_cost_usd for node in nodes),
        total_tokens=sum(node.total_tokens for node in nodes),
        total_latency_ms=sum(node.latency_ms for node in nodes),
        event_count=len(nodes),
        distinct_models=models,
        time_range=[min(times), max(times)] if times else [],
    )
    return TraceGraphResponse(
        session_id=trace.trace_id,
        trace_id=trace.trace_id,
        name=trace.name,
        status=trace.status,
        nodes=nodes,
        edges=edges,
        summary=summary,
        insights=trace.insights,
    )


async def _get_trace(db: AsyncSession, project_id: uuid.UUID, trace_id: str) -> Trace | None:
    stmt = select(Trace).where(Trace.project_id == project_id, Trace.trace_id == trace_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _get_spans_for_trace(db: AsyncSession, trace_id: str) -> list[Span]:
    stmt = select(Span).where(Span.trace_id == trace_id).order_by(Span.started_at.asc(), Span.level.asc())
    result = await db.execute(stmt)
    return result.scalars().all()


async def _list_legacy_sessions(
    db: AsyncSession,
    project_id: uuid.UUID,
    page: int,
    page_size: int,
) -> TraceSessionListResponse:
    session_col = func.coalesce(LlmEvent.session_id, UNGROUPED_SESSION).label("session_key")

    count_stmt = select(func.count(distinct(session_col))).where(LlmEvent.project_id == project_id)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(
            session_col,
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.latency_ms), 0).label("total_latency_ms"),
            func.min(LlmEvent.occurred_at).label("first_event"),
            func.max(LlmEvent.occurred_at).label("last_event"),
            func.array_agg(distinct(LlmEvent.model)).label("distinct_models"),
        )
        .where(LlmEvent.project_id == project_id)
        .group_by(session_col)
        .order_by(func.max(LlmEvent.occurred_at).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    rows = (await db.execute(stmt)).all()
    return TraceSessionListResponse(
        sessions=[
            TraceSessionSummary(
                session_id=row.session_key,
                trace_id=row.session_key,
                name="Ungrouped Session" if row.session_key == UNGROUPED_SESSION else row.session_key,
                status="completed",
                event_count=int(row.event_count or 0),
                total_cost=float(row.total_cost or 0),
                total_tokens=int(row.total_tokens or 0),
                total_latency_ms=int(row.total_latency_ms or 0),
                distinct_models=[model for model in (row.distinct_models or []) if model],
                first_event=row.first_event,
                last_event=row.last_event,
            )
            for row in rows
        ],
        total=total,
    )


async def _build_legacy_graph(
    db: AsyncSession,
    project_id: uuid.UUID,
    session_id: str,
) -> TraceGraphResponse:
    if session_id == UNGROUPED_SESSION:
        session_filter = LlmEvent.session_id.is_(None)
    else:
        session_filter = LlmEvent.session_id == session_id

    stmt = (
        select(LlmEvent)
        .where(LlmEvent.project_id == project_id, session_filter)
        .order_by(LlmEvent.occurred_at.asc())
    )
    events = (await db.execute(stmt)).scalars().all()

    node_map: dict[str, dict[str, Any]] = {}
    all_models: set[str] = set()
    for evt in events:
        node_key = evt.run_id or str(evt.id)
        if node_key not in node_map:
            node_map[node_key] = {
                "id": node_key,
                "label": evt.model,
                "provider": evt.provider,
                "model": evt.model,
                "node_type": "generation",
                "name": evt.model,
                "total_tokens": 0,
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "estimated_cost_usd": 0.0,
                "latency_ms": 0,
                "feature": evt.feature,
                "finish_reason": evt.finish_reason,
                "occurred_at": evt.occurred_at,
                "event_count": 0,
                "run_id": evt.run_id,
                "parent_run_id": evt.parent_run_id,
                "status": "ok",
                "level": 0,
            }
        node = node_map[node_key]
        node["total_tokens"] += evt.total_tokens or 0
        node["prompt_tokens"] += evt.prompt_tokens or 0
        node["completion_tokens"] += evt.completion_tokens or 0
        node["estimated_cost_usd"] += float(evt.estimated_cost_usd or 0)
        node["latency_ms"] += evt.latency_ms or 0
        node["event_count"] += 1
        all_models.add(evt.model)
        if evt.occurred_at < node["occurred_at"]:
            node["occurred_at"] = evt.occurred_at
        if evt.parent_run_id and not node["parent_run_id"]:
            node["parent_run_id"] = evt.parent_run_id

    nodes = [TraceGraphNode(**node) for node in node_map.values()]
    node_ids = set(node_map.keys())
    edges = [
        TraceGraphEdge(source=node["parent_run_id"], target=node["id"])
        for node in node_map.values()
        if node["parent_run_id"] and node["parent_run_id"] in node_ids
    ]
    times = [node.occurred_at for node in nodes]
    summary = TraceGraphSummary(
        total_cost=sum(node.estimated_cost_usd for node in nodes),
        total_tokens=sum(node.total_tokens for node in nodes),
        total_latency_ms=sum(node.latency_ms for node in nodes),
        event_count=sum(node.event_count for node in nodes),
        distinct_models=sorted(all_models),
        time_range=[min(times), max(times)] if times else [],
    )
    return TraceGraphResponse(
        session_id=session_id,
        trace_id=session_id,
        name="Ungrouped Session" if session_id == UNGROUPED_SESSION else session_id,
        status="completed",
        nodes=nodes,
        edges=edges,
        summary=summary,
    )
