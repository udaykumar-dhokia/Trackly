from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger, Boolean, DateTime, ForeignKey,
    Index, Integer, Numeric, String, Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

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


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth0_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=True)
    profile_photo: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    memberships: Mapped[list[OrganizationMember]] = relationship(back_populates="user")
    project_memberships: Mapped[list[ProjectMember]] = relationship(back_populates="user")


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    environment: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="projects")
    api_keys: Mapped[list[ApiKey]] = relationship(back_populates="project")
    events: Mapped[list[LlmEvent]] = relationship(back_populates="project")
    members: Mapped[list[ProjectMember]] = relationship(back_populates="project")


class ApiKey(Base):
    """
    We never store the raw key — only the bcrypt hash and the visible prefix.
    The prefix (e.g. "tk_live_ab") lets users identify which key it is
    in the dashboard without exposing the secret.

    created_by_user_id — the user who owns/created this key.
    parent_key_id — if set, this is a derived "access" key linked to a master key.
    """
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
    events: Mapped[list[LlmEvent]] = relationship(back_populates="api_key")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped[Organization] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="memberships")

    __table_args__ = (
        Index("ix_org_members_org_user", "org_id", "user_id", unique=True),
    )


class ProjectMember(Base):
    __tablename__ = "project_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="members")
    user: Mapped[User] = relationship(back_populates="project_memberships")

    __table_args__ = (
        Index("ix_project_members_project_user", "project_id", "user_id", unique=True),
    )


class LlmEvent(Base):
    """
    Core fact table. One row per LLM call.

    occurred_at  — when the call happened in the user's app (from SDK).
    ingested_at  — when OUR server received it.
    Dashboard queries always use occurred_at for accuracy.
    Cost is computed at ingest time and stored — never recomputed on read.
    """
    __tablename__ = "llm_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    api_key_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    parent_api_key_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)

    # Provider info
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)

    # Token counts
    prompt_tokens: Mapped[int | None] = mapped_column(Integer)
    completion_tokens: Mapped[int | None] = mapped_column(Integer)
    total_tokens: Mapped[int | None] = mapped_column(Integer)

    # Cost computed at ingest from model_pricing table
    estimated_cost_usd: Mapped[float | None] = mapped_column(Numeric(12, 8))

    # Performance
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    finish_reason: Mapped[str | None] = mapped_column(String(50))

    # User-supplied metadata
    feature: Mapped[str | None] = mapped_column(String(255))
    user_id: Mapped[str | None] = mapped_column(String(255))
    session_id: Mapped[str | None] = mapped_column(String(255))

    # LangChain tracing
    run_id: Mapped[str | None] = mapped_column(String(255))
    parent_run_id: Mapped[str | None] = mapped_column(String(255))

    # Flexible fields stored as JSONB
    tags: Mapped[list | None] = mapped_column(JSONB)
    extra: Mapped[dict | None] = mapped_column(JSONB)

    # SDK metadata
    sdk_version: Mapped[str | None] = mapped_column(String(50))

    # Timestamps — occurred_at comes from SDK, ingested_at is server-set
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ingested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="events")
    api_key: Mapped[ApiKey | None] = relationship(back_populates="events", foreign_keys=[api_key_id])
    parent_api_key: Mapped[ApiKey | None] = relationship(foreign_keys=[parent_api_key_id])

    __table_args__ = (
        # Primary query pattern: project + time range
        Index("ix_llm_events_project_occurred", "project_id", "occurred_at"),
        # Feature breakdown queries
        Index("ix_llm_events_project_feature", "project_id", "feature"),
        # Per-user cost attribution
        Index("ix_llm_events_project_user", "project_id", "user_id"),
        # Parent API key filtering
        Index("ix_llm_events_parent_key", "parent_api_key_id"),
        # Model/provider breakdowns
        Index("ix_llm_events_project_model", "project_id", "model"),
        # BRIN index for append-only time column — cheap and fast for range scans
        Index("ix_llm_events_occurred_brin", "occurred_at", postgresql_using="brin"),
    )


class ModelPricing(Base):
    """
    Cost per 1,000 tokens for each model, with time-bounded validity.
    When a provider changes prices, insert a new row with effective_from
    set to the change date and close the old row with effective_to.

    effective_to = NULL means "currently active".
    """
    __tablename__ = "model_pricing"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    input_cost_per_1k: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    output_cost_per_1k: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    effective_from: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    effective_to: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_model_pricing_lookup", "provider", "model", "effective_from"),
    )
