from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import String, cast, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.orm import (
    ApiKey,
    LlmEvent,
    Organization,
    OrganizationMember,
    Project,
    ProjectMember,
    User,
)


router = APIRouter(prefix="/admin")
bearer_scheme = HTTPBearer(auto_error=False)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _window_start(days: int) -> datetime:
    return _utc_now() - timedelta(days=days)


async def require_admin_access(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    if not settings.admin_api_token:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin API is disabled. Set ADMIN_API_TOKEN to enable it.",
        )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing admin bearer token.",
        )

    if not secrets.compare_digest(credentials.credentials, settings.admin_api_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin bearer token.",
        )


class AdminPaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    has_more: bool


class AdminRecentUser(BaseModel):
    id: uuid.UUID
    auth0_id: str
    email: str
    name: str | None
    profile_photo: str | None
    created_at: datetime


class AdminRecentOrganization(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    created_at: datetime


class AdminRecentProject(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    org_name: str
    name: str
    environment: str | None
    created_at: datetime


class AdminDailyUsage(BaseModel):
    date: str
    total_events: int
    total_tokens: int
    total_cost_usd: float


class AdminProviderBreakdown(BaseModel):
    provider: str
    total_events: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float | None


class AdminRecentEvent(BaseModel):
    id: uuid.UUID
    occurred_at: datetime
    ingested_at: datetime
    provider: str
    model: str
    feature: str | None
    user_id: str | None
    user_name: str | None
    user_email: str | None
    project_id: uuid.UUID
    project_name: str
    org_id: uuid.UUID
    org_name: str
    estimated_cost_usd: float | None
    total_tokens: int | None
    latency_ms: int | None
    key_prefix: str | None


class AdminOverviewResponse(BaseModel):
    total_users: int
    total_organizations: int
    total_projects: int
    total_api_keys: int
    total_events: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float | None
    period_days: int
    recent_users: list[AdminRecentUser]
    recent_organizations: list[AdminRecentOrganization]
    recent_projects: list[AdminRecentProject]
    recent_events: list[AdminRecentEvent]
    daily_usage: list[AdminDailyUsage]
    provider_breakdown: list[AdminProviderBreakdown]


class AdminUserRow(BaseModel):
    id: uuid.UUID
    auth0_id: str
    email: str
    name: str | None
    profile_photo: str | None
    created_at: datetime
    organization_count: int
    project_count: int
    api_key_count: int
    event_count: int
    total_cost_usd: float
    last_seen_at: datetime | None


class AdminUsersResponse(AdminPaginatedResponse):
    items: list[AdminUserRow]


class AdminOrganizationRow(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str
    created_at: datetime
    member_count: int
    project_count: int
    api_key_count: int
    event_count: int
    total_cost_usd: float
    last_activity_at: datetime | None


class AdminOrganizationsResponse(AdminPaginatedResponse):
    items: list[AdminOrganizationRow]


class AdminProjectRow(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    org_name: str
    name: str
    environment: str | None
    created_at: datetime
    member_count: int
    api_key_count: int
    event_count: int
    total_cost_usd: float
    last_activity_at: datetime | None


class AdminProjectsResponse(AdminPaginatedResponse):
    items: list[AdminProjectRow]


class AdminEventRow(BaseModel):
    id: uuid.UUID
    occurred_at: datetime
    ingested_at: datetime
    provider: str
    model: str
    feature: str | None
    finish_reason: str | None
    user_id: str | None
    user_name: str | None
    user_email: str | None
    session_id: str | None
    project_id: uuid.UUID
    project_name: str
    org_id: uuid.UUID
    org_name: str
    api_key_id: uuid.UUID | None
    parent_api_key_id: uuid.UUID | None
    key_prefix: str | None
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    estimated_cost_usd: float | None
    latency_ms: int | None


class AdminEventsResponse(AdminPaginatedResponse):
    items: list[AdminEventRow]


def _has_more(page: int, page_size: int, total: int) -> bool:
    return page * page_size < total


def _float_or_zero(value: object | None) -> float:
    return float(value or 0)


def _event_base_query():
    return (
        select(
            LlmEvent.id,
            LlmEvent.occurred_at,
            LlmEvent.ingested_at,
            LlmEvent.provider,
            LlmEvent.model,
            LlmEvent.feature,
            LlmEvent.finish_reason,
            LlmEvent.user_id,
            User.name.label("user_name"),
            User.email.label("user_email"),
            LlmEvent.session_id,
            Project.id.label("project_id"),
            Project.name.label("project_name"),
            Organization.id.label("org_id"),
            Organization.name.label("org_name"),
            LlmEvent.api_key_id,
            LlmEvent.parent_api_key_id,
            ApiKey.key_prefix.label("key_prefix"),
            LlmEvent.prompt_tokens,
            LlmEvent.completion_tokens,
            LlmEvent.total_tokens,
            LlmEvent.estimated_cost_usd,
            LlmEvent.latency_ms,
        )
        .select_from(LlmEvent)
        .join(Project, LlmEvent.project_id == Project.id)
        .join(Organization, Project.org_id == Organization.id)
        .outerjoin(ApiKey, LlmEvent.api_key_id == ApiKey.id)
        .outerjoin(
            User,
            or_(
                LlmEvent.user_id == User.auth0_id,
                LlmEvent.user_id == cast(User.id, String),
            ),
        )
    )


def _apply_event_filters(
    query,
    *,
    q: str | None,
    provider: str | None,
    org_id: uuid.UUID | None,
    project_id: uuid.UUID | None,
    user_id: str | None,
    start: datetime | None,
    end: datetime | None,
):
    if provider:
        query = query.where(LlmEvent.provider == provider)
    if org_id:
        query = query.where(Organization.id == org_id)
    if project_id:
        query = query.where(Project.id == project_id)
    if user_id:
        query = query.where(
            or_(
                LlmEvent.user_id == user_id,
                User.auth0_id == user_id,
                cast(User.id, String) == user_id,
            )
        )
    if start:
        query = query.where(LlmEvent.occurred_at >= start)
    if end:
        query = query.where(LlmEvent.occurred_at < end)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.where(
            or_(
                LlmEvent.provider.ilike(pattern),
                LlmEvent.model.ilike(pattern),
                LlmEvent.feature.ilike(pattern),
                LlmEvent.user_id.ilike(pattern),
                Project.name.ilike(pattern),
                Organization.name.ilike(pattern),
                User.name.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
    return query


@router.get(
    "/overview",
    response_model=AdminOverviewResponse,
    dependencies=[Depends(require_admin_access)],
    summary="Platform-wide admin overview",
)
async def get_admin_overview(
    days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> AdminOverviewResponse:
    start = _window_start(days)

    totals_stmt = select(
        select(func.count(User.id)).scalar_subquery(),
        select(func.count(Organization.id)).scalar_subquery(),
        select(func.count(Project.id)).scalar_subquery(),
        select(func.count(ApiKey.id)).scalar_subquery(),
    )
    totals_row = (await db.execute(totals_stmt)).one()

    usage_stmt = (
        select(
            func.count(LlmEvent.id),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0),
            func.avg(LlmEvent.latency_ms),
        )
        .where(LlmEvent.occurred_at >= start)
    )
    usage_row = (await db.execute(usage_stmt)).one()

    daily_stmt = (
        select(
            func.date_trunc("day", LlmEvent.occurred_at).label("day"),
            func.count(LlmEvent.id).label("total_events"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
        )
        .where(LlmEvent.occurred_at >= start)
        .group_by("day")
        .order_by("day")
    )
    daily_rows = (await db.execute(daily_stmt)).all()

    providers_stmt = (
        select(
            LlmEvent.provider,
            func.count(LlmEvent.id).label("total_events"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
            func.avg(LlmEvent.latency_ms).label("avg_latency"),
        )
        .where(LlmEvent.occurred_at >= start)
        .group_by(LlmEvent.provider)
        .order_by(desc("total_cost"), desc("total_events"))
    )
    provider_rows = (await db.execute(providers_stmt)).all()

    recent_users_stmt = select(User).order_by(User.created_at.desc()).limit(8)
    recent_users = (await db.execute(recent_users_stmt)).scalars().all()

    recent_orgs_stmt = (
        select(Organization).order_by(Organization.created_at.desc()).limit(8)
    )
    recent_orgs = (await db.execute(recent_orgs_stmt)).scalars().all()

    recent_projects_stmt = (
        select(Project, Organization.name.label("org_name"))
        .join(Organization, Project.org_id == Organization.id)
        .order_by(Project.created_at.desc())
        .limit(8)
    )
    recent_projects = (await db.execute(recent_projects_stmt)).all()

    recent_events_stmt = _event_base_query().order_by(LlmEvent.occurred_at.desc()).limit(12)
    recent_events = (await db.execute(recent_events_stmt)).all()

    return AdminOverviewResponse(
        total_users=totals_row[0],
        total_organizations=totals_row[1],
        total_projects=totals_row[2],
        total_api_keys=totals_row[3],
        total_events=usage_row[0],
        total_tokens=usage_row[1],
        total_cost_usd=_float_or_zero(usage_row[2]),
        avg_latency_ms=float(usage_row[3]) if usage_row[3] is not None else None,
        period_days=days,
        recent_users=[
            AdminRecentUser(
                id=user.id,
                auth0_id=user.auth0_id,
                email=user.email,
                name=user.name,
                profile_photo=user.profile_photo,
                created_at=user.created_at,
            )
            for user in recent_users
        ],
        recent_organizations=[
            AdminRecentOrganization(
                id=org.id,
                name=org.name,
                slug=org.slug,
                plan=org.plan,
                created_at=org.created_at,
            )
            for org in recent_orgs
        ],
        recent_projects=[
            AdminRecentProject(
                id=row[0].id,
                org_id=row[0].org_id,
                org_name=row.org_name,
                name=row[0].name,
                environment=row[0].environment,
                created_at=row[0].created_at,
            )
            for row in recent_projects
        ],
        recent_events=[
            AdminRecentEvent(
                id=row.id,
                occurred_at=row.occurred_at,
                ingested_at=row.ingested_at,
                provider=row.provider,
                model=row.model,
                feature=row.feature,
                user_id=row.user_id,
                user_name=row.user_name,
                user_email=row.user_email,
                project_id=row.project_id,
                project_name=row.project_name,
                org_id=row.org_id,
                org_name=row.org_name,
                estimated_cost_usd=_float_or_zero(row.estimated_cost_usd)
                if row.estimated_cost_usd is not None
                else None,
                total_tokens=row.total_tokens,
                latency_ms=row.latency_ms,
                key_prefix=row.key_prefix,
            )
            for row in recent_events
        ],
        daily_usage=[
            AdminDailyUsage(
                date=row.day.strftime("%Y-%m-%d"),
                total_events=row.total_events,
                total_tokens=row.total_tokens,
                total_cost_usd=_float_or_zero(row.total_cost),
            )
            for row in daily_rows
        ],
        provider_breakdown=[
            AdminProviderBreakdown(
                provider=row.provider,
                total_events=row.total_events,
                total_tokens=row.total_tokens,
                total_cost_usd=_float_or_zero(row.total_cost),
                avg_latency_ms=float(row.avg_latency)
                if row.avg_latency is not None
                else None,
            )
            for row in provider_rows
        ],
    )


@router.get(
    "/users",
    response_model=AdminUsersResponse,
    dependencies=[Depends(require_admin_access)],
    summary="List platform users for the admin portal",
)
async def list_admin_users(
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AdminUsersResponse:
    org_counts = (
        select(
            OrganizationMember.user_id.label("user_id"),
            func.count(OrganizationMember.id).label("organization_count"),
        )
        .group_by(OrganizationMember.user_id)
        .subquery()
    )
    project_counts = (
        select(
            ProjectMember.user_id.label("user_id"),
            func.count(ProjectMember.id).label("project_count"),
        )
        .group_by(ProjectMember.user_id)
        .subquery()
    )
    key_counts = (
        select(
            ApiKey.created_by_user_id.label("user_id"),
            func.count(ApiKey.id).label("api_key_count"),
        )
        .where(ApiKey.created_by_user_id.is_not(None))
        .group_by(ApiKey.created_by_user_id)
        .subquery()
    )
    auth0_events = (
        select(
            LlmEvent.user_id.label("user_ref"),
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
            func.max(LlmEvent.occurred_at).label("last_seen_at"),
        )
        .where(LlmEvent.user_id.is_not(None))
        .group_by(LlmEvent.user_id)
        .subquery()
    )

    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                User.email.ilike(pattern),
                User.name.ilike(pattern),
                User.auth0_id.ilike(pattern),
            )
        )

    count_stmt = select(func.count(User.id)).where(*filters)
    total = (await db.execute(count_stmt)).scalar_one()

    offset = (page - 1) * page_size
    stmt = (
        select(
            User,
            func.coalesce(org_counts.c.organization_count, 0).label("organization_count"),
            func.coalesce(project_counts.c.project_count, 0).label("project_count"),
            func.coalesce(key_counts.c.api_key_count, 0).label("api_key_count"),
            func.coalesce(auth0_events.c.event_count, 0).label("auth0_event_count"),
            func.coalesce(auth0_events.c.total_cost, 0).label("auth0_total_cost"),
            auth0_events.c.last_seen_at.label("auth0_last_seen_at"),
        )
        .outerjoin(org_counts, org_counts.c.user_id == User.id)
        .outerjoin(project_counts, project_counts.c.user_id == User.id)
        .outerjoin(key_counts, key_counts.c.user_id == User.id)
        .outerjoin(auth0_events, auth0_events.c.user_ref == User.auth0_id)
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    user_ids = [str(row[0].id) for row in rows]
    uuid_event_stats = {}
    if user_ids:
        uuid_events_stmt = (
            select(
                LlmEvent.user_id.label("user_ref"),
                func.count(LlmEvent.id).label("event_count"),
                func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
                func.max(LlmEvent.occurred_at).label("last_seen_at"),
            )
            .where(LlmEvent.user_id.in_(user_ids))
            .group_by(LlmEvent.user_id)
        )
        uuid_event_rows = (await db.execute(uuid_events_stmt)).all()
        uuid_event_stats = {row.user_ref: row for row in uuid_event_rows}

    items = []
    for row in rows:
        user = row[0]
        uuid_stats = uuid_event_stats.get(str(user.id))
        auth0_count = row.auth0_event_count or 0
        uuid_count = uuid_stats.event_count if uuid_stats else 0
        auth0_cost = _float_or_zero(row.auth0_total_cost)
        uuid_cost = _float_or_zero(uuid_stats.total_cost if uuid_stats else 0)
        auth0_last_seen = row.auth0_last_seen_at
        uuid_last_seen = uuid_stats.last_seen_at if uuid_stats else None
        last_seen_at = auth0_last_seen
        if uuid_last_seen and (last_seen_at is None or uuid_last_seen > last_seen_at):
            last_seen_at = uuid_last_seen

        items.append(
            AdminUserRow(
                id=user.id,
                auth0_id=user.auth0_id,
                email=user.email,
                name=user.name,
                profile_photo=user.profile_photo,
                created_at=user.created_at,
                organization_count=row.organization_count,
                project_count=row.project_count,
                api_key_count=row.api_key_count,
                event_count=auth0_count + uuid_count,
                total_cost_usd=auth0_cost + uuid_cost,
                last_seen_at=last_seen_at,
            )
        )

    return AdminUsersResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_more=_has_more(page, page_size, total),
    )


@router.get(
    "/organizations",
    response_model=AdminOrganizationsResponse,
    dependencies=[Depends(require_admin_access)],
    summary="List organizations for the admin portal",
)
async def list_admin_organizations(
    q: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AdminOrganizationsResponse:
    member_counts = (
        select(
            OrganizationMember.org_id.label("org_id"),
            func.count(OrganizationMember.id).label("member_count"),
        )
        .group_by(OrganizationMember.org_id)
        .subquery()
    )
    project_counts = (
        select(Project.org_id.label("org_id"), func.count(Project.id).label("project_count"))
        .group_by(Project.org_id)
        .subquery()
    )
    key_counts = (
        select(ApiKey.org_id.label("org_id"), func.count(ApiKey.id).label("api_key_count"))
        .group_by(ApiKey.org_id)
        .subquery()
    )
    event_stats = (
        select(
            Project.org_id.label("org_id"),
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
            func.max(LlmEvent.occurred_at).label("last_activity_at"),
        )
        .join(Project, LlmEvent.project_id == Project.id)
        .group_by(Project.org_id)
        .subquery()
    )

    filters = []
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Organization.name.ilike(pattern),
                Organization.slug.ilike(pattern),
                Organization.plan.ilike(pattern),
            )
        )

    total = (await db.execute(select(func.count(Organization.id)).where(*filters))).scalar_one()
    offset = (page - 1) * page_size

    stmt = (
        select(
            Organization,
            func.coalesce(member_counts.c.member_count, 0).label("member_count"),
            func.coalesce(project_counts.c.project_count, 0).label("project_count"),
            func.coalesce(key_counts.c.api_key_count, 0).label("api_key_count"),
            func.coalesce(event_stats.c.event_count, 0).label("event_count"),
            func.coalesce(event_stats.c.total_cost, 0).label("total_cost"),
            event_stats.c.last_activity_at.label("last_activity_at"),
        )
        .outerjoin(member_counts, member_counts.c.org_id == Organization.id)
        .outerjoin(project_counts, project_counts.c.org_id == Organization.id)
        .outerjoin(key_counts, key_counts.c.org_id == Organization.id)
        .outerjoin(event_stats, event_stats.c.org_id == Organization.id)
        .where(*filters)
        .order_by(Organization.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    return AdminOrganizationsResponse(
        items=[
            AdminOrganizationRow(
                id=row[0].id,
                name=row[0].name,
                slug=row[0].slug,
                plan=row[0].plan,
                created_at=row[0].created_at,
                member_count=row.member_count,
                project_count=row.project_count,
                api_key_count=row.api_key_count,
                event_count=row.event_count,
                total_cost_usd=_float_or_zero(row.total_cost),
                last_activity_at=row.last_activity_at,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        has_more=_has_more(page, page_size, total),
    )


@router.get(
    "/projects",
    response_model=AdminProjectsResponse,
    dependencies=[Depends(require_admin_access)],
    summary="List projects for the admin portal",
)
async def list_admin_projects(
    q: str | None = Query(default=None),
    org_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> AdminProjectsResponse:
    member_counts = (
        select(
            ProjectMember.project_id.label("project_id"),
            func.count(ProjectMember.id).label("member_count"),
        )
        .group_by(ProjectMember.project_id)
        .subquery()
    )
    key_counts = (
        select(
            ApiKey.project_id.label("project_id"),
            func.count(ApiKey.id).label("api_key_count"),
        )
        .where(ApiKey.project_id.is_not(None))
        .group_by(ApiKey.project_id)
        .subquery()
    )
    event_stats = (
        select(
            LlmEvent.project_id.label("project_id"),
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
            func.max(LlmEvent.occurred_at).label("last_activity_at"),
        )
        .group_by(LlmEvent.project_id)
        .subquery()
    )

    filters = []
    if org_id:
        filters.append(Project.org_id == org_id)
    if q:
        pattern = f"%{q.strip()}%"
        filters.append(
            or_(
                Project.name.ilike(pattern),
                Project.environment.ilike(pattern),
                Organization.name.ilike(pattern),
            )
        )

    total_stmt = (
        select(func.count(Project.id))
        .select_from(Project)
        .join(Organization, Project.org_id == Organization.id)
        .where(*filters)
    )
    total = (await db.execute(total_stmt)).scalar_one()
    offset = (page - 1) * page_size

    stmt = (
        select(
            Project,
            Organization.name.label("org_name"),
            func.coalesce(member_counts.c.member_count, 0).label("member_count"),
            func.coalesce(key_counts.c.api_key_count, 0).label("api_key_count"),
            func.coalesce(event_stats.c.event_count, 0).label("event_count"),
            func.coalesce(event_stats.c.total_cost, 0).label("total_cost"),
            event_stats.c.last_activity_at.label("last_activity_at"),
        )
        .join(Organization, Project.org_id == Organization.id)
        .outerjoin(member_counts, member_counts.c.project_id == Project.id)
        .outerjoin(key_counts, key_counts.c.project_id == Project.id)
        .outerjoin(event_stats, event_stats.c.project_id == Project.id)
        .where(*filters)
        .order_by(Project.created_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    return AdminProjectsResponse(
        items=[
            AdminProjectRow(
                id=row[0].id,
                org_id=row[0].org_id,
                org_name=row.org_name,
                name=row[0].name,
                environment=row[0].environment,
                created_at=row[0].created_at,
                member_count=row.member_count,
                api_key_count=row.api_key_count,
                event_count=row.event_count,
                total_cost_usd=_float_or_zero(row.total_cost),
                last_activity_at=row.last_activity_at,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        has_more=_has_more(page, page_size, total),
    )


@router.get(
    "/events",
    response_model=AdminEventsResponse,
    dependencies=[Depends(require_admin_access)],
    summary="List all platform events for the admin portal",
)
async def list_admin_events(
    q: str | None = Query(default=None),
    provider: str | None = Query(default=None),
    org_id: uuid.UUID | None = Query(default=None),
    project_id: uuid.UUID | None = Query(default=None),
    user_id: str | None = Query(default=None),
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> AdminEventsResponse:
    filtered_query = _apply_event_filters(
        _event_base_query(),
        q=q,
        provider=provider,
        org_id=org_id,
        project_id=project_id,
        user_id=user_id,
        start=start,
        end=end,
    )

    count_query = (
        _apply_event_filters(
            select(func.count(LlmEvent.id))
            .select_from(LlmEvent)
            .join(Project, LlmEvent.project_id == Project.id)
            .join(Organization, Project.org_id == Organization.id)
            .outerjoin(
                User,
                or_(
                    LlmEvent.user_id == User.auth0_id,
                    LlmEvent.user_id == cast(User.id, String),
                ),
            ),
            q=q,
            provider=provider,
            org_id=org_id,
            project_id=project_id,
            user_id=user_id,
            start=start,
            end=end,
        )
    )
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    rows = (
        await db.execute(
            filtered_query
            .order_by(LlmEvent.occurred_at.desc())
            .offset(offset)
            .limit(page_size)
        )
    ).all()

    return AdminEventsResponse(
        items=[
            AdminEventRow(
                id=row.id,
                occurred_at=row.occurred_at,
                ingested_at=row.ingested_at,
                provider=row.provider,
                model=row.model,
                feature=row.feature,
                finish_reason=row.finish_reason,
                user_id=row.user_id,
                user_name=row.user_name,
                user_email=row.user_email,
                session_id=row.session_id,
                project_id=row.project_id,
                project_name=row.project_name,
                org_id=row.org_id,
                org_name=row.org_name,
                api_key_id=row.api_key_id,
                parent_api_key_id=row.parent_api_key_id,
                key_prefix=row.key_prefix,
                prompt_tokens=row.prompt_tokens,
                completion_tokens=row.completion_tokens,
                total_tokens=row.total_tokens,
                estimated_cost_usd=_float_or_zero(row.estimated_cost_usd)
                if row.estimated_cost_usd is not None
                else None,
                latency_ms=row.latency_ms,
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
        has_more=_has_more(page, page_size, total),
    )
