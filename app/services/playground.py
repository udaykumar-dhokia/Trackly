from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import LlmEvent, ModelPricing


MONEY_PRECISION = Decimal("0.00000001")


@dataclass(slots=True)
class PlaygroundWindow:
    start: datetime
    end: datetime


@dataclass(slots=True)
class PlaygroundUsageBasis:
    event_count: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    total_cost_usd: Decimal
    avg_latency_ms: float | None
    last_seen_at: datetime | None = None


def default_playground_window() -> PlaygroundWindow:
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30)
    return PlaygroundWindow(start=start, end=end)


def resolve_playground_window(
    start: datetime | None,
    end: datetime | None,
) -> PlaygroundWindow:
    default_window = default_playground_window()
    return PlaygroundWindow(
        start=start or default_window.start,
        end=end or default_window.end,
    )


async def list_active_model_pricing(
    db: AsyncSession,
) -> list[ModelPricing]:
    stmt = (
        select(ModelPricing)
        .where(
            ModelPricing.effective_to.is_(None),
            ModelPricing.provider != "ollama",
        )
        .order_by(ModelPricing.provider.asc(), ModelPricing.model.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def find_active_pricing(
    db: AsyncSession,
    provider: str,
    model: str,
) -> ModelPricing | None:
    normalized_provider = provider.strip().lower()
    normalized_model = model.strip().lower()

    stmt = select(ModelPricing).where(
        ModelPricing.effective_to.is_(None),
        ModelPricing.provider == normalized_provider,
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    exact = next((row for row in rows if row.model.lower() == normalized_model), None)
    if exact is not None:
        return exact

    prefix_match = next(
        (row for row in rows if normalized_model.startswith(row.model.lower())),
        None,
    )
    if prefix_match is not None:
        return prefix_match

    reverse_prefix_match = next(
        (row for row in rows if row.model.lower().startswith(normalized_model)),
        None,
    )
    if reverse_prefix_match is not None:
        return reverse_prefix_match

    return None


async def get_project_recent_models(
    db: AsyncSession,
    project_id: uuid.UUID,
    window: PlaygroundWindow,
) -> list[dict]:
    stmt = (
        select(
            LlmEvent.provider,
            LlmEvent.model,
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(LlmEvent.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
            func.avg(LlmEvent.latency_ms).label("avg_latency_ms"),
            func.max(LlmEvent.occurred_at).label("last_seen_at"),
        )
        .where(
            LlmEvent.project_id == project_id,
            LlmEvent.occurred_at >= window.start,
            LlmEvent.occurred_at < window.end,
        )
        .group_by(LlmEvent.provider, LlmEvent.model)
        .order_by(text("total_cost DESC"), text("event_count DESC"))
        .limit(24)
    )
    rows = (await db.execute(stmt)).all()

    recent_models: list[dict] = []
    for row in rows:
        pricing = await find_active_pricing(db, row.provider, row.model)
        recent_models.append(
            {
                "provider": row.provider,
                "model": row.model,
                "event_count": row.event_count,
                "prompt_tokens": row.prompt_tokens,
                "completion_tokens": row.completion_tokens,
                "total_tokens": row.total_tokens,
                "total_cost_usd": float(row.total_cost or 0),
                "avg_latency_ms": float(row.avg_latency_ms) if row.avg_latency_ms is not None else None,
                "last_seen_at": row.last_seen_at,
                "matched_pricing_model": pricing.model if pricing is not None else None,
                "input_cost_per_1k": float(pricing.input_cost_per_1k) if pricing is not None else None,
                "output_cost_per_1k": float(pricing.output_cost_per_1k) if pricing is not None else None,
            }
        )
    return recent_models


async def get_historical_usage_basis(
    db: AsyncSession,
    project_id: uuid.UUID,
    *,
    provider: str,
    model: str,
    feature: str | None,
    window: PlaygroundWindow,
) -> PlaygroundUsageBasis:
    stmt = (
        select(
            func.count(LlmEvent.id).label("event_count"),
            func.coalesce(func.sum(LlmEvent.prompt_tokens), 0).label("prompt_tokens"),
            func.coalesce(func.sum(LlmEvent.completion_tokens), 0).label("completion_tokens"),
            func.coalesce(func.sum(LlmEvent.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.sum(LlmEvent.estimated_cost_usd), 0).label("total_cost"),
            func.avg(LlmEvent.latency_ms).label("avg_latency_ms"),
            func.max(LlmEvent.occurred_at).label("last_seen_at"),
        )
        .where(
            LlmEvent.project_id == project_id,
            LlmEvent.provider == provider,
            LlmEvent.model == model,
            LlmEvent.occurred_at >= window.start,
            LlmEvent.occurred_at < window.end,
        )
    )
    if feature:
        stmt = stmt.where(LlmEvent.feature == feature)

    row = (await db.execute(stmt)).one()
    if not row.event_count:
        raise HTTPException(
            status_code=404,
            detail="No historical usage found for the selected source model in the chosen window.",
        )

    return PlaygroundUsageBasis(
        event_count=row.event_count or 0,
        prompt_tokens=row.prompt_tokens or 0,
        completion_tokens=row.completion_tokens or 0,
        total_tokens=row.total_tokens or 0,
        total_cost_usd=Decimal(str(row.total_cost or 0)),
        avg_latency_ms=float(row.avg_latency_ms) if row.avg_latency_ms is not None else None,
        last_seen_at=row.last_seen_at,
    )


def build_manual_usage_basis(
    *,
    request_count: int,
    avg_prompt_tokens: int,
    avg_completion_tokens: int,
    source_input_cost_per_1k: Decimal,
    source_output_cost_per_1k: Decimal,
) -> PlaygroundUsageBasis:
    prompt_tokens = request_count * avg_prompt_tokens
    completion_tokens = request_count * avg_completion_tokens
    total_tokens = prompt_tokens + completion_tokens
    total_cost = calculate_cost_from_rates(
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        input_cost_per_1k=source_input_cost_per_1k,
        output_cost_per_1k=source_output_cost_per_1k,
    )

    return PlaygroundUsageBasis(
        event_count=request_count,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        total_cost_usd=total_cost,
        avg_latency_ms=None,
        last_seen_at=None,
    )


def calculate_cost_from_rates(
    *,
    prompt_tokens: int,
    completion_tokens: int,
    input_cost_per_1k: Decimal,
    output_cost_per_1k: Decimal,
) -> Decimal:
    prompt = Decimal(prompt_tokens)
    completion = Decimal(completion_tokens)
    return (
        (prompt / Decimal(1000)) * input_cost_per_1k
        + (completion / Decimal(1000)) * output_cost_per_1k
    ).quantize(MONEY_PRECISION)


def scale_usage_basis(
    usage: PlaygroundUsageBasis,
    multiplier: Decimal,
) -> PlaygroundUsageBasis:
    scaled_prompt_tokens = _scale_int(usage.prompt_tokens, multiplier)
    scaled_completion_tokens = _scale_int(usage.completion_tokens, multiplier)
    scaled_total_tokens = scaled_prompt_tokens + scaled_completion_tokens

    return PlaygroundUsageBasis(
        event_count=_scale_int(usage.event_count, multiplier),
        prompt_tokens=scaled_prompt_tokens,
        completion_tokens=scaled_completion_tokens,
        total_tokens=scaled_total_tokens,
        total_cost_usd=(usage.total_cost_usd * multiplier).quantize(MONEY_PRECISION),
        avg_latency_ms=usage.avg_latency_ms,
        last_seen_at=usage.last_seen_at,
    )


def _scale_int(value: int, multiplier: Decimal) -> int:
    return int((Decimal(value) * multiplier).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
