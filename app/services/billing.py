from __future__ import annotations

import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func
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

async def get_organization_usage(db: AsyncSession, org_id: uuid.UUID) -> int:
    """
    Counts all LlmEvents for all projects belonging to the given organization
    that occurred within the current calendar month.
    """
    month_start = get_current_month_start()
    
    project_stmt = select(Project.id).where(Project.org_id == org_id)
    project_ids_result = await db.execute(project_stmt)
    project_ids = project_ids_result.scalars().all()
    
    if not project_ids:
        return 0
        
    usage_stmt = (
        select(func.count(LlmEvent.id))
        .where(
            LlmEvent.project_id.in_(project_ids),
            LlmEvent.occurred_at >= month_start
        )
    )
    
    result = await db.execute(usage_stmt)
    return result.scalar_one() or 0
