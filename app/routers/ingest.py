from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.orm import LlmEvent
from app.models.schemas import EventPayload, IngestRequest, IngestResponse
from app.services.auth import authenticate
from app.services.pricing import compute_cost
from app.services.rate_limit import limiter

router = APIRouter()


@router.post(
    "/events",
    response_model=IngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Ingest a batch of LLM events from the SDK",
)
@limiter.limit("120/minute")
async def ingest_events(
    request: Request, 
    body: IngestRequest,
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> IngestResponse:
    """
    Accepts a batch of LLM usage events from the Trackly SDK.

    Authentication: Bearer <api_key>
    The API key determines which project the events are attributed to.
    """
    api_key = await authenticate(db, authorization)
    if api_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if api_key.project_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This API key is not associated with a project.",
        )

    accepted = 0
    rejected = 0
    now = datetime.now(timezone.utc)

    for event in body.events:
        try:
            occurred_at = event.timestamp or now
            cost = await compute_cost(db, event, occurred_at)

            orm_event = LlmEvent(
                project_id=api_key.project_id,
                api_key_id=api_key.id,
                parent_api_key_id=api_key.parent_key_id,
                provider=event.provider,
                model=event.model,
                prompt_tokens=event.prompt_tokens,
                completion_tokens=event.completion_tokens,
                total_tokens=_compute_total(event),
                estimated_cost_usd=float(cost) if cost is not None else None,
                latency_ms=event.latency_ms,
                finish_reason=event.finish_reason,
                feature=event.feature,
                user_id=str(api_key.created_by_user_id) if api_key.created_by_user_id else event.user_id,
                session_id=event.session_id,
                run_id=event.run_id,
                parent_run_id=event.parent_run_id,
                tags=event.tags or None,
                extra=event.extra or None,
                sdk_version=event.sdk_version,
                occurred_at=occurred_at,
                ingested_at=now,
            )
            db.add(orm_event)
            accepted += 1

        except Exception:
            rejected += 1

    return IngestResponse(accepted=accepted, rejected=rejected)


def _compute_total(event: EventPayload) -> int | None:
    """Use SDK-provided total if present, else sum the parts."""
    if event.total_tokens is not None:
        return event.total_tokens
    if event.prompt_tokens is not None or event.completion_tokens is not None:
        return (event.prompt_tokens or 0) + (event.completion_tokens or 0)
    return None
