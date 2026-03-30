from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request, Response
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.orm import ApiKey, LlmEvent, User
from app.models.schemas import (
    DailyUsage,
    FeaturedUser,
    GlobalStats,
    UsageByFeature,
    UsageByModel,
    UsageSummary,
)
from app.services.cache import LANDING_USERS_CACHE_KEY, get_cache_json, set_cache_json
from app.services.event_filters import (
    ProjectEventFilters,
    build_project_event_filters,
    project_filters_need_api_key_join,
)
from app.services.export import render_csv, render_professional_pdf
from app.services.project_access import require_project_access_by_auth0_id
from app.services.rate_limit import limiter

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
    auth0_id: str,
    provider: str | None = Query(default=None),
    model: str | None = Query(default=None),
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    api_key_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> UsageSummary:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    params = _build_stats_filters(
        provider=provider,
        model=model,
        feature=feature,
        user_id=user_id,
        api_key_id=api_key_id,
        start=start,
        end=end,
    )
    period_start, period_end = _resolve_window(start, end)
    params.start = period_start
    params.end = period_end
    return await _query_summary(db, project_id, params)


@router.get(
    "/projects/{project_id}/stats/by-model",
    response_model=list[UsageByModel],
    summary="Usage broken down by model",
)
async def get_by_model(
    project_id: uuid.UUID,
    auth0_id: str,
    provider: str | None = Query(default=None),
    model: str | None = Query(default=None),
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    api_key_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[UsageByModel]:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    params = _build_stats_filters(
        provider=provider,
        model=model,
        feature=feature,
        user_id=user_id,
        api_key_id=api_key_id,
        start=start,
        end=end,
    )
    period_start, period_end = _resolve_window(start, end)
    params.start = period_start
    params.end = period_end
    return await _query_by_model(db, project_id, params)


@router.get(
    "/projects/{project_id}/stats/by-feature",
    response_model=list[UsageByFeature],
    summary="Usage broken down by feature tag",
)
async def get_by_feature(
    project_id: uuid.UUID,
    auth0_id: str,
    provider: str | None = Query(default=None),
    model: str | None = Query(default=None),
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    api_key_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[UsageByFeature]:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    params = _build_stats_filters(
        provider=provider,
        model=model,
        feature=feature,
        user_id=user_id,
        api_key_id=api_key_id,
        start=start,
        end=end,
    )
    period_start, period_end = _resolve_window(start, end)
    params.start = period_start
    params.end = period_end
    return await _query_by_feature(db, project_id, params)


@router.get(
    "/projects/{project_id}/stats/daily",
    response_model=list[DailyUsage],
    summary="Daily usage for charting - one row per calendar day",
)
async def get_daily(
    project_id: uuid.UUID,
    auth0_id: str,
    provider: str | None = Query(default=None),
    model: str | None = Query(default=None),
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    api_key_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[DailyUsage]:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    params = _build_stats_filters(
        provider=provider,
        model=model,
        feature=feature,
        user_id=user_id,
        api_key_id=api_key_id,
        start=start,
        end=end,
    )
    period_start, period_end = _resolve_window(start, end)
    params.start = period_start
    params.end = period_end
    return await _query_daily(db, project_id, params)


@router.get(
    "/projects/{project_id}/stats/export",
    summary="Export filtered analytics as CSV or PDF",
)
async def export_stats(
    project_id: uuid.UUID,
    auth0_id: str,
    format: str = Query(default="csv", pattern="^(csv|pdf)$"),
    provider: str | None = Query(default=None),
    model: str | None = Query(default=None),
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    api_key_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    params = _build_stats_filters(
        provider=provider,
        model=model,
        feature=feature,
        user_id=user_id,
        api_key_id=api_key_id,
        start=start,
        end=end,
    )
    period_start, period_end = _resolve_window(start, end)
    params.start = period_start
    params.end = period_end

    summary = await _query_summary(db, project_id, params)
    by_model = await _query_by_model(db, project_id, params)
    by_feature = await _query_by_feature(db, project_id, params)
    daily = await _query_daily(db, project_id, params)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    if format == "pdf":
        metadata = _format_filter_metadata(params)
        tables = _build_stats_pdf_tables(summary, by_model, by_feature, daily)
        return Response(
            content=render_professional_pdf(
                title="Analytics Report",
                subtitle=f"Project: {project_id}",
                metadata=metadata,
                tables=tables,
            ),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="trackly-analytics-{timestamp}.pdf"'
            },
        )

    rows = [
        ["summary"],
        ["metric", "value"],
        ["total_events", summary.total_events],
        ["total_tokens", summary.total_tokens],
        ["total_cost_usd", summary.total_cost_usd],
        ["avg_latency_ms", summary.avg_latency_ms],
        ["period_start", summary.period_start.isoformat()],
        ["period_end", summary.period_end.isoformat()],
        [],
        ["by_model"],
        ["provider", "model", "event_count", "total_tokens", "total_cost_usd", "avg_latency_ms"],
    ]
    rows.extend(
        [
            [row.provider, row.model, row.event_count, row.total_tokens, row.total_cost_usd, row.avg_latency_ms]
            for row in by_model
        ]
    )
    rows.extend(
        [
            [],
            ["by_feature"],
            ["feature", "event_count", "total_tokens", "total_cost_usd"],
        ]
    )
    rows.extend(
        [[row.feature, row.event_count, row.total_tokens, row.total_cost_usd] for row in by_feature]
    )
    rows.extend(
        [
            [],
            ["daily"],
            ["date", "event_count", "total_tokens", "total_cost_usd"],
        ]
    )
    rows.extend([[row.date, row.event_count, row.total_tokens, row.total_cost_usd] for row in daily])

    return Response(
        content=render_csv(rows),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="trackly-analytics-{timestamp}.csv"'
        },
    )


@router.get(
    "/stats/global",
    response_model=GlobalStats,
    summary="Get global platform stats for hero section",
)
@limiter.limit("30/minute")
async def get_global_stats(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> GlobalStats:
    # Events and Tokens
    stmt = select(
        func.count(LlmEvent.id).label("total_events"),
        func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
    )
    result = await db.execute(stmt)
    row = result.one()

    cached_users_payload = await get_cache_json(LANDING_USERS_CACHE_KEY)
    total_users: int | None = None
    featured_users: list[FeaturedUser] = []

    if isinstance(cached_users_payload, dict):
        try:
            total_users = int(cached_users_payload["total_users"])
            featured_users = [
                FeaturedUser.model_validate(user)
                for user in cached_users_payload.get("featured_users", [])
            ]
        except (KeyError, TypeError, ValueError):
            total_users = None
            featured_users = []

    if total_users is None:
        user_count_stmt = select(func.count(User.id))
        total_users = await db.scalar(user_count_stmt)

        users_stmt = (
            select(User.name, User.email, User.profile_photo)
            .order_by(func.random() if total_users > 10 else User.created_at.desc())
            .limit(10)
        )
        users_result = await db.execute(users_stmt)
        featured_users = [
            FeaturedUser(name=r.name, email=r.email, profile_photo=r.profile_photo)
            for r in users_result.all()
        ]
        await set_cache_json(
            LANDING_USERS_CACHE_KEY,
            {
                "total_users": total_users or 0,
                "featured_users": [user.model_dump(mode="json") for user in featured_users],
            },
            settings.landing_users_cache_ttl_seconds,
        )

    return GlobalStats(
        total_events=row.total_events,
        total_tokens=row.total_tokens,
        total_users=total_users or 0,
        featured_users=featured_users,
    )


def _resolve_window(
    start: datetime | None,
    end: datetime | None,
) -> tuple[datetime, datetime]:
    default_start, default_end = _default_window()
    return (start or default_start), (end or default_end)


def _build_stats_filters(**kwargs) -> ProjectEventFilters:
    return ProjectEventFilters(**kwargs)


async def _query_summary(
    db: AsyncSession,
    project_id: uuid.UUID,
    params: ProjectEventFilters,
) -> UsageSummary:
    filters = await build_project_event_filters(db, project_id, params)
    stmt = select(
        func.count(LlmEvent.id).label("total_events"),
        func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
        func.avg(LlmEvent.latency_ms).label("avg_latency"),
    )
    if project_filters_need_api_key_join(params):
        stmt = stmt.outerjoin(ApiKey, LlmEvent.api_key_id == ApiKey.id)
    stmt = stmt.where(*filters)
    row = (await db.execute(stmt)).one()
    return UsageSummary(
        total_events=row.total_events,
        total_tokens=row.total_tokens,
        total_cost_usd=float(row.total_cost),
        avg_latency_ms=float(row.avg_latency) if row.avg_latency else None,
        period_start=params.start,
        period_end=params.end,
    )


async def _query_by_model(
    db: AsyncSession,
    project_id: uuid.UUID,
    params: ProjectEventFilters,
) -> list[UsageByModel]:
    filters = await build_project_event_filters(db, project_id, params)
    stmt = select(
        LlmEvent.model,
        LlmEvent.provider,
        func.count(LlmEvent.id).label("event_count"),
        func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
        func.avg(LlmEvent.latency_ms).label("avg_latency"),
    )
    if project_filters_need_api_key_join(params):
        stmt = stmt.outerjoin(ApiKey, LlmEvent.api_key_id == ApiKey.id)
    stmt = (
        stmt.where(*filters)
        .group_by(LlmEvent.model, LlmEvent.provider)
        .order_by(text("total_cost DESC"))
    )
    rows = (await db.execute(stmt)).all()
    return [
        UsageByModel(
            model=row.model,
            provider=row.provider,
            event_count=row.event_count,
            total_tokens=row.total_tokens,
            total_cost_usd=float(row.total_cost),
            avg_latency_ms=float(row.avg_latency) if row.avg_latency else None,
        )
        for row in rows
    ]


async def _query_by_feature(
    db: AsyncSession,
    project_id: uuid.UUID,
    params: ProjectEventFilters,
) -> list[UsageByFeature]:
    filters = await build_project_event_filters(db, project_id, params)
    stmt = select(
        LlmEvent.feature,
        func.count(LlmEvent.id).label("event_count"),
        func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
    )
    if project_filters_need_api_key_join(params):
        stmt = stmt.outerjoin(ApiKey, LlmEvent.api_key_id == ApiKey.id)
    stmt = (
        stmt.where(*filters)
        .group_by(LlmEvent.feature)
        .order_by(text("total_cost DESC"))
    )
    rows = (await db.execute(stmt)).all()
    return [
        UsageByFeature(
            feature=row.feature,
            event_count=row.event_count,
            total_tokens=row.total_tokens,
            total_cost_usd=float(row.total_cost),
        )
        for row in rows
    ]


async def _query_daily(
    db: AsyncSession,
    project_id: uuid.UUID,
    params: ProjectEventFilters,
) -> list[DailyUsage]:
    filters = await build_project_event_filters(db, project_id, params)
    stmt = select(
        func.date_trunc("day", LlmEvent.occurred_at).label("day"),
        func.count(LlmEvent.id).label("event_count"),
        func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0.0).label("total_cost"),
    )
    if project_filters_need_api_key_join(params):
        stmt = stmt.outerjoin(ApiKey, LlmEvent.api_key_id == ApiKey.id)
    stmt = (
        stmt.where(*filters)
        .group_by(text("day"))
        .order_by(text("day ASC"))
    )
    rows = (await db.execute(stmt)).all()
    return [
        DailyUsage(
            date=row.day.strftime("%Y-%m-%d"),
            event_count=row.event_count,
            total_tokens=row.total_tokens,
            total_cost_usd=float(row.total_cost),
        )
        for row in rows
    ]


def _build_stats_pdf_tables(
    summary: UsageSummary,
    by_model: list[UsageByModel],
    by_feature: list[UsageByFeature],
    daily: list[DailyUsage],
) -> list[dict[str, Any]]:
    from reportlab.lib.units import inch
    
    # 1. Summary Table
    summary_table = {
        "title": "Summary Metrics",
        "headers": ["Metric", "Value"],
        "rows": [
            ["Total Events", str(summary.total_events)],
            ["Total Tokens", str(summary.total_tokens)],
            ["Total Cost", f"${summary.total_cost_usd:.6f}"],
            ["Avg Latency", f"{summary.avg_latency_ms:.2f} ms" if summary.avg_latency_ms else "n/a"]
        ],
        "col_widths": [2.5 * inch, 2.5 * inch]
    }
    
    # 2. By Model
    model_rows = []
    for row in by_model:
        model_rows.append([
            row.provider or "-",
            row.model or "-",
            str(row.event_count),
            str(row.total_tokens),
            f"${row.total_cost_usd:.6f}"
        ])
    model_table = {
        "title": "Usage by Model",
        "headers": ["Provider", "Model", "Events", "Tokens", "Cost"],
        "rows": model_rows
    }
    
    # 3. By Feature
    feature_rows = []
    for row in by_feature:
        feature_rows.append([
            row.feature or "-",
            str(row.event_count),
            str(row.total_tokens),
            f"${row.total_cost_usd:.6f}"
        ])
    feature_table = {
        "title": "Usage by Feature",
        "headers": ["Feature", "Events", "Tokens", "Cost"],
        "rows": feature_rows
    }
    
    # 4. Daily
    daily_rows = []
    for row in daily:
        daily_rows.append([
            row.date,
            str(row.event_count),
            str(row.total_tokens),
            f"${row.total_cost_usd:.6f}"
        ])
    daily_table = {
        "title": "Daily Breakdown",
        "headers": ["Date", "Events", "Tokens", "Cost"],
        "rows": daily_rows
    }
    
    return [summary_table, model_table, feature_table, daily_table]


def _format_filter_metadata(params: ProjectEventFilters) -> list[tuple[str, str]]:
    meta = [("Generated at", datetime.now(timezone.utc).isoformat())]
    if params.provider:
        meta.append(("Provider", params.provider))
    if params.model:
        meta.append(("Model", params.model))
    if params.feature:
        meta.append(("Feature", params.feature))
    if params.user_id:
        meta.append(("User", params.user_id))
    if params.api_key_id:
        meta.append(("API Key", str(params.api_key_id)))
    if params.start:
        meta.append(("Start Range", params.start.isoformat()))
    if params.end:
        meta.append(("End Range", params.end.isoformat()))
    return meta



