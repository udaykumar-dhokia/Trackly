"""
Trace / session graph endpoints.

Reconstructs agent execution graphs from run_id / parent_run_id
relationships stored in llm_events.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select, distinct
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import LlmEvent
from app.services.project_access import require_project_access_by_auth0_id

router = APIRouter()

class SessionSummary(BaseModel):
    session_id: str
    event_count: int
    total_cost: float
    total_tokens: int
    total_latency_ms: int
    distinct_models: list[str]
    first_event: datetime
    last_event: datetime

class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]
    total: int


class TraceNode(BaseModel):
    id: str
    label: str
    provider: str
    model: str
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float
    latency_ms: int
    feature: str | None
    finish_reason: str | None
    occurred_at: datetime
    event_count: int
    run_id: str | None
    parent_run_id: str | None


class TraceEdge(BaseModel):
    source: str
    target: str


class TraceSummary(BaseModel):
    total_cost: float
    total_tokens: int
    total_latency_ms: int
    event_count: int
    distinct_models: list[str]
    time_range: list[datetime]


class TraceGraphResponse(BaseModel):
    session_id: str
    nodes: list[TraceNode]
    edges: list[TraceEdge]
    summary: TraceSummary


UNGROUPED_SESSION = "__ungrouped__"


@router.get(
    "/projects/{project_id}/traces/sessions",
    response_model=SessionListResponse,
    summary="List trace sessions for a project",
)
async def list_trace_sessions(
    project_id: uuid.UUID,
    auth0_id: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> SessionListResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    session_col = func.coalesce(LlmEvent.session_id, UNGROUPED_SESSION).label(
        "session_key"
    )

    count_stmt = (
        select(func.count(distinct(session_col)))
        .where(LlmEvent.project_id == project_id)
    )
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(
            session_col,
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label(
                "total_cost"
            ),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.latency_ms), 0).label(
                "total_latency_ms"
            ),
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

    sessions = [
        SessionSummary(
            session_id=row.session_key,
            event_count=row.event_count,
            total_cost=float(row.total_cost or 0),
            total_tokens=int(row.total_tokens or 0),
            total_latency_ms=int(row.total_latency_ms or 0),
            distinct_models=[m for m in (row.distinct_models or []) if m],
            first_event=row.first_event,
            last_event=row.last_event,
        )
        for row in rows
    ]

    return SessionListResponse(sessions=sessions, total=total)


@router.get(
    "/projects/{project_id}/traces/graph",
    response_model=TraceGraphResponse,
    summary="Get trace graph data for a session",
)
async def get_trace_graph(
    project_id: uuid.UUID,
    auth0_id: str,
    session_id: str = Query(..., description="Session ID to visualise"),
    db: AsyncSession = Depends(get_db),
) -> TraceGraphResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    if session_id == UNGROUPED_SESSION:
        session_filter = LlmEvent.session_id.is_(None)
    else:
        session_filter = LlmEvent.session_id == session_id

    stmt = (
        select(LlmEvent)
        .where(LlmEvent.project_id == project_id, session_filter)
        .order_by(LlmEvent.occurred_at.asc())
    )

    result = await db.execute(stmt)
    events = result.scalars().all()

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

    nodes = [TraceNode(**data) for data in node_map.values()]

    node_ids = set(node_map.keys())
    edges: list[TraceEdge] = []
    for data in node_map.values():
        if data["parent_run_id"] and data["parent_run_id"] in node_ids:
            edges.append(
                TraceEdge(source=data["parent_run_id"], target=data["id"])
            )

    total_cost = sum(n.estimated_cost_usd for n in nodes)
    total_tokens = sum(n.total_tokens for n in nodes)
    total_latency = sum(n.latency_ms for n in nodes)
    event_count = sum(n.event_count for n in nodes)
    times = [n.occurred_at for n in nodes]

    summary = TraceSummary(
        total_cost=total_cost,
        total_tokens=total_tokens,
        total_latency_ms=total_latency,
        event_count=event_count,
        distinct_models=sorted(all_models),
        time_range=[min(times), max(times)] if times else [],
    )

    return TraceGraphResponse(
        session_id=session_id,
        nodes=nodes,
        edges=edges,
        summary=summary,
    )
