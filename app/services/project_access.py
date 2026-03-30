from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.orm import OrganizationMember, Project, ProjectMember, User


async def get_user_by_auth0_id(
    db: AsyncSession,
    auth0_id: str,
) -> User | None:
    result = await db.execute(select(User).where(User.auth0_id == auth0_id))
    return result.scalar_one_or_none()


async def get_org_membership(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> OrganizationMember | None:
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none()


async def is_org_admin_or_owner(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    membership = await get_org_membership(db, org_id, user_id)
    return membership is not None and membership.role in ("owner", "admin")


async def has_project_access(
    db: AsyncSession,
    org_id: uuid.UUID,
    project_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    if await is_org_admin_or_owner(db, org_id, user_id):
        return True

    result = await db.execute(
        select(ProjectMember.id).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def list_accessible_projects(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> list[Project]:
    if await is_org_admin_or_owner(db, org_id, user_id):
        result = await db.execute(
            select(Project).where(Project.org_id == org_id).order_by(Project.created_at.asc())
        )
        return result.scalars().all()

    result = await db.execute(
        select(Project)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Project.org_id == org_id,
            ProjectMember.user_id == user_id,
        )
        .order_by(Project.created_at.asc())
    )
    return result.scalars().all()


async def get_accessible_project_ids(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
) -> set[uuid.UUID]:
    projects = await list_accessible_projects(db, org_id, user_id)
    return {project.id for project in projects}


async def require_project_access_by_auth0_id(
    db: AsyncSession,
    project_id: uuid.UUID,
    auth0_id: str,
) -> tuple[User, Project]:
    user = await get_user_by_auth0_id(db, auth0_id)
    if user is None:
        raise HTTPException(status_code=403, detail="Requester not found.")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    if not await has_project_access(db, project.org_id, project.id, user.id):
        raise HTTPException(status_code=403, detail="You do not have access to this project.")

    return user, project
