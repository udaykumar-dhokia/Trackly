import re
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.session import get_db
from app.models.orm import Organization, User, OrganizationMember
from app.models.schemas import UserRegisterRequest, UserResponse, UserOrganizationsResponse, OrganizationWithRoleResponse

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
    )
    db.add(new_user)
    await db.flush()

    member = OrganizationMember(org_id=org.id, user_id=new_user.id, role="admin")
    db.add(member)

    await db.commit()
    await db.refresh(new_user)

    user_resp = UserResponse.model_validate(new_user)
    user_resp.org_id = org.id
    return user_resp


@router.get(
    "/users/check",
    summary="Check if a user exists by email",
)
async def check_user_exists(
    email: str,
    org_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    # Global check
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        return {"exists": False, "name": None, "in_org": False}

    result = await db.execute(
        select(OrganizationMember).where(
            OrganizationMember.org_id == org_id, OrganizationMember.user_id == user.id
        )
    )
    is_in_org = result.scalar_one_or_none() is not None

    return {"exists": True, "name": user.name, "in_org": is_in_org}


@router.get(
    "/users/organizations",
    response_model=UserOrganizationsResponse,
    summary="List all organizations for a user",
)
async def list_user_organizations(
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> UserOrganizationsResponse:
    result = await db.execute(select(User).where(User.auth0_id == auth0_id))
    user = result.scalar_one_or_none()
    if not user:
        return UserOrganizationsResponse(organizations=[])

    # Join with Organization via OrganizationMember to get roles
    from sqlalchemy.orm import joinedload
    result = await db.execute(
        select(OrganizationMember)
        .options(joinedload(OrganizationMember.organization))
        .where(OrganizationMember.user_id == user.id)
    )
    memberships = result.scalars().all()

    orgs = [
        OrganizationWithRoleResponse(
            id=m.organization.id,
            name=m.organization.name,
            slug=m.organization.slug,
            role=m.role,
        )
        for m in memberships
    ]

    return UserOrganizationsResponse(organizations=orgs)
