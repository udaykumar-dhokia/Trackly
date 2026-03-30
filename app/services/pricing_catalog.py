from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import TypedDict

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import ModelPricing
from app.services.pricing import invalidate_cache


class PricingCatalogEntry(TypedDict):
    provider: str
    model: str
    input_cost: float
    output_cost: float


# Costs are normalized to USD per 1,000 text tokens.
# Verified from official provider pricing/model pages in March 2026.
PRICING_CATALOG: list[PricingCatalogEntry] = [
    {"provider": "openai", "model": "gpt-5.4", "input_cost": 0.002500, "output_cost": 0.015000},
    {"provider": "openai", "model": "gpt-5.4-mini", "input_cost": 0.000750, "output_cost": 0.004500},
    {"provider": "openai", "model": "gpt-5.4-nano", "input_cost": 0.000200, "output_cost": 0.001250},
    {"provider": "openai", "model": "gpt-5.4-pro", "input_cost": 0.030000, "output_cost": 0.180000},
    {"provider": "openai", "model": "gpt-5.1", "input_cost": 0.001250, "output_cost": 0.010000},
    {"provider": "openai", "model": "gpt-5", "input_cost": 0.001250, "output_cost": 0.010000},
    {"provider": "openai", "model": "gpt-5-mini", "input_cost": 0.000250, "output_cost": 0.002000},
    {"provider": "openai", "model": "gpt-5-nano", "input_cost": 0.000050, "output_cost": 0.000400},
    {"provider": "openai", "model": "gpt-5-pro", "input_cost": 0.015000, "output_cost": 0.120000},
    {"provider": "openai", "model": "gpt-5-codex", "input_cost": 0.001250, "output_cost": 0.010000},
    {"provider": "openai", "model": "gpt-5-chat-latest", "input_cost": 0.001250, "output_cost": 0.010000},
    {"provider": "openai", "model": "gpt-4.1", "input_cost": 0.002000, "output_cost": 0.008000},
    {"provider": "openai", "model": "gpt-4.1-mini", "input_cost": 0.000400, "output_cost": 0.001600},
    {"provider": "openai", "model": "gpt-4.1-nano", "input_cost": 0.000100, "output_cost": 0.000400},
    {"provider": "openai", "model": "gpt-4o", "input_cost": 0.002500, "output_cost": 0.010000},
    {"provider": "openai", "model": "gpt-4o-mini", "input_cost": 0.000150, "output_cost": 0.000600},
    {"provider": "openai", "model": "o4-mini", "input_cost": 0.001100, "output_cost": 0.004400},
    {"provider": "openai", "model": "o3", "input_cost": 0.002000, "output_cost": 0.008000},
    {"provider": "openai", "model": "o3-mini", "input_cost": 0.001100, "output_cost": 0.004400},
    {"provider": "openai", "model": "o1", "input_cost": 0.015000, "output_cost": 0.060000},
    {"provider": "openai", "model": "o1-mini", "input_cost": 0.001100, "output_cost": 0.004400},
    {"provider": "anthropic", "model": "claude-opus-4-6", "input_cost": 0.005000, "output_cost": 0.025000},
    {"provider": "anthropic", "model": "claude-opus-4-5", "input_cost": 0.005000, "output_cost": 0.025000},
    {"provider": "anthropic", "model": "claude-opus-4-1", "input_cost": 0.015000, "output_cost": 0.075000},
    {"provider": "anthropic", "model": "claude-opus-4", "input_cost": 0.015000, "output_cost": 0.075000},
    {"provider": "anthropic", "model": "claude-sonnet-4-6", "input_cost": 0.003000, "output_cost": 0.015000},
    {"provider": "anthropic", "model": "claude-sonnet-4-5", "input_cost": 0.003000, "output_cost": 0.015000},
    {"provider": "anthropic", "model": "claude-sonnet-4", "input_cost": 0.003000, "output_cost": 0.015000},
    {"provider": "anthropic", "model": "claude-3-7-sonnet-latest", "input_cost": 0.003000, "output_cost": 0.015000},
    {"provider": "anthropic", "model": "claude-3-7-sonnet", "input_cost": 0.003000, "output_cost": 0.015000},
    {"provider": "anthropic", "model": "claude-haiku-4-5", "input_cost": 0.001000, "output_cost": 0.005000},
    {"provider": "anthropic", "model": "claude-3-5-sonnet", "input_cost": 0.003000, "output_cost": 0.015000},
    {"provider": "anthropic", "model": "claude-3-5-haiku", "input_cost": 0.000800, "output_cost": 0.004000},
    {"provider": "anthropic", "model": "claude-3-opus", "input_cost": 0.015000, "output_cost": 0.075000},
    {"provider": "anthropic", "model": "claude-3-haiku", "input_cost": 0.000250, "output_cost": 0.001250},
    {"provider": "google", "model": "gemini-2.5-pro", "input_cost": 0.001250, "output_cost": 0.010000},
    {"provider": "google", "model": "gemini-2.5-flash", "input_cost": 0.000300, "output_cost": 0.002500},
    {"provider": "google", "model": "gemini-2.5-flash-lite", "input_cost": 0.000100, "output_cost": 0.000400},
    {"provider": "google", "model": "gemini-2.0-flash", "input_cost": 0.000100, "output_cost": 0.000400},
    {"provider": "google", "model": "gemini-2.0-flash-lite", "input_cost": 0.000075, "output_cost": 0.000300},
    {"provider": "google", "model": "gemini-1.5-pro", "input_cost": 0.001250, "output_cost": 0.005000},
    {"provider": "google", "model": "gemini-1.5-flash", "input_cost": 0.000075, "output_cost": 0.000300},
    {"provider": "google", "model": "gemini-1.5-flash-8b", "input_cost": 0.000038, "output_cost": 0.000150},
    {"provider": "groq", "model": "openai/gpt-oss-20b", "input_cost": 0.000075, "output_cost": 0.000300},
    {"provider": "groq", "model": "openai/gpt-oss-120b", "input_cost": 0.000150, "output_cost": 0.000600},
    {"provider": "groq", "model": "kimi-k2-0905", "input_cost": 0.001000, "output_cost": 0.003000},
    {"provider": "groq", "model": "moonshotai/kimi-k2-instruct", "input_cost": 0.001000, "output_cost": 0.003000},
    {"provider": "groq", "model": "moonshotai/kimi-k2-instruct-0905", "input_cost": 0.001000, "output_cost": 0.003000},
    {"provider": "groq", "model": "llama-4-scout-17b-16e-instruct", "input_cost": 0.000110, "output_cost": 0.000340},
    {"provider": "groq", "model": "meta-llama/llama-4-scout-17b-16e-instruct", "input_cost": 0.000110, "output_cost": 0.000340},
    {"provider": "groq", "model": "qwen3-32b", "input_cost": 0.000290, "output_cost": 0.000590},
    {"provider": "groq", "model": "qwen/qwen3-32b", "input_cost": 0.000290, "output_cost": 0.000590},
    {"provider": "groq", "model": "llama-3.3-70b-versatile", "input_cost": 0.000590, "output_cost": 0.000790},
    {"provider": "groq", "model": "llama-3.1-8b-instant", "input_cost": 0.000050, "output_cost": 0.000080},
    {"provider": "mistral", "model": "mistral-large-latest", "input_cost": 0.002000, "output_cost": 0.006000},
    {"provider": "mistral", "model": "mistral-medium-latest", "input_cost": 0.000400, "output_cost": 0.002000},
    {"provider": "mistral", "model": "mistral-small-latest", "input_cost": 0.000100, "output_cost": 0.000300},
    {"provider": "mistral", "model": "pixtral-large-latest", "input_cost": 0.002000, "output_cost": 0.006000},
    {"provider": "mistral", "model": "codestral-latest", "input_cost": 0.000300, "output_cost": 0.000900},
    {"provider": "mistral", "model": "ministral-8b-latest", "input_cost": 0.000150, "output_cost": 0.000150},
    {"provider": "mistral", "model": "mistral-large-2512", "input_cost": 0.000500, "output_cost": 0.001500},
    {"provider": "cohere", "model": "command-r-plus-08-2024", "input_cost": 0.002500, "output_cost": 0.010000},
    {"provider": "cohere", "model": "command-r-plus", "input_cost": 0.002500, "output_cost": 0.010000},
    {"provider": "cohere", "model": "command-r-08-2024", "input_cost": 0.000150, "output_cost": 0.000600},
    {"provider": "cohere", "model": "command-r", "input_cost": 0.000150, "output_cost": 0.000600},
    {"provider": "cohere", "model": "command-r7b-12-2024", "input_cost": 0.000038, "output_cost": 0.000150},
    {"provider": "cohere", "model": "command-r7b", "input_cost": 0.000038, "output_cost": 0.000150},
    {"provider": "deepseek", "model": "deepseek-chat", "input_cost": 0.000280, "output_cost": 0.000420},
    {"provider": "deepseek", "model": "deepseek-reasoner", "input_cost": 0.000550, "output_cost": 0.002190},
    {"provider": "ollama", "model": "llama3.2", "input_cost": 0.0, "output_cost": 0.0},
    {"provider": "ollama", "model": "llama3.1", "input_cost": 0.0, "output_cost": 0.0},
    {"provider": "ollama", "model": "mistral", "input_cost": 0.0, "output_cost": 0.0},
    {"provider": "ollama", "model": "gemma3", "input_cost": 0.0, "output_cost": 0.0},
    {"provider": "ollama", "model": "qwen2.5", "input_cost": 0.0, "output_cost": 0.0},
    {"provider": "ollama", "model": "phi4", "input_cost": 0.0, "output_cost": 0.0},
    {"provider": "ollama", "model": "deepseek-r1", "input_cost": 0.0, "output_cost": 0.0},
]


async def sync_pricing_catalog(
    session: AsyncSession,
    now: datetime | None = None,
) -> dict[str, int]:
    now = now or datetime.now(timezone.utc)
    added = 0
    updated = 0
    skipped = 0

    for row in PRICING_CATALOG:
        stmt = select(ModelPricing).where(
            and_(
                ModelPricing.provider == row["provider"],
                ModelPricing.model == row["model"],
                ModelPricing.effective_to.is_(None),
            )
        )
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing is not None:
            same_price = (
                Decimal(str(existing.input_cost_per_1k)) == Decimal(str(row["input_cost"]))
                and Decimal(str(existing.output_cost_per_1k)) == Decimal(str(row["output_cost"]))
            )
            if same_price:
                skipped += 1
                continue
            existing.effective_to = now
            updated += 1
        else:
            added += 1

        session.add(
            ModelPricing(
                provider=row["provider"],
                model=row["model"],
                input_cost_per_1k=row["input_cost"],
                output_cost_per_1k=row["output_cost"],
                effective_from=now,
            )
        )

    if added or updated:
        invalidate_cache()
    return {"added": added, "updated": updated, "skipped": skipped}
