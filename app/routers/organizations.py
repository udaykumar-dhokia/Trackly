from __future__ import annotations

import uuid
import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import Organization, Project

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

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


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    environment: str | None = Field(default=None, max_length=50)


class ProjectResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    environment: str | None

    model_config = {"from_attributes": True}


# ── Organizations ─────────────────────────────────────────────────────────────

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
    # Check slug uniqueness
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
    await db.flush()   # get the generated id before commit
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


# ── Projects ──────────────────────────────────────────────────────────────────

@router.post(
    "/organizations/{org_id}/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a project under an organization",
)
async def create_project(
    org_id: uuid.UUID,
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    await _get_org_or_404(db, org_id)

    project = Project(
        org_id=org_id,
        name=body.name,
        environment=body.environment,
    )
    db.add(project)
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
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    await _get_org_or_404(db, org_id)

    result = await db.execute(
        select(Project).where(Project.org_id == org_id)
    )
    return result.scalars().all()


@router.get(
    "/projects/{project_id}",
    response_model=ProjectResponse,
    summary="Get a single project",
)
async def get_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    result = await db.execute(
        select(Project).where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _get_org_or_404(db: AsyncSession, org_id: uuid.UUID) -> Organization:
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")
    return org
