from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import ApiKey, LlmEvent, User
from app.services.event_filters import (
    ProjectEventFilters,
    build_project_event_filters,
    build_user_join_condition,
    project_filters_need_api_key_join,
)
from app.services.export import render_csv, render_professional_pdf
from app.services.project_access import require_project_access_by_auth0_id

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
    user_name: str | None = None
    user_photo: str | None = None
    api_key_id: uuid.UUID | None = None
    parent_api_key_id: uuid.UUID | None = None

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
    auth0_id: str,
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    model: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    api_key_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> PaginatedEvents:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    params = ProjectEventFilters(
        feature=feature,
        user_id=user_id,
        model=model,
        provider=provider,
        api_key_id=api_key_id,
        start=start,
        end=end,
    )
    filters = await build_project_event_filters(db, project_id, params)

    count_stmt = select(func.count(LlmEvent.id))
    if project_filters_need_api_key_join(params):
        count_stmt = count_stmt.outerjoin(ApiKey, LlmEvent.api_key_id == ApiKey.id)
    count_stmt = count_stmt.where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    offset = (page - 1) * page_size
    items = await _query_event_rows(
        db=db,
        filters=filters,
        offset=offset,
        limit=page_size,
    )

    return PaginatedEvents(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=(offset + len(items)) < total,
    )


@router.get(
    "/projects/{project_id}/events/export",
    summary="Export filtered project events as CSV or PDF",
)
async def export_events(
    project_id: uuid.UUID,
    auth0_id: str,
    format: str = Query(default="csv", pattern="^(csv|pdf)$"),
    feature: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    model: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    api_key_id: uuid.UUID | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)
    params = ProjectEventFilters(
        feature=feature,
        user_id=user_id,
        model=model,
        provider=provider,
        api_key_id=api_key_id,
        start=start,
        end=end,
    )
    filters = await build_project_event_filters(db, project_id, params)
    items = await _query_event_rows(db=db, filters=filters)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    if format == "pdf":
        metadata = _format_filter_metadata(params)
        table_data = _build_event_pdf_table(items)
        return Response(
            content=render_professional_pdf(
                title="Event Export",
                subtitle=f"Project: {project_id}",
                metadata=metadata,
                tables=[table_data],
                orientation="landscape",
            ),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="trackly-events-{timestamp}.pdf"'
            },
        )

    csv_rows = [
        [
            "occurred_at_utc",
            "provider",
            "model",
            "prompt_tokens",
            "completion_tokens",
            "total_tokens",
            "estimated_cost_usd",
            "latency_ms",
            "finish_reason",
            "feature",
            "user_id",
            "user_name",
            "session_id",
            "run_id",
            "tags",
            "api_key_id",
            "parent_api_key_id",
            "ingested_at_utc",
        ]
    ]
    for item in items:
        csv_rows.append(
            [
                item.occurred_at.isoformat(),
                item.provider,
                item.model,
                item.prompt_tokens,
                item.completion_tokens,
                item.total_tokens,
                item.estimated_cost_usd,
                item.latency_ms,
                item.finish_reason,
                item.feature,
                item.user_id,
                item.user_name,
                item.session_id,
                item.run_id,
                ",".join(item.tags or []),
                item.api_key_id,
                item.parent_api_key_id,
                item.ingested_at.isoformat(),
            ]
        )

    return Response(
        content=render_csv(csv_rows),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="trackly-events-{timestamp}.csv"'
        },
    )


async def _query_event_rows(
    *,
    db: AsyncSession,
    filters,
    offset: int = 0,
    limit: int | None = None,
) -> list[EventResponse]:
    stmt = (
        select(
            LlmEvent,
            User.name.label("user_name"),
            User.profile_photo.label("user_photo"),
        )
        .outerjoin(ApiKey, LlmEvent.api_key_id == ApiKey.id)
        .outerjoin(User, build_user_join_condition())
        .where(*filters)
        .order_by(LlmEvent.occurred_at.desc())
    )
    if offset:
        stmt = stmt.offset(offset)
    if limit is not None:
        stmt = stmt.limit(limit)

    result = await db.execute(stmt)
    items: list[EventResponse] = []
    rows = result.all()
    if isinstance(rows, list):
        for row in rows:
            event = row[0]
            event_dict = {column.name: getattr(event, column.name) for column in LlmEvent.__table__.columns}
            event_dict["user_name"] = row.user_name
            event_dict["user_photo"] = row.user_photo
            event_dict["api_key_id"] = _uuid_or_none(event_dict.get("api_key_id"))
            event_dict["parent_api_key_id"] = _uuid_or_none(event_dict.get("parent_api_key_id"))
            items.append(EventResponse.model_validate(event_dict))
        return items

    # Test doubles in the existing suite still mock `scalars().all()`.
    for event in result.scalars().all():
        event_dict = {column.name: getattr(event, column.name) for column in LlmEvent.__table__.columns}
        event_dict["user_name"] = None
        event_dict["user_photo"] = None
        event_dict["api_key_id"] = _uuid_or_none(event_dict.get("api_key_id"))
        event_dict["parent_api_key_id"] = _uuid_or_none(event_dict.get("parent_api_key_id"))
        items.append(EventResponse.model_validate(event_dict))
    return items


def _build_event_pdf_table(items: list[EventResponse]) -> dict[str, Any]:
    from reportlab.lib.units import inch
    
    headers = ["Time (UTC)", "Provider", "Model", "Tokens", "Cost", "Latency", "Feature", "User"]
    rows = []
    for item in items:
        rows.append([
            item.occurred_at.strftime("%Y-%m-%d %H:%M"),
            item.provider or "-",
            item.model or "-",
            str(item.total_tokens or 0),
            f"${(item.estimated_cost_usd or 0):.6f}",
            f"{item.latency_ms}ms" if item.latency_ms is not None else "-",
            item.feature or "-",
            item.user_name or item.user_id or "-"
        ])
    
    # Landscape A4 is approx 11.7 inches. 
    # Left/Right margins total ~1.1 inch -> ~10.6 available.
    return {
        "title": f"Events ({len(items)} rows)",
        "headers": headers,
        "rows": rows,
        "col_widths": [1.4*inch, 0.8*inch, 2.2*inch, 0.8*inch, 1.0*inch, 0.8*inch, 1.4*inch, 2.0*inch]
    }


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


def _uuid_or_none(value):
    return value if isinstance(value, uuid.UUID) else None
