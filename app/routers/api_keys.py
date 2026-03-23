from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import ApiKey, OrganizationMember, Project, ProjectMember, User
from app.models.schemas import (
    ApiKeyAccessRequest,
    ApiKeyCreate,
    ApiKeyCreatedResponse,
    ApiKeyResponse,
)
from app.services.auth import generate_api_key

router = APIRouter()


async def _check_admin_or_owner(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
) -> bool:
    """
    Returns True if the user is an org owner/admin,
    or if project_id is given, a project admin.
    """
    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id,
        )
    )
    org_member = result.scalar_one_or_none()
    if org_member and org_member.role in ("owner", "admin"):
        return True

    if project_id:
        result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
        project_member = result.scalar_one_or_none()
        if project_member and project_member.role == "admin":
            return True

    return False


@router.post(
    "/organizations/{org_id}/api-keys",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new API key",
)
async def create_api_key(
    org_id: uuid.UUID,
    body: ApiKeyCreate,
    db: AsyncSession = Depends(get_db),
) -> ApiKeyCreatedResponse:
    """
    Creates a new API key for an organization.

    Only org owners/admins or project admins may create keys.
    The raw key is returned ONCE in the response and never stored.
    """
    if body.created_by_user_id:
        is_admin = await _check_admin_or_owner(
            db, org_id, body.created_by_user_id, body.project_id
        )
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only project admins or org owners can create API keys.",
            )

    if body.project_id:
        result = await db.execute(
            select(Project).where(
                Project.id == body.project_id,
                Project.org_id == org_id,
            )
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found in this organization.",
            )

    raw_key, key_hash, key_prefix = generate_api_key()

    api_key = ApiKey(
        org_id=org_id,
        project_id=body.project_id,
        created_by_user_id=body.created_by_user_id,
        name=body.name,
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db.add(api_key)
    await db.flush()
    await db.refresh(api_key)

    return ApiKeyCreatedResponse(
        id=api_key.id,
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        project_id=api_key.project_id,
        created_by_user_id=api_key.created_by_user_id,
        parent_key_id=api_key.parent_key_id,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        raw_key=raw_key,
    )


@router.post(
    "/api-keys/{key_id}/access",
    response_model=ApiKeyCreatedResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a derived access key bound to a user",
)
async def access_api_key(
    key_id: uuid.UUID,
    body: ApiKeyAccessRequest,
    db: AsyncSession = Depends(get_db),
) -> ApiKeyCreatedResponse:
    """
    Creates a derived API key for a user, linked to the parent key.

    The user must be a member of the project the parent key is scoped to.
    When this derived key is used for ingestion, the user_id is
    automatically attributed to the event.
    """
    # Look up the parent key
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id, ApiKey.is_active == True)
    )
    parent_key = result.scalar_one_or_none()
    if not parent_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found or is inactive.",
        )

    # Look up the requesting user by auth0_id
    result = await db.execute(
        select(User).where(User.auth0_id == body.auth0_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if parent_key.project_id:
        result = await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == parent_key.project_id,
                ProjectMember.user_id == user.id,
            )
        )
        if not result.scalar_one_or_none():
            result = await db.execute(
                select(OrganizationMember).where(
                    OrganizationMember.org_id == parent_key.org_id,
                    OrganizationMember.user_id == user.id,
                )
            )
            if not result.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You must be a member of this project to get an access key.",
                )

    result = await db.execute(
        select(ApiKey).where(
            ApiKey.parent_key_id == key_id,
            ApiKey.created_by_user_id == user.id,
            ApiKey.is_active == True,
        )
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have an active access key for this API key.",
        )

    raw_key, key_hash, key_prefix = generate_api_key()

    derived = ApiKey(
        org_id=parent_key.org_id,
        project_id=parent_key.project_id,
        created_by_user_id=user.id,
        parent_key_id=parent_key.id,
        name=f"{parent_key.name} — {user.name or user.email}",
        key_hash=key_hash,
        key_prefix=key_prefix,
    )
    db.add(derived)
    await db.flush()
    await db.refresh(derived)

    return ApiKeyCreatedResponse(
        id=derived.id,
        name=derived.name,
        key_prefix=derived.key_prefix,
        project_id=derived.project_id,
        created_by_user_id=derived.created_by_user_id,
        parent_key_id=derived.parent_key_id,
        is_active=derived.is_active,
        created_at=derived.created_at,
        last_used_at=derived.last_used_at,
        raw_key=raw_key,
    )


@router.get(
    "/organizations/{org_id}/api-keys",
    response_model=list[ApiKeyResponse],
    summary="List all API keys for an organization",
)
async def list_api_keys(
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[ApiKeyResponse]:
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.org_id == org_id)
        .order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()


@router.delete(
    "/api-keys/{key_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Revoke an API key",
)
async def revoke_api_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Soft-deletes by setting is_active=False.
    Also deactivates all derived keys if this is a master key.
    Events logged by this key are preserved — only future auth is blocked.
    """
    result = await db.execute(
        select(ApiKey).where(ApiKey.id == key_id)
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found.")

    await db.execute(
        update(ApiKey)
        .where(ApiKey.id == key_id)
        .values(is_active=False)
    )

    await db.execute(
        update(ApiKey)
        .where(ApiKey.parent_key_id == key_id)
        .values(is_active=False)
    )
