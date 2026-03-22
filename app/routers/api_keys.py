from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import ApiKey, Project
from app.models.schemas import ApiKeyCreate, ApiKeyCreatedResponse, ApiKeyResponse
from app.services.auth import generate_api_key

router = APIRouter()


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

    The raw key is returned ONCE in the response and never stored.
    The caller must save it immediately — it cannot be retrieved again.

    If project_id is provided, the key is scoped to that project.
    Keys without a project_id cannot be used to ingest events.
    """
    # Validate project belongs to this org if provided
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
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at,
        raw_key=raw_key,   # shown only once
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
