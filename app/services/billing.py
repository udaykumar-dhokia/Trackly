from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import LlmEvent, Project

PLAN_LIMITS = {
    "free": 50_000,
    "starter": 50_000,
    "pro": 500_000,
    "scale": 1_000_000
}

def get_current_month_start() -> datetime:
    """Returns the first day of the current month at 00:00:00 UTC."""
    now = datetime.now(timezone.utc)
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


@dataclass(slots=True)
class OrganizationUsageSnapshot:
    event_count: int
    total_tokens: int
    total_cost_usd: Decimal


async def get_organization_usage(db: AsyncSession, org_id: uuid.UUID) -> int:
    """
    Counts all LlmEvents for all projects belonging to the given organization
    that occurred within the current calendar month.
    """
    snapshot = await get_organization_usage_snapshot(db, org_id)
    return snapshot.event_count


async def get_organization_usage_snapshot(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> OrganizationUsageSnapshot:
    month_start = get_current_month_start()

    usage_stmt = (
        select(func.count(LlmEvent.id))
        .add_columns(
            func.coalesce(func.sum(LlmEvent.total_tokens), 0),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0),
        )
        .join(Project, Project.id == LlmEvent.project_id)
        .where(
            Project.org_id == org_id,
            LlmEvent.occurred_at >= month_start
        )
    )

    result = await db.execute(usage_stmt)
    event_count, total_tokens, total_cost = result.one()
    return OrganizationUsageSnapshot(
        event_count=event_count or 0,
        total_tokens=total_tokens or 0,
        total_cost_usd=Decimal(str(total_cost or 0)),
    )
