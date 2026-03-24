from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
import uuid

from app.db.session import get_db
from app.models.orm import User, Feedback
from app.models.schemas import FeedbackCreate, FeedbackResponse

router = APIRouter()

@router.post(
    "/feedback",
    response_model=FeedbackResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit feedback (authenticated users)",
)
async def submit_feedback(
    body: FeedbackCreate,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> FeedbackResponse:
    result = await db.execute(select(User).where(User.auth0_id == auth0_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    feedback = Feedback(
        user_id=user.id,
        content=body.content,
        is_verified=False,
    )
    db.add(feedback)
    await db.commit()
    await db.refresh(feedback)

    return FeedbackResponse(
        id=feedback.id,
        user_id=feedback.user_id,
        user_name=user.name or user.email.split("@")[0].capitalize(),
        user_photo=user.profile_photo,
        content=feedback.content,
        is_verified=feedback.is_verified,
        created_at=feedback.created_at,
    )


@router.get(
    "/feedback",
    response_model=list[FeedbackResponse],
    summary="Get all verified feedback",
)
async def get_verified_feedback(
    db: AsyncSession = Depends(get_db),
) -> list[FeedbackResponse]:
    result = await db.execute(
        select(Feedback)
        .options(joinedload(Feedback.user))
        .where(Feedback.is_verified == True)
        .order_by(Feedback.created_at.desc())
    )
    feedbacks = result.scalars().all()

    return [
        FeedbackResponse(
            id=fb.id,
            user_id=fb.user_id,
            user_name=fb.user.name or fb.user.email.split("@")[0].capitalize(),
            user_photo=fb.user.profile_photo,
            content=fb.content,
            is_verified=fb.is_verified,
            created_at=fb.created_at,
        )
        for fb in feedbacks
    ]
