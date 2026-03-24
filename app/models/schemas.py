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
    created_by_user_id: uuid.UUID | None = None


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key_prefix: str
    project_id: uuid.UUID | None
    created_by_user_id: uuid.UUID | None = None
    parent_key_id: uuid.UUID | None = None
    is_active: bool
    created_at: datetime
    last_used_at: datetime | None

    model_config = {"from_attributes": True}


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Returned only once at creation — includes the raw key."""
    raw_key: str


class ApiKeyAccessRequest(BaseModel):
    """Request body for creating a derived access key."""
    auth0_id: str = Field(..., min_length=1, max_length=255)


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

class UserResponse(BaseModel):
    id: uuid.UUID
    auth0_id: str
    email: str
    name: str | None
    profile_photo: str | None = None
    org_id: uuid.UUID | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserRegisterRequest(BaseModel):
    auth0_id: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    name: str | None = Field(None, max_length=255)
    profile_photo: str | None = None


class ProjectMemberResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    name: str | None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectMemberAdd(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    role: str = Field(default="member", max_length=50)


class OrganizationMemberAdd(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    name: str | None = Field(None, max_length=255)


class OrganizationMemberResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    name: str | None
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrganizationWithRoleResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    role: str

    model_config = {"from_attributes": True}


class UserOrganizationsResponse(BaseModel):
    organizations: list[OrganizationWithRoleResponse]

class OrganizationUsageResponse(BaseModel):
    org_id: uuid.UUID
    plan: str
    current_month_usage: int
    plan_limit: int
    reset_date: datetime
