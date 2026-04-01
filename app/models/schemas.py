from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

class EventPayload(BaseModel):
    """
    A single LLM event as sent by the SDK.
    Mirrors trackly.event.TracklyEvent on the Python SDK side.
    """
    event_type: Literal["generation", "trace_start", "trace_end", "span", "step"] | None = None
    provider: str | None = None
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    estimated_cost_usd: float | None = None
    latency_ms: int | None = None
    finish_reason: str | None = None
    run_id: str | None = None
    parent_run_id: str | None = None
    trace_id: str | None = None
    span_id: str | None = None
    parent_span_id: str | None = None
    name: str | None = None
    type: str | None = None
    level: int | None = None
    status: str | None = None
    status_message: str | None = None
    input: Any | None = None
    output: Any | None = None
    metadata: dict[str, Any] | None = Field(default_factory=dict)
    feature: str | None = None
    user_id: str | None = None
    session_id: str | None = None
    environment: str | None = None
    tags: list[str] | None = Field(default_factory=list)
    extra: dict[str, Any] | None = Field(default_factory=dict)
    sdk_version: str | None = None
    started_at: datetime | None = None
    ended_at: datetime | None = None
    total_cost_usd: float | None = None
    step_count: int | None = None
    pipeline_fingerprint: str | None = None
    health_score: float | None = None
    timestamp: datetime | None = None

    @field_validator("provider", "model")
    @classmethod
    def strip_and_lower(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return v.strip()

    @field_validator("name", "trace_id", "span_id", "parent_span_id")
    @classmethod
    def strip_optional_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        value = v.strip()
        return value or None

    @model_validator(mode="after")
    def validate_shape(self) -> "EventPayload":
        if self.event_type in {"trace_start", "trace_end"}:
            if not self.trace_id:
                raise ValueError("trace_id is required for trace events")
            if self.event_type == "trace_start" and not self.name:
                raise ValueError("name is required for trace_start events")
            return self

        if self.event_type in {"span", "step", "generation"}:
            if not self.trace_id:
                raise ValueError("trace_id is required for span events")
            if not self.span_id and self.event_type != "generation":
                raise ValueError("span_id is required for span events")
            if not self.name and self.event_type != "generation":
                raise ValueError("name is required for span events")
            if (self.type == "generation" or self.event_type == "generation") and (
                not self.provider or not self.model
            ):
                raise ValueError("provider and model are required for generation spans")
            return self

        if not self.provider or not self.model:
            raise ValueError("provider and model are required for generation events")
        return self


class IngestRequest(BaseModel):
    """Batch envelope — SDK sends up to 100 events per POST."""
    events: list[EventPayload] = Field(..., min_length=1, max_length=100)


class IngestResponse(BaseModel):
    accepted: int
    rejected: int = 0


class TraceSessionSummary(BaseModel):
    session_id: str
    trace_id: str
    name: str
    status: str
    event_count: int
    total_cost: float
    total_tokens: int
    total_latency_ms: int
    distinct_models: list[str]
    first_event: datetime
    last_event: datetime
    session_group: str | None = None
    user_id: str | None = None


class TraceSessionListResponse(BaseModel):
    sessions: list[TraceSessionSummary]
    total: int


class TraceGraphNode(BaseModel):
    id: str
    label: str
    provider: str
    model: str
    node_type: str
    name: str
    total_tokens: int
    prompt_tokens: int
    completion_tokens: int
    estimated_cost_usd: float
    latency_ms: int
    feature: str | None
    finish_reason: str | None
    occurred_at: datetime
    event_count: int
    run_id: str | None
    parent_run_id: str | None
    status: str | None = None
    level: int = 0


class TraceGraphEdge(BaseModel):
    source: str
    target: str


class TraceGraphSummary(BaseModel):
    total_cost: float
    total_tokens: int
    total_latency_ms: int
    event_count: int
    distinct_models: list[str]
    time_range: list[datetime]


class TraceGraphResponse(BaseModel):
    session_id: str
    trace_id: str
    name: str
    status: str
    nodes: list[TraceGraphNode]
    edges: list[TraceGraphEdge]
    summary: TraceGraphSummary


class TraceSpanResponse(BaseModel):
    trace_id: str
    span_id: str
    parent_span_id: str | None = None
    name: str
    type: str
    level: int
    status: str
    status_message: str | None = None
    provider: str | None = None
    model: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None
    estimated_cost_usd: float | None = None
    latency_ms: int | None = None
    finish_reason: str | None = None
    input: Any | None = None
    output: Any | None = None
    metadata: dict[str, Any] | None = None
    started_at: datetime
    ended_at: datetime | None = None


class TraceListItem(BaseModel):
    trace_id: str
    name: str
    session_id: str | None = None
    user_id: str | None = None
    status: str
    total_cost_usd: float
    total_tokens: int
    total_latency_ms: int
    step_count: int
    started_at: datetime
    ended_at: datetime | None = None


class TraceListResponse(BaseModel):
    traces: list[TraceListItem]
    total: int


class TraceDetailResponse(BaseModel):
    trace_id: str
    name: str
    session_id: str | None = None
    user_id: str | None = None
    status: str
    metadata: dict[str, Any] | None = None
    tags: list[str] = Field(default_factory=list)
    total_cost_usd: float
    total_tokens: int
    total_latency_ms: int
    step_count: int
    pipeline_fingerprint: str | None = None
    health_score: float | None = None
    started_at: datetime
    ended_at: datetime | None = None
    graph: TraceGraphResponse


class TraceInsightItem(BaseModel):
    type: str
    name: str
    message: str
    value: float | int | str | None = None


class TraceInsightsResponse(BaseModel):
    project_id: uuid.UUID
    insights: list[TraceInsightItem]


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


class PlaygroundModelPricing(BaseModel):
    provider: str
    model: str
    input_cost_per_1k: float
    output_cost_per_1k: float
    effective_from: datetime


class PlaygroundRecentModel(BaseModel):
    provider: str
    model: str
    event_count: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float | None
    last_seen_at: datetime | None
    matched_pricing_model: str | None = None
    input_cost_per_1k: float | None = None
    output_cost_per_1k: float | None = None


class PlaygroundOptionsResponse(BaseModel):
    default_start: datetime
    default_end: datetime
    catalog: list[PlaygroundModelPricing]
    recent_models: list[PlaygroundRecentModel]


class PlaygroundCompareRequest(BaseModel):
    source_provider: str = Field(..., min_length=1, max_length=100)
    source_model: str = Field(..., min_length=1, max_length=255)
    target_provider: str = Field(..., min_length=1, max_length=100)
    target_model: str = Field(..., min_length=1, max_length=255)
    mode: Literal["historical", "manual"] = "historical"
    feature: str | None = Field(default=None, max_length=255)
    start: datetime | None = None
    end: datetime | None = None
    traffic_multiplier: float = Field(default=1.0, gt=0)
    request_count: int | None = Field(default=None, ge=1)
    avg_prompt_tokens: int | None = Field(default=None, ge=0)
    avg_completion_tokens: int | None = Field(default=None, ge=0)


class PlaygroundScenarioSnapshot(BaseModel):
    provider: str
    model: str
    matched_pricing_model: str | None = None
    input_cost_per_1k: float | None = None
    output_cost_per_1k: float | None = None
    event_count: int
    request_count: int
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    total_cost_usd: float
    avg_latency_ms: float | None = None


class PlaygroundDelta(BaseModel):
    absolute_cost_change_usd: float
    percentage_cost_change: float | None = None
    savings_usd: float
    savings_percentage: float | None = None


class PlaygroundCompareResponse(BaseModel):
    mode: Literal["historical", "manual"]
    feature: str | None = None
    window_start: datetime | None = None
    window_end: datetime | None = None
    traffic_multiplier: float
    source: PlaygroundScenarioSnapshot
    target: PlaygroundScenarioSnapshot
    delta: PlaygroundDelta

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


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    environment: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=2000)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    environment: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=2000)


class ProjectResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    environment: str | None
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectMemberResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    user_id: uuid.UUID
    email: str
    name: str | None
    profile_photo: str | None = None
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
    profile_photo: str | None = None
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
    current_month_events: int
    current_month_tokens: int
    current_month_cost_usd: float
    plan_limit: int
    reset_date: datetime
    budget: OrganizationBudgetStatusResponse | None = None


class OrganizationBudgetUpdate(BaseModel):
    monthly_token_limit: int | None = Field(default=None, ge=1)
    monthly_cost_limit_usd: float | None = Field(default=None, ge=0)


class OrganizationBudgetResponse(BaseModel):
    org_id: uuid.UUID
    monthly_token_limit: int | None
    monthly_cost_limit_usd: float | None
    configured: bool
    updated_at: datetime | None
    created_at: datetime | None


class OrganizationBudgetStatusResponse(BaseModel):
    monthly_token_limit: int | None
    monthly_cost_limit_usd: float | None
    current_month_tokens: int
    current_month_cost_usd: float
    token_usage_percentage: float | None
    cost_usage_percentage: float | None
    token_remaining: int | None
    cost_remaining_usd: float | None
    status: str
    updated_at: datetime | None = None


class ProjectBudgetUpdate(BaseModel):
    monthly_token_limit: int | None = Field(default=None, ge=1)
    monthly_cost_limit_usd: float | None = Field(default=None, ge=0)


class ProjectBudgetResponse(BaseModel):
    project_id: uuid.UUID
    monthly_token_limit: int | None
    monthly_cost_limit_usd: float | None
    configured: bool
    updated_at: datetime | None
    created_at: datetime | None


class ProjectBudgetStatusResponse(BaseModel):
    monthly_token_limit: int | None
    monthly_cost_limit_usd: float | None
    current_month_tokens: int
    current_month_cost_usd: float
    token_usage_percentage: float | None
    cost_usage_percentage: float | None
    token_remaining: int | None
    cost_remaining_usd: float | None
    status: str
    updated_at: datetime | None = None


class ProjectUsageResponse(BaseModel):
    project_id: uuid.UUID
    org_id: uuid.UUID
    plan: str
    current_month_usage: int
    current_month_events: int
    current_month_tokens: int
    current_month_cost_usd: float
    plan_limit: int
    reset_date: datetime
    budget: ProjectBudgetStatusResponse | None = None


class FeedbackCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)


class FeedbackResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None
    user_photo: str | None
    content: str
    is_verified: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class FeaturedUser(BaseModel):
    name: str | None = None
    profile_photo: str | None = None

class GlobalStats(BaseModel):
    total_events: int
    total_tokens: int
    total_users: int = 0
    featured_users: list[FeaturedUser] = Field(default_factory=list)

