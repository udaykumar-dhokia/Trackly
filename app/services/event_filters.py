from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.elements import ColumnElement

from app.models.orm import ApiKey, LlmEvent, User


@dataclass(slots=True)
class ProjectEventFilters:
    provider: str | None = None
    model: str | None = None
    feature: str | None = None
    user_id: str | None = None
    api_key_id: uuid.UUID | None = None
    start: datetime | None = None
    end: datetime | None = None


async def build_project_event_filters(
    db: AsyncSession,
    project_id: uuid.UUID,
    params: ProjectEventFilters,
) -> list[ColumnElement[bool]]:
    filters: list[ColumnElement[bool]] = [LlmEvent.project_id == project_id]

    if params.feature:
        filters.append(LlmEvent.feature == params.feature)
    if params.model:
        filters.append(LlmEvent.model == params.model)
    if params.provider:
        filters.append(LlmEvent.provider == params.provider)
    if params.api_key_id:
        filters.append(
            or_(
                LlmEvent.api_key_id == params.api_key_id,
                LlmEvent.parent_api_key_id == params.api_key_id,
            )
        )
    if params.start:
        filters.append(LlmEvent.occurred_at >= params.start)
    if params.end:
        filters.append(LlmEvent.occurred_at < params.end)
    if params.user_id:
        filters.append(await _resolve_user_filter(db, params.user_id))

    return filters


def project_filters_need_api_key_join(params: ProjectEventFilters) -> bool:
    return bool(params.user_id)


def build_user_join_condition() -> ColumnElement[bool]:
    return or_(
        LlmEvent.user_id == User.auth0_id,
        LlmEvent.user_id == cast(User.id, String),
    )


async def _resolve_user_filter(
    db: AsyncSession,
    user_ref: str,
) -> ColumnElement[bool]:
    try:
        user_uuid = uuid.UUID(user_ref)
    except ValueError:
        return LlmEvent.user_id == user_ref

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None:
        return LlmEvent.user_id == user_ref

    return or_(
        LlmEvent.user_id == str(user.id),
        LlmEvent.user_id == user.auth0_id,
        ApiKey.created_by_user_id == user.id,
    )
