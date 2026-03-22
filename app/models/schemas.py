from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

class EventPayload(BaseModel):
    """
    A single LLM event as sent by the SDK.
    Mirrors trackly.event.TracklyEvent on the Python SDK side.
    """
    provider: str
    model: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    latency_ms: int | None = None
    finish_reason: str | None = None
    run_id: str | None = None
    parent_run_id: str | None = None
    feature: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    environment: str | None = None
    tags: list[str] = Field(default_factory=list)
    extra: dict[str, Any] = Field(default_factory=dict)
    sdk_version: str | None = None
    timestamp: datetime | None = None

    @field_validator("provider", "model")
    @classmethod
    def strip_and_lower(cls, v: str) -> str:
        return v.strip()


class IngestRequest(BaseModel):
    """Batch envelope — SDK sends up to 100 events per POST."""
    events: list[EventPayload] = Field(..., min_length=1, max_length=100)


class IngestResponse(BaseModel):
    accepted: int
    rejected: int = 0


class ApiKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    project_id: uuid.UUID | None = None


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    project_id: uuid.UUID | None
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Returned only once at creation — includes the raw key."""
    raw_key: str


class UsageSummary(BaseModel):
    """Top-level stats for a project over a time window."""
    total_events: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float | None
    period_start: datetime
    period_end: datetime


class UsageByModel(BaseModel):
    model: str
    provider: str
    event_count: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float | None


class UsageByFeature(BaseModel):
    feature: str | None
    event_count: int
    total_tokens: int
    total_cost_usd: float


class DailyUsage(BaseModel):
    date: str
    event_count: int
    total_tokens: int
    total_cost_usd: float
