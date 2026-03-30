from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.schemas import (
    PlaygroundCompareRequest,
    PlaygroundCompareResponse,
    PlaygroundDelta,
    PlaygroundModelPricing,
    PlaygroundOptionsResponse,
    PlaygroundRecentModel,
    PlaygroundScenarioSnapshot,
)
from app.services.playground import (
    build_manual_usage_basis,
    calculate_cost_from_rates,
    find_active_pricing,
    get_historical_usage_basis,
    get_project_recent_models,
    list_active_model_pricing,
    resolve_playground_window,
    scale_usage_basis,
)
from app.services.project_access import require_project_access_by_auth0_id

router = APIRouter()


@router.get(
    "/projects/{project_id}/playground/options",
    response_model=PlaygroundOptionsResponse,
    summary="Get pricing catalog and recent project model usage for the playground",
)
async def get_playground_options(
    project_id: uuid.UUID,
    auth0_id: str,
    start: datetime | None = Query(default=None),
    end: datetime | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> PlaygroundOptionsResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    window = resolve_playground_window(start, end)
    catalog_rows = await list_active_model_pricing(db)
    recent_models = await get_project_recent_models(db, project_id, window)

    return PlaygroundOptionsResponse(
        default_start=window.start,
        default_end=window.end,
        catalog=[
            PlaygroundModelPricing(
                provider=row.provider,
                model=row.model,
                input_cost_per_1k=float(row.input_cost_per_1k),
                output_cost_per_1k=float(row.output_cost_per_1k),
                effective_from=row.effective_from,
            )
            for row in catalog_rows
        ],
        recent_models=[
            PlaygroundRecentModel.model_validate(row) for row in recent_models
        ],
    )


@router.post(
    "/projects/{project_id}/playground/compare",
    response_model=PlaygroundCompareResponse,
    summary="Compare current or hypothetical traffic across two models",
)
async def compare_playground_models(
    project_id: uuid.UUID,
    body: PlaygroundCompareRequest,
    auth0_id: str,
    db: AsyncSession = Depends(get_db),
) -> PlaygroundCompareResponse:
    await require_project_access_by_auth0_id(db, project_id, auth0_id)

    source_pricing = await find_active_pricing(db, body.source_provider, body.source_model)
    target_pricing = await find_active_pricing(db, body.target_provider, body.target_model)

    if source_pricing is None:
        raise HTTPException(
            status_code=404,
            detail="Source model pricing was not found in the active catalog.",
        )
    if target_pricing is None:
        raise HTTPException(
            status_code=404,
            detail="Target model pricing was not found in the active catalog.",
        )

    traffic_multiplier = Decimal(str(body.traffic_multiplier))
    window = resolve_playground_window(body.start, body.end)
    if window.start >= window.end:
        raise HTTPException(status_code=422, detail="start must be earlier than end.")

    if body.mode == "manual":
        if body.request_count is None:
            raise HTTPException(status_code=422, detail="request_count is required for manual mode.")
        if body.avg_prompt_tokens is None:
            raise HTTPException(status_code=422, detail="avg_prompt_tokens is required for manual mode.")
        if body.avg_completion_tokens is None:
            raise HTTPException(
                status_code=422,
                detail="avg_completion_tokens is required for manual mode.",
            )

        source_basis = build_manual_usage_basis(
            request_count=body.request_count,
            avg_prompt_tokens=body.avg_prompt_tokens,
            avg_completion_tokens=body.avg_completion_tokens,
            source_input_cost_per_1k=Decimal(str(source_pricing.input_cost_per_1k)),
            source_output_cost_per_1k=Decimal(str(source_pricing.output_cost_per_1k)),
        )
    else:
        source_basis = await get_historical_usage_basis(
            db,
            project_id,
            provider=body.source_provider,
            model=body.source_model,
            feature=body.feature,
            window=window,
        )
        source_basis = scale_usage_basis(source_basis, traffic_multiplier)

    target_total_cost = calculate_cost_from_rates(
        prompt_tokens=source_basis.prompt_tokens,
        completion_tokens=source_basis.completion_tokens,
        input_cost_per_1k=Decimal(str(target_pricing.input_cost_per_1k)),
        output_cost_per_1k=Decimal(str(target_pricing.output_cost_per_1k)),
    )

    absolute_cost_change = target_total_cost - source_basis.total_cost_usd
    percentage_cost_change = None
    savings_percentage = None
    if source_basis.total_cost_usd > 0:
        percentage_cost_change = float(
            ((absolute_cost_change / source_basis.total_cost_usd) * Decimal(100)).quantize(
                Decimal("0.01")
            )
        )
        savings_percentage = float(
            (((source_basis.total_cost_usd - target_total_cost) / source_basis.total_cost_usd) * Decimal(100)).quantize(
                Decimal("0.01")
            )
        )

    return PlaygroundCompareResponse(
        mode=body.mode,
        feature=body.feature,
        window_start=window.start if body.mode == "historical" else None,
        window_end=window.end if body.mode == "historical" else None,
        traffic_multiplier=body.traffic_multiplier,
        source=PlaygroundScenarioSnapshot(
            provider=body.source_provider,
            model=body.source_model,
            matched_pricing_model=source_pricing.model,
            input_cost_per_1k=float(source_pricing.input_cost_per_1k),
            output_cost_per_1k=float(source_pricing.output_cost_per_1k),
            event_count=source_basis.event_count,
            request_count=source_basis.event_count,
            prompt_tokens=source_basis.prompt_tokens,
            completion_tokens=source_basis.completion_tokens,
            total_tokens=source_basis.total_tokens,
            total_cost_usd=float(source_basis.total_cost_usd),
            avg_latency_ms=source_basis.avg_latency_ms,
        ),
        target=PlaygroundScenarioSnapshot(
            provider=body.target_provider,
            model=body.target_model,
            matched_pricing_model=target_pricing.model,
            input_cost_per_1k=float(target_pricing.input_cost_per_1k),
            output_cost_per_1k=float(target_pricing.output_cost_per_1k),
            event_count=source_basis.event_count,
            request_count=source_basis.event_count,
            prompt_tokens=source_basis.prompt_tokens,
            completion_tokens=source_basis.completion_tokens,
            total_tokens=source_basis.total_tokens,
            total_cost_usd=float(target_total_cost),
            avg_latency_ms=source_basis.avg_latency_ms,
        ),
        delta=PlaygroundDelta(
            absolute_cost_change_usd=float(absolute_cost_change),
            percentage_cost_change=percentage_cost_change,
            savings_usd=float(max(source_basis.total_cost_usd - target_total_cost, Decimal("0"))),
            savings_percentage=savings_percentage,
        ),
    )
