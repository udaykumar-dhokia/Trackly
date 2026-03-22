from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import LlmEvent
from app.models.schemas import (
    DailyUsage,
    UsageByFeature,
    UsageByModel,
    UsageSummary,
)

router = APIRouter()


def _default_window() -> tuple[datetime, datetime]:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    return start, end


@router.get(
    "/projects/{project_id}/stats/summary",
    response_model=UsageSummary,
    summary="Aggregate stats for a project over a time window",
)
async def get_summary(
    project_id: uuid.UUID,
    provider: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> UsageSummary:
    period_start, period_end = _resolve_window(start, end)

    filters = [
        LlmEvent.project_id == project_id,
        LlmEvent.occurred_at >= period_start,
        LlmEvent.occurred_at < period_end,
    ]
    if provider:
        filters.append(LlmEvent.provider == provider)

    stmt = (
        select(
            func.count(LlmEvent.id).label("total_events"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
            func.avg(LlmEvent.latency_ms).label("avg_latency"),
        )
        .where(*filters)
    )
    result = await db.execute(stmt)
    row = result.one()

    return UsageSummary(
        total_events=row.total_events,
        total_tokens=row.total_tokens,
        total_cost_usd=float(row.total_cost),
        avg_latency_ms=float(row.avg_latency) if row.avg_latency else None,
        period_start=period_start,
        period_end=period_end,
    )


@router.get(
    "/projects/{project_id}/stats/by-model",
    response_model=list[UsageByModel],
    summary="Usage broken down by model",
)
async def get_by_model(
    project_id: uuid.UUID,
    provider: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[UsageByModel]:
    period_start, period_end = _resolve_window(start, end)

    filters = [
        LlmEvent.project_id == project_id,
        LlmEvent.occurred_at >= period_start,
        LlmEvent.occurred_at < period_end,
    ]
    if provider:
        filters.append(LlmEvent.provider == provider)

    stmt = (
        select(
            LlmEvent.model,
            LlmEvent.provider,
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
            func.avg(LlmEvent.latency_ms).label("avg_latency"),
        )
        .where(*filters)
        .group_by(LlmEvent.model, LlmEvent.provider)
        .order_by(text("total_cost DESC"))
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        UsageByModel(
            model=r.model,
            provider=r.provider,
            event_count=r.event_count,
            total_tokens=r.total_tokens,
            total_cost_usd=float(r.total_cost),
            avg_latency_ms=float(r.avg_latency) if r.avg_latency else None,
        )
        for r in rows
    ]


@router.get(
    "/projects/{project_id}/stats/by-feature",
    response_model=list[UsageByFeature],
    summary="Usage broken down by feature tag",
)
async def get_by_feature(
    project_id: uuid.UUID,
    provider: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[UsageByFeature]:
    period_start, period_end = _resolve_window(start, end)

    filters = [
        LlmEvent.project_id == project_id,
        LlmEvent.occurred_at >= period_start,
        LlmEvent.occurred_at < period_end,
    ]
    if provider:
        filters.append(LlmEvent.provider == provider)

    stmt = (
        select(
            LlmEvent.feature,
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
        )
        .where(*filters)
        .group_by(LlmEvent.feature)
        .order_by(text("total_cost DESC"))
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        UsageByFeature(
            feature=r.feature,
            event_count=r.event_count,
            total_tokens=r.total_tokens,
            total_cost_usd=float(r.total_cost),
        )
        for r in rows
    ]


@router.get(
    "/projects/{project_id}/stats/daily",
    response_model=list[DailyUsage],
    summary="Daily usage for charting — one row per calendar day",
)
async def get_daily(
    project_id: uuid.UUID,
    provider: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[DailyUsage]:
    period_start, period_end = _resolve_window(start, end)

    filters = [
        LlmEvent.project_id == project_id,
        LlmEvent.occurred_at >= period_start,
        LlmEvent.occurred_at < period_end,
    ]
    if provider:
        filters.append(LlmEvent.provider == provider)

    # date_trunc to bucket by day in UTC
    stmt = (
        select(
            func.date_trunc("day", LlmEvent.occurred_at).label("day"),
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
        )
        .where(*filters)
        .group_by(text("day"))
        .order_by(text("day ASC"))
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        DailyUsage(
            date=r.day.strftime("%Y-%m-%d"),
            event_count=r.event_count,
            total_tokens=r.total_tokens,
            total_cost_usd=float(r.total_cost),
        )
        for r in rows
    ]


def _resolve_window(
    start: datetime | None,
    end: datetime | None,
) -> tuple[datetime, datetime]:
    default_start, default_end = _default_window()
    return (start or default_start), (end or default_end)
