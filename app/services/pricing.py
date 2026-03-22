from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import ModelPricing

if TYPE_CHECKING:
    from app.models.schemas import EventPayload


_pricing_cache: dict[tuple[str, str], tuple[Decimal, Decimal]] = {}

async def compute_cost(
    session: AsyncSession,
    event: "EventPayload",
    occurred_at: datetime,
) -> Decimal | None:
    """
    Look up model pricing valid at occurred_at and compute estimated cost.
    Returns None if no pricing row exists for this model.

    Cost formula:
        cost = (prompt_tokens / 1000 × input_rate)
             + (completion_tokens / 1000 × output_rate)
    """
    if event.prompt_tokens is None and event.completion_tokens is None:
        return None

    rates = await _get_rates(session, event.provider, event.model, occurred_at)
    if rates is None:
        return None

    input_rate, output_rate = rates
    prompt = Decimal(event.prompt_tokens or 0)
    completion = Decimal(event.completion_tokens or 0)

    cost = (prompt / 1000 * input_rate) + (completion / 1000 * output_rate)
    return cost.quantize(Decimal("0.00000001"))


async def _get_rates(
    session: AsyncSession,
    provider: str,
    model: str,
    at: datetime,
) -> tuple[Decimal, Decimal] | None:
    cache_key = (provider.lower(), model.lower())
    if cache_key in _pricing_cache:
        return _pricing_cache[cache_key]

    stmt = (
        select(ModelPricing)
        .where(
            and_(
                ModelPricing.provider == provider,
                ModelPricing.model == model,
                ModelPricing.effective_from <= at,
                or_(
                    ModelPricing.effective_to.is_(None),
                    ModelPricing.effective_to > at,
                ),
            )
        )
        .order_by(ModelPricing.effective_from.desc())
        .limit(1)
    )

    result = await session.execute(stmt)
    pricing = result.scalar_one_or_none()

    if pricing is None:
        pricing = await _fuzzy_match(session, provider, model, at)

    if pricing is None:
        return None

    rates = (
        Decimal(str(pricing.input_cost_per_1k)),
        Decimal(str(pricing.output_cost_per_1k)),
    )
    _pricing_cache[cache_key] = rates
    return rates


async def _fuzzy_match(
    session: AsyncSession,
    provider: str,
    model: str,
    at: datetime,
) -> ModelPricing | None:
    """
    Fallback: find a pricing row where the stored model name is a prefix
    of the requested model name.
    e.g. stored "gpt-4o" matches requested "gpt-4o-2024-08-06"
    """
    stmt = (
        select(ModelPricing)
        .where(
            and_(
                ModelPricing.provider == provider,
                ModelPricing.effective_from <= at,
                or_(
                    ModelPricing.effective_to.is_(None),
                    ModelPricing.effective_to > at,
                ),
            )
        )
    )
    result = await session.execute(stmt)
    rows = result.scalars().all()

    model_lower = model.lower()
    for row in rows:
        if model_lower.startswith(row.model.lower()):
            return row

    return None


def invalidate_cache() -> None:
    """Call this after inserting new pricing rows."""
    _pricing_cache.clear()
