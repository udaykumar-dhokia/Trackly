import re
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import Organization, User
from app.models.schemas import UserRegisterRequest, UserResponse

router = APIRouter()

@router.post(
    "/users/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register or fetch an Auth0 user and their organization",
)
async def register_user(
    body: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    result = await db.execute(select(User).where(User.auth0_id == body.auth0_id))
    user = result.scalar_one_or_none()
    
    if user:
        return user

    base_name = body.name or body.email.split("@")[0] or "User"
    org_name = f"{base_name}'s Org"
    
    clean_name = re.sub(r"[^a-z0-9]+", "-", org_name.lower()).strip("-")
    if not clean_name:
        clean_name = "org"
        
    random_suffix = uuid.uuid4().hex[:6]
    org_slug = f"{clean_name}-{random_suffix}"

    org = Organization(name=org_name, slug=org_slug)
    db.add(org)
    await db.flush()

    new_user = User(
        auth0_id=body.auth0_id,
        email=body.email,
        name=body.name,
        org_id=org.id
    )
    db.add(new_user)
    
    await db.commit()
    await db.refresh(new_user)
    
    return new_user
