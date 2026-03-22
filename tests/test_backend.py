"""
Tests for the Trackly backend.

All tests run fully offline using FastAPI's TestClient and
SQLite in-memory via SQLAlchemy (swapped in for PostgreSQL).
No real DB or network connection required.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.schemas import EventPayload, IngestRequest


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _make_event(**kwargs) -> dict:
    base = {
        "provider": "openai",
        "model": "gpt-4o",
        "prompt_tokens": 100,
        "completion_tokens": 50,
        "total_tokens": 150,
        "latency_ms": 420,
        "finish_reason": "stop",
        "feature": "test-feature",
        "user_id": "u_test",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sdk_version": "0.1.0",
    }
    base.update(kwargs)
    return base


def _make_api_key_mock(project_id: uuid.UUID | None = None):
    key = MagicMock()
    key.id = uuid.uuid4()
    key.project_id = project_id or uuid.uuid4()
    key.org_id = uuid.uuid4()
    return key


# ── Schema validation ─────────────────────────────────────────────────────────

class TestEventPayload:

    def test_valid_event(self):
        e = EventPayload(**_make_event())
        assert e.provider == "openai"
        assert e.model == "gpt-4o"
        assert e.prompt_tokens == 100

    def test_minimal_event(self):
        e = EventPayload(provider="anthropic", model="claude-3-5-sonnet-20241022")
        assert e.prompt_tokens is None
        assert e.tags == []
        assert e.extra == {}

    def test_strips_whitespace(self):
        e = EventPayload(provider="  openai  ", model="  gpt-4o  ")
        assert e.provider == "openai"
        assert e.model == "gpt-4o"

    def test_batch_max_100(self):
        from pydantic import ValidationError
        events = [_make_event() for _ in range(101)]
        with pytest.raises(ValidationError):
            IngestRequest(events=events)

    def test_batch_min_1(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            IngestRequest(events=[])


# ── Auth service ──────────────────────────────────────────────────────────────

class TestAuth:

    def test_generate_key_format(self):
        from app.services.auth import generate_api_key
        raw, hashed, prefix = generate_api_key()
        assert raw.startswith("tk_live_")
        assert len(raw) == 8 + 32   # "tk_live_" + 32 hex chars
        assert prefix == raw[:12]
        assert hashed != raw

    def test_verify_correct_key(self):
        from app.services.auth import generate_api_key, verify_api_key
        raw, hashed, _ = generate_api_key()
        assert verify_api_key(raw, hashed) is True

    def test_verify_wrong_key(self):
        from app.services.auth import generate_api_key, verify_api_key
        raw, hashed, _ = generate_api_key()
        assert verify_api_key("tk_live_wrongkey123456789012345678", hashed) is False

    def test_keys_are_unique(self):
        from app.services.auth import generate_api_key
        keys = {generate_api_key()[0] for _ in range(20)}
        assert len(keys) == 20


# ── Pricing service ───────────────────────────────────────────────────────────

class TestPricing:

    def test_compute_cost_known_model(self):
        """Cost calculation with mocked pricing rows."""
        from decimal import Decimal
        from app.services.pricing import compute_cost
        from app.models.orm import ModelPricing

        mock_pricing = MagicMock(spec=ModelPricing)
        mock_pricing.input_cost_per_1k = Decimal("0.002500")
        mock_pricing.output_cost_per_1k = Decimal("0.010000")

        event = EventPayload(
            provider="openai", model="gpt-4o",
            prompt_tokens=1000, completion_tokens=500,
        )

        # Expected: (1000/1000 * 0.0025) + (500/1000 * 0.01) = 0.0025 + 0.005 = 0.0075
        async def mock_get_rates(session, provider, model, at):
            return (Decimal("0.002500"), Decimal("0.010000"))

        import asyncio
        from unittest.mock import patch as p
        with p("app.services.pricing._get_rates", side_effect=mock_get_rates):
            cost = asyncio.run(compute_cost(MagicMock(), event, datetime.now(timezone.utc)))

        assert cost == Decimal("0.00750000")

    def test_compute_cost_no_tokens(self):
        from app.services.pricing import compute_cost
        import asyncio

        event = EventPayload(provider="openai", model="gpt-4o")
        cost = asyncio.run(compute_cost(MagicMock(), event, datetime.now(timezone.utc)))
        assert cost is None


# ── Ingest endpoint ───────────────────────────────────────────────────────────

class TestHealth:

    def test_health_ok(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json() == {"status": "ok"}


# ── UsageSummary schema ───────────────────────────────────────────────────────

class TestSchemas:

    def test_usage_summary(self):
        from app.models.schemas import UsageSummary
        s = UsageSummary(
            total_events=1000,
            total_tokens=500_000,
            total_cost_usd=12.34,
            avg_latency_ms=320.5,
            period_start=datetime(2026, 3, 1, tzinfo=timezone.utc),
            period_end=datetime(2026, 3, 22, tzinfo=timezone.utc),
        )
        assert s.total_events == 1000
        assert s.total_cost_usd == 12.34


# ── Fix: patch authenticate at the module level the router imports from ───────
# The two failing tests need authenticate patched where it's actually called
# (app.routers.ingest), not where it's defined (app.services.auth).

from unittest.mock import patch as upatch

class TestIngestEndpointFixed:

    def test_valid_batch_accepted_v2(self):
        from app.db.session import get_db
        api_key = _make_api_key_mock()

        async def mock_authenticate(db, header):
            return api_key

        async def mock_cost(session, event, at):
            return None

        async def override_db():
            db = AsyncMock()
            db.add = MagicMock()
            yield db

        app.dependency_overrides[get_db] = override_db

        with (
            upatch("app.routers.ingest.authenticate", side_effect=mock_authenticate),
            upatch("app.routers.ingest.compute_cost", side_effect=mock_cost),
        ):
            client = TestClient(app)
            resp = client.post(
                "/v1/events",
                json={"events": [_make_event(), _make_event(model="gpt-4o-mini")]},
                headers={"Authorization": "Bearer tk_live_testkey1234567890123456"},
            )

        app.dependency_overrides = {}
        assert resp.status_code == 202
        assert resp.json()["accepted"] == 2
        assert resp.json()["rejected"] == 0

    def test_no_project_returns_400_v2(self):
        from app.db.session import get_db
        api_key = _make_api_key_mock()
        api_key.project_id = None

        async def mock_authenticate(db, header):
            return api_key

        async def override_db():
            db = AsyncMock()
            yield db

        app.dependency_overrides[get_db] = override_db

        with upatch("app.routers.ingest.authenticate", side_effect=mock_authenticate):
            client = TestClient(app)
            resp = client.post(
                "/v1/events",
                json={"events": [_make_event()]},
                headers={"Authorization": "Bearer tk_live_testkey1234567890123456"},
            )

        app.dependency_overrides = {}
        assert resp.status_code == 400
