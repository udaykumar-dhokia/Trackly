from __future__ import annotations

import uuid
import re
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import (
    Organization,
    OrganizationBudget,
    OrganizationMember,
    Project,
    ProjectMember,
    User,
)
from app.models.schemas import (
    OrganizationBudgetResponse,
    OrganizationBudgetStatusResponse,
    OrganizationBudgetUpdate,
    ProjectBudgetResponse,
    ProjectBudgetStatusResponse,
    ProjectBudgetUpdate,
    OrganizationMemberAdd,
    OrganizationUsageResponse,
    ProjectUsageResponse,
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberResponse,
    ProjectResponse,
    ProjectUpdate,
    UserResponse,
)
from app.services.billing import (
    PLAN_LIMITS,
    get_current_month_start,
    get_organization_usage_snapshot,
    get_project_usage_snapshot,
)
from app.services.project_budgets import (
    build_project_budget_status,
    get_project_budget,
    serialize_project_budget,
)
from app.services.project_access import (
    get_user_by_auth0_id,
    has_project_access,
    list_accessible_projects,
    require_project_access_by_auth0_id,
)

router = APIRouter()

class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=2, max_length=100)

    @field_validator("slug")
    @classmethod
    def slug_format(cls, v: str) -> str:
        v = v.lower().strip()
        if not re.match(r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$", v):
            raise ValueError("Slug must be lowercase alphanumeric with hyphens, e.g. 'my-org'")
        return v


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    plan: str

    model_config = {"from_attributes": True}


@router.post(
    "/organizations",
    response_model=OrganizationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new organization",
)
async def create_organization(
    body: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
) -> OrganizationResponse:
    existing = await db.execute(
        select(Organization).where(Organization.slug == body.slug)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Slug '{body.slug}' is already taken.",
        )

    org = Organization(name=body.name, slug=body.slug)
    db.add(org)
    await db.flush()
    await db.refresh(org)
    return org

@router.get(
    "/organizations/{org_id}",
    response_model=OrganizationResponse,
    summary="Get an organization",
)
async def get_organization(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> OrganizationResponse:
    org = await _get_org_or_404(db, org_id)
    return org

@router.post(
    "/organizations/{org_id}/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project under an organization",
)
async def create_project(
    org_id: uuid.UUID,
    body: ProjectCreate,
    auth0_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    await _get_org_or_404(db, org_id)

    project = Project(
        org_id=org_id,
        name=body.name,
        environment=body.environment,
        description=body.description,
    )
    db.add(project)
    await db.flush()

    if auth0_id:
        result = await db.execute(select(User).where(User.auth0_id == auth0_id))
        creator = result.scalar_one_or_none()
        if creator is not None:
            result = await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.org_id == org_id,
                    OrganizationMember.user_id == creator.id,
                )
            )
            org_membership = result.scalar_one_or_none()
            if org_membership is not None:
                project_member = ProjectMember(
                    project_id=project.id,
                    user_id=creator.id,
                    role="admin",
                )
                db.add(project_member)
                await db.flush()

    await db.refresh(project)
    return project


@router.get(
    "/organizations/{org_id}/projects",
    response_model=list[ProjectResponse],
    summary="List all projects in an organization",
)
async def list_projects(
    org_id: uuid.UUID,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    await _get_org_or_404(db, org_id)
    user = await get_user_by_auth0_id(db, auth0_id)
    if user is None:
        raise HTTPException(status_code=403, detail="Requester not found.")
    return await list_accessible_projects(db, org_id, user.id)


@router.get(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Get a single project",
)
async def get_project(
    project_id: uuid.UUID,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


@router.put(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Update a project",
)
async def update_project(
    project_id: uuid.UUID,
    body: ProjectUpdate,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    await _require_org_admin(
        db,
        project.org_id,
        auth0_id,
        detail="Only organization admins can edit project details.",
    )

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one project field to update.",
        )

    for field, value in updates.items():
        setattr(project, field, value)

    await db.flush()
    await db.refresh(project)
    return project

@router.get(
    "/projects/{project_id}/members",
    response_model=list[ProjectMemberResponse],
    summary="List all members of a project",
)
async def list_project_members(
    project_id: uuid.UUID,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> list[ProjectMemberResponse]:
    _, project = await require_project_access_by_auth0_id(db, project_id, auth0_id)

    from sqlalchemy.orm import joinedload
    result = await db.execute(
        select(ProjectMember)
        .options(joinedload(ProjectMember.user))
        .where(ProjectMember.project_id == project_id)
    )
    members = result.scalars().all()

    return [
        ProjectMemberResponse(
            id=m.id,
            project_id=m.project_id,
            user_id=m.user_id,
            email=m.user.email,
            name=m.user.name,
            profile_photo=m.user.profile_photo,
            role=m.role,
            created_at=m.created_at,
        )
        for m in members
    ]


@router.post(
    "/projects/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a member to a project",
)
async def add_project_member(
    project_id: uuid.UUID,
    body: ProjectMemberAdd,
    auth0_id: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> ProjectMemberResponse:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    if auth0_id:
        # Check if requester is org admin or project admin
        result = await db.execute(select(User).where(User.auth0_id == auth0_id))
        requester = result.scalar_one_or_none()
        if not requester:
             raise HTTPException(status_code=403, detail="Requester not found.")
        
        # Check org role
        result = await db.execute(select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == requester.id
        ))
        org_mem = result.scalar_one_or_none()
        
        # Check project role
        result = await db.execute(select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == requester.id
        ))
        proj_mem = result.scalar_one_or_none()
        
        is_admin = (org_mem and org_mem.role in ["admin", "owner"]) or (proj_mem and proj_mem.role == "admin")
        if not is_admin:
            raise HTTPException(status_code=403, detail="Only admins can manage project members.")

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with email '{body.email}' not found.",
        )

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == user.id,
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=403,
            detail="User must be a member of the organization to join this project.",
        )

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user.id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409, detail="User is already a member of this project."
        )

    member = ProjectMember(project_id=project_id, user_id=user.id, role=body.role)
    db.add(member)
    await db.flush()
    await db.refresh(member, ["user"])

    return ProjectMemberResponse(
        id=member.id,
        project_id=member.project_id,
        user_id=member.user_id,
        email=member.user.email,
        name=member.user.name,
        profile_photo=member.user.profile_photo,
        role=member.role,
        created_at=member.created_at,
    )


@router.delete(
    "/projects/{project_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from a project",
)
async def remove_project_member(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    auth0_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    if auth0_id:
        # Check if requester is org admin or project admin
        result = await db.execute(select(User).where(User.auth0_id == auth0_id))
        requester = result.scalar_one_or_none()
        if not requester:
             raise HTTPException(status_code=403, detail="Requester not found.")
        
        # Check org role
        result = await db.execute(select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == requester.id
        ))
        org_mem = result.scalar_one_or_none()
        
        # Check project role
        result = await db.execute(select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == requester.id
        ))
        proj_mem = result.scalar_one_or_none()
        
        is_admin = (org_mem and org_mem.role in ["admin", "owner"]) or (proj_mem and proj_mem.role == "admin")
        if not is_admin:
            raise HTTPException(status_code=403, detail="Only admins can manage project members.")

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id, ProjectMember.user_id == user_id
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found.")

    await db.delete(member)
    await db.commit()
    return


@router.get(
    "/organizations/{org_id}/users",
    response_model=list[UserResponse],
    summary="List all users in an organization",
)
async def list_org_users(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[UserResponse]:
    await _get_org_or_404(db, org_id)
    from sqlalchemy.orm import joinedload

    result = await db.execute(
        select(OrganizationMember)
        .options(joinedload(OrganizationMember.user))
        .where(OrganizationMember.org_id == org_id)
    )
    members = result.scalars().all()

    return [
        UserResponse(
            id=m.user.id,
            auth0_id=m.user.auth0_id,
            email=m.user.email,
            name=m.user.name,
            profile_photo=m.user.profile_photo,
            org_id=org_id,
            created_at=m.user.created_at,
        )
        for m in members
    ]


@router.post(
    "/organizations/{org_id}/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add/Invite a user to an organization",
)
async def add_org_user(
    org_id: uuid.UUID,
    body: OrganizationMemberAdd,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    await _get_org_or_404(db, org_id)

    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user:
        invited_id = f"invited|{uuid.uuid4().hex}"
        user = User(auth0_id=invited_id, email=body.email, name=body.name)
        db.add(user)
        await db.flush()

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id, OrganizationMember.user_id == user.id
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User already in this organization.")

    member = OrganizationMember(org_id=org_id, user_id=user.id)
    db.add(member)
    await db.commit()
    await db.refresh(user)

    resp = UserResponse.model_validate(user)
    resp.org_id = org_id
    return resp


@router.get(
    "/projects/{project_id}/budget",
    response_model=ProjectBudgetResponse,
    summary="Get project budget settings",
)
async def get_project_budget_settings(
    project_id: uuid.UUID,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> ProjectBudgetResponse:
    _, project = await require_project_access_by_auth0_id(db, project_id, auth0_id)
    budget = await get_project_budget(db, project_id)
    return serialize_project_budget(project.id, budget)


@router.put(
    "/projects/{project_id}/budget",
    response_model=ProjectBudgetResponse,
    summary="Create or update project budget settings",
)
async def update_project_budget(
    project_id: uuid.UUID,
    body: ProjectBudgetUpdate,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> ProjectBudgetResponse:
    project = await _get_project_or_404(db, project_id)
    actor = await _require_project_budget_manager(db, project, auth0_id)
    budget = await get_project_budget(db, project_id)

    if budget is None:
        from app.models.orm import ProjectBudget

        budget = ProjectBudget(
            project_id=project_id,
            created_by_user_id=actor.id,
        )
        db.add(budget)

    budget.monthly_token_limit = body.monthly_token_limit
    budget.monthly_cost_limit_usd = body.monthly_cost_limit_usd

    await db.flush()
    await db.refresh(budget)
    return serialize_project_budget(project.id, budget)


@router.get(
    "/projects/{project_id}/usage",
    response_model=ProjectUsageResponse,
    summary="Get monthly usage stats for a project",
)
async def get_project_usage(
    project_id: uuid.UUID,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> ProjectUsageResponse:
    _, project = await require_project_access_by_auth0_id(db, project_id, auth0_id)
    org = await _get_org_or_404(db, project.org_id)
    usage = await get_project_usage_snapshot(db, project_id)
    budget = await get_project_budget(db, project_id)

    current_start = get_current_month_start()
    if current_start.month == 12:
        next_reset = current_start.replace(year=current_start.year + 1, month=1)
    else:
        next_reset = current_start.replace(month=current_start.month + 1)

    limit = PLAN_LIMITS.get(org.plan.lower(), PLAN_LIMITS["free"])
    budget_status = build_project_budget_status(usage, budget)

    return ProjectUsageResponse(
        project_id=project_id,
        org_id=project.org_id,
        plan=org.plan,
        current_month_usage=usage.event_count,
        current_month_events=usage.event_count,
        current_month_tokens=usage.total_tokens,
        current_month_cost_usd=float(usage.total_cost_usd),
        plan_limit=limit,
        reset_date=next_reset,
        budget=budget_status,
    )


@router.get(
    "/organizations/{org_id}/budget",
    response_model=OrganizationBudgetResponse,
    summary="Get organization budget settings",
)
async def get_org_budget(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> OrganizationBudgetResponse:
    await _get_org_or_404(db, org_id)
    budget = await _get_budget_for_org(db, org_id)
    return _serialize_budget(org_id, budget)


@router.put(
    "/organizations/{org_id}/budget",
    response_model=OrganizationBudgetResponse,
    summary="Create or update organization budget settings",
)
async def update_org_budget(
    org_id: uuid.UUID,
    body: OrganizationBudgetUpdate,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> OrganizationBudgetResponse:
    await _get_org_or_404(db, org_id)
    actor = await _require_org_admin(db, org_id, auth0_id)
    budget = await _get_budget_for_org(db, org_id)

    if budget is None:
        budget = OrganizationBudget(
            org_id=org_id,
            created_by_user_id=actor.id,
        )
        db.add(budget)

    budget.monthly_token_limit = body.monthly_token_limit
    budget.monthly_cost_limit_usd = body.monthly_cost_limit_usd

    await db.flush()
    await db.refresh(budget)
    return _serialize_budget(org_id, budget)


@router.get(
    "/organizations/{org_id}/usage",
    response_model=OrganizationUsageResponse,
    summary="Get monthly usage stats for an organization",
)
async def get_org_usage(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> OrganizationUsageResponse:
    org = await _get_org_or_404(db, org_id)
    usage = await get_organization_usage_snapshot(db, org_id)
    budget = await _get_budget_for_org(db, org_id)
    
    current_start = get_current_month_start()
    if current_start.month == 12:
        next_reset = current_start.replace(year=current_start.year + 1, month=1)
    else:
        next_reset = current_start.replace(month=current_start.month + 1)
        
    limit = PLAN_LIMITS.get(org.plan.lower(), PLAN_LIMITS["free"])
    budget_status = _build_budget_status(usage, budget)

    return OrganizationUsageResponse(
        org_id=org_id,
        plan=org.plan,
        current_month_usage=usage.event_count,
        current_month_events=usage.event_count,
        current_month_tokens=usage.total_tokens,
        current_month_cost_usd=float(usage.total_cost_usd),
        plan_limit=limit,
        reset_date=next_reset,
        budget=budget_status,
    )


async def _get_org_or_404(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return org


async def _get_project_or_404(db: AsyncSession, project_id: uuid.UUID) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


async def _require_org_admin(
    db: AsyncSession,
    org_id: uuid.UUID,
    auth0_id: str,
    *,
    detail: str = "Only organization admins can manage budgets.",
) -> User:
    result = await db.execute(select(User).where(User.auth0_id == auth0_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=403, detail="Requester not found.")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user.id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None or membership.role not in ("owner", "admin"):
        raise HTTPException(
            status_code=403,
            detail=detail,
        )
    return user


async def _require_project_budget_manager(
    db: AsyncSession,
    project: Project,
    auth0_id: str,
) -> User:
    result = await db.execute(select(User).where(User.auth0_id == auth0_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=403, detail="Requester not found.")

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == project.org_id,
            OrganizationMember.user_id == user.id,
        )
    )
    org_membership = result.scalar_one_or_none()
    if org_membership is not None and org_membership.role == "owner":
        return user

    if org_membership is not None and org_membership.role == "admin":
        owner_count_result = await db.execute(
            select(OrganizationMember.id).where(
                OrganizationMember.org_id == project.org_id,
                OrganizationMember.role == "owner",
            )
        )
        if owner_count_result.first() is None:
            return user

    result = await db.execute(
        select(ProjectMember).where(
            ProjectMember.project_id == project.id,
            ProjectMember.user_id == user.id,
        )
    )
    project_membership = result.scalar_one_or_none()
    if project_membership is not None and project_membership.role == "admin":
        return user

    raise HTTPException(
        status_code=403,
        detail="Only project admins or organization owners can manage project budgets.",
    )


async def _get_budget_for_org(
    db: AsyncSession,
    org_id: uuid.UUID,
) -> OrganizationBudget | None:
    result = await db.execute(
        select(OrganizationBudget).where(OrganizationBudget.org_id == org_id)
    )
    return result.scalar_one_or_none()


def _serialize_budget(
    org_id: uuid.UUID,
    budget: OrganizationBudget | None,
) -> OrganizationBudgetResponse:
    return OrganizationBudgetResponse(
        org_id=org_id,
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


def _build_budget_status(
    usage,
    budget: OrganizationBudget | None,
) -> OrganizationBudgetStatusResponse | None:
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

    return OrganizationBudgetStatusResponse(
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
