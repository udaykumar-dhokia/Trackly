from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import LlmEvent

router = APIRouter()


class EventResponse(BaseModel):
    id: uuid.UUID
    provider: str
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    estimated_cost_usd: float | None
    latency_ms: int | None
    finish_reason: str | None
    feature: str | None
    user_id: str | None
    session_id: str | None
    run_id: str | None
    tags: list | None
    occurred_at: datetime
    ingested_at: datetime

    model_config = {"from_attributes": True}


class PaginatedEvents(BaseModel):
    items: list[EventResponse]
    total: int
    page: int
    page_size: int
    has_more: bool


@router.get(
    "/projects/{project_id}/events",
    response_model=PaginatedEvents,
    summary="List raw events for a project with filtering",
)
async def list_events(
    project_id: uuid.UUID,
    # Filters
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    model: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    # Pagination
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEvents:
    filters = [LlmEvent.project_id == project_id]

    if feature:
        filters.append(LlmEvent.feature == feature)
    if user_id:
        filters.append(LlmEvent.user_id == user_id)
    if model:
        filters.append(LlmEvent.model == model)
    if provider:
        filters.append(LlmEvent.provider == provider)
    if start:
        filters.append(LlmEvent.occurred_at >= start)
    if end:
        filters.append(LlmEvent.occurred_at < end)

    # Total count
    count_stmt = select(func.count(LlmEvent.id)).where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    # Page of results — newest first
    offset = (page - 1) * page_size
    stmt = (
        select(LlmEvent)
        .where(*filters)
        .order_by(LlmEvent.occurred_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    return PaginatedEvents(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(items)) < total,
    )
