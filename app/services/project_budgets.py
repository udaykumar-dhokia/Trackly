from __future__ import annotations

import logging
import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.models.orm import OrganizationMember, Project, ProjectBudget, ProjectBudgetAlert, User
from app.models.schemas import ProjectBudgetResponse, ProjectBudgetStatusResponse
from app.services.billing import get_current_month_start, get_project_usage_snapshot
from app.services.email import send_project_budget_alert_email

logger = logging.getLogger(__name__)

PROJECT_BUDGET_EMAIL_ALERT_THRESHOLD_PERCENT = Decimal("90")
PROJECT_BUDGET_ALERT_TYPE_WARNING_90 = "warning_90"


async def get_project_budget(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> ProjectBudget | None:
    result = await db.execute(
        select(ProjectBudget).where(ProjectBudget.project_id == project_id)
    )
    return result.scalar_one_or_none()


def serialize_project_budget(
    project_id: uuid.UUID,
    budget: ProjectBudget | None,
) -> ProjectBudgetResponse:
    return ProjectBudgetResponse(
        project_id=project_id,
        monthly_token_limit=budget.monthly_token_limit if budget else None,
        monthly_cost_limit_usd=float(budget.monthly_cost_limit_usd)
        if budget and budget.monthly_cost_limit_usd is not None
        else None,
        configured=bool(
            budget
            and (
                budget.monthly_token_limit is not None
                or budget.monthly_cost_limit_usd is not None
            )
        ),
        updated_at=budget.updated_at if budget else None,
        created_at=budget.created_at if budget else None,
    )


def build_project_budget_status(
    usage,
    budget: ProjectBudget | None,
) -> ProjectBudgetStatusResponse | None:
    if budget is None:
        return None

    token_limit = budget.monthly_token_limit
    cost_limit = (
        float(budget.monthly_cost_limit_usd)
        if budget.monthly_cost_limit_usd is not None
        else None
    )
    current_cost = float(usage.total_cost_usd)

    token_usage_percentage = (
        round((usage.total_tokens / token_limit) * 100, 2)
        if token_limit
        else None
    )
    cost_usage_percentage = (
        round((current_cost / cost_limit) * 100, 2)
        if cost_limit
        else None
    )

    status = "not_configured"
    percentages = [
        value for value in (token_usage_percentage, cost_usage_percentage) if value is not None
    ]
    if percentages:
        highest = max(percentages)
        if highest >= 100:
            status = "exceeded"
        elif highest >= 80:
            status = "warning"
        else:
            status = "healthy"

    return ProjectBudgetStatusResponse(
        monthly_token_limit=token_limit,
        monthly_cost_limit_usd=cost_limit,
        current_month_tokens=usage.total_tokens,
        current_month_cost_usd=current_cost,
        token_usage_percentage=token_usage_percentage,
        cost_usage_percentage=cost_usage_percentage,
        token_remaining=max(token_limit - usage.total_tokens, 0) if token_limit else None,
        cost_remaining_usd=round(max(cost_limit - current_cost, 0.0), 4)
        if cost_limit is not None
        else None,
        status=status,
        updated_at=budget.updated_at,
    )


async def maybe_send_project_budget_alert(
    db: AsyncSession,
    project_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(Project)
        .options(joinedload(Project.organization))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if project is None:
        return

    budget = await get_project_budget(db, project_id)
    if budget is None:
        return

    usage = await get_project_usage_snapshot(db, project_id)
    budget_status = build_project_budget_status(usage, budget)
    if budget_status is None:
        return

    percentages = [
        Decimal(str(value))
        for value in (
            budget_status.token_usage_percentage,
            budget_status.cost_usage_percentage,
        )
        if value is not None
    ]
    if not percentages or max(percentages) < PROJECT_BUDGET_EMAIL_ALERT_THRESHOLD_PERCENT:
        return

    owners_result = await db.execute(
        select(User)
        .join(OrganizationMember, OrganizationMember.user_id == User.id)
        .where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.role == "owner",
        )
    )
    owners = owners_result.scalars().all()
    if not owners:
        return

    alert = ProjectBudgetAlert(
        project_budget_id=budget.id,
        alert_month=get_current_month_start().strftime("%Y-%m"),
        alert_type=PROJECT_BUDGET_ALERT_TYPE_WARNING_90,
    )

    try:
        async with db.begin_nested():
            db.add(alert)
            await db.flush()
    except IntegrityError:
        return

    try:
        sent = await send_project_budget_alert_email(
            project=project,
            owners=owners,
            budget_status=budget_status,
        )
    except Exception:
        logger.exception("Project budget alert failed for project %s", project_id)
        sent = False

    if sent:
        return

    with db.no_autoflush:
        await db.delete(alert)
    await db.flush()
