from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    plan: Mapped[str] = mapped_column(String(50), nullable=False, default="free")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    projects: Mapped[list[Project]] = relationship(back_populates="organization")
    api_keys: Mapped[list[ApiKey]] = relationship(back_populates="organization")
    members: Mapped[list[OrganizationMember]] = relationship(back_populates="organization")
    budget: Mapped[OrganizationBudget | None] = relationship(back_populates="organization", uselist=False)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth0_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    profile_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    memberships: Mapped[list[OrganizationMember]] = relationship(back_populates="user")
    project_memberships: Mapped[list[ProjectMember]] = relationship(back_populates="user")
    welcome_email_delivery: Mapped[WelcomeEmailDelivery | None] = relationship(back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    environment: Mapped[str | None] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="projects")
    api_keys: Mapped[list[ApiKey]] = relationship(back_populates="project")
    events: Mapped[list[LlmEvent]] = relationship(back_populates="project")
    traces: Mapped[list[Trace]] = relationship(back_populates="project")
    spans: Mapped[list[Span]] = relationship(back_populates="project")
    members: Mapped[list[ProjectMember]] = relationship(back_populates="project")
    budget: Mapped[ProjectBudget | None] = relationship(back_populates="project", uselist=False)


class ApiKey(Base):
    __tablename__ = "api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    parent_key_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("api_keys.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(16), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="api_keys")
    project: Mapped[Project | None] = relationship(back_populates="api_keys")
    created_by: Mapped[User | None] = relationship()
    parent_key: Mapped[ApiKey | None] = relationship(remote_side="ApiKey.id", back_populates="derived_keys")
    derived_keys: Mapped[list[ApiKey]] = relationship(back_populates="parent_key")
    events: Mapped[list[LlmEvent]] = relationship(back_populates="api_key", foreign_keys="LlmEvent.api_key_id")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")

    __table_args__ = (Index("ix_org_members_org_user", "org_id", "user_id", unique=True),)


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="project_memberships")

    __table_args__ = (Index("ix_project_members_project_user", "project_id", "user_id", unique=True),)


class LlmEvent(Base):
    __tablename__ = "llm_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    parent_api_key_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    total_tokens: Mapped[int | None] = mapped_column(Integer)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Numeric(12, 8))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    finish_reason: Mapped[str | None] = mapped_column(String(50))
    feature: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[str | None] = mapped_column(String(255))
    session_id: Mapped[str | None] = mapped_column(String(255))
    run_id: Mapped[str | None] = mapped_column(String(255))
    parent_run_id: Mapped[str | None] = mapped_column(String(255))
    tags: Mapped[list | None] = mapped_column(JSONB)
    extra: Mapped[dict | None] = mapped_column(JSONB)
    sdk_version: Mapped[str | None] = mapped_column(String(50))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="events")
    api_key: Mapped[ApiKey | None] = relationship(back_populates="events", foreign_keys=[api_key_id])
    parent_api_key: Mapped[ApiKey | None] = relationship(foreign_keys=[parent_api_key_id])

    __table_args__ = (
        Index("ix_llm_events_project_occurred", "project_id", "occurred_at"),
        Index("ix_llm_events_project_feature", "project_id", "feature"),
        Index("ix_llm_events_project_user", "project_id", "user_id"),
        Index("ix_llm_events_parent_key", "parent_api_key_id"),
        Index("ix_llm_events_project_model", "project_id", "model"),
        Index("ix_llm_events_occurred_brin", "occurred_at", postgresql_using="brin"),
    )


class Trace(Base):
    __tablename__ = "traces"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    trace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    session_id: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="running")
    input: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSONB)
    output: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSONB)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB)
    tags: Mapped[list | None] = mapped_column(JSONB)
    total_cost_usd: Mapped[float] = mapped_column(Numeric(12, 8), nullable=False, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_latency_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    step_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pipeline_fingerprint: Mapped[str | None] = mapped_column(String(255))
    health_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    feature: Mapped[str | None] = mapped_column(String(255))
    environment: Mapped[str | None] = mapped_column(String(50))
    status_message: Mapped[str | None] = mapped_column(Text)
    insights: Mapped[list | None] = mapped_column(JSONB)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="traces")
    spans: Mapped[list[Span]] = relationship(back_populates="trace", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_traces_project_started", "project_id", "started_at"),
        Index("ix_traces_trace_id", "project_id", "trace_id", unique=True),
        Index("ix_traces_session", "project_id", "session_id"),
    )


class Span(Base):
    __tablename__ = "spans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    trace_ref_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("traces.id", ondelete="CASCADE"))
    trace_id: Mapped[str] = mapped_column(String(255), nullable=False)
    span_id: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_span_id: Mapped[str | None] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="span")
    input: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSONB)
    output: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSONB)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB)
    provider: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(255))
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    total_tokens: Mapped[int | None] = mapped_column(Integer)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Numeric(12, 8))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    finish_reason: Mapped[str | None] = mapped_column(String(50))
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="ok")
    status_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="spans")
    trace: Mapped[Trace | None] = relationship(back_populates="spans")

    __table_args__ = (
        Index("ix_spans_trace_id", "trace_id"),
        Index("ix_spans_parent", "parent_span_id"),
        Index("ix_spans_project_span", "project_id", "trace_id", "span_id", unique=True),
    )


class ModelPricing(Base):
    __tablename__ = "model_pricing"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    input_cost_per_1k: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    output_cost_per_1k: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (Index("ix_model_pricing_lookup", "provider", "model", "effective_from"),)


class OrganizationBudget(Base):
    __tablename__ = "organization_budgets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, unique=True)
    monthly_token_limit: Mapped[int | None] = mapped_column(BigInteger)
    monthly_cost_limit_usd: Mapped[float | None] = mapped_column(Numeric(12, 4))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="budget")
    created_by: Mapped[User | None] = relationship()


class ProjectBudget(Base):
    __tablename__ = "project_budgets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True)
    monthly_token_limit: Mapped[int | None] = mapped_column(BigInteger)
    monthly_cost_limit_usd: Mapped[float | None] = mapped_column(Numeric(12, 4))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project: Mapped[Project] = relationship(back_populates="budget")
    created_by: Mapped[User | None] = relationship()
    alerts: Mapped[list[ProjectBudgetAlert]] = relationship(back_populates="budget")


class ProjectBudgetAlert(Base):
    __tablename__ = "project_budget_alerts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_budget_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("project_budgets.id", ondelete="CASCADE"), nullable=False)
    alert_month: Mapped[str] = mapped_column(String(7), nullable=False)
    alert_type: Mapped[str] = mapped_column(String(50), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    budget: Mapped[ProjectBudget] = relationship(back_populates="alerts")

    __table_args__ = (
        Index(
            "ix_project_budget_alert_unique_month_type",
            "project_budget_id",
            "alert_month",
            "alert_type",
            unique=True,
        ),
    )


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship()


class WelcomeEmailDelivery(Base):
    __tablename__ = "welcome_email_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="resend")
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sent_to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="welcome_email_delivery")
