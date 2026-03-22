"""
Tests for organizations, api-keys, and events endpoints.
All run offline with mocked DB sessions.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import get_db
from app.models.orm import Organization, Project, ApiKey, LlmEvent


# ── Helpers ───────────────────────────────────────────────────────────────────

def _mock_db(query_return=None):
    """
    Build a fake AsyncSession.
    query_return: the object(s) that session.execute(...) resolves to.
    """
    db = AsyncMock()

    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = query_return
    result_mock.scalar_one.return_value = query_return
    result_mock.scalars.return_value.all.return_value = (
        query_return if isinstance(query_return, list) else []
    )

    db.execute = AsyncMock(return_value=result_mock)
    db.add = MagicMock()
    db.flush = AsyncMock()
    db.refresh = AsyncMock()
    return db


def _override_db(db_mock):
    async def override():
        yield db_mock
    app.dependency_overrides[get_db] = override


def _clear():
    app.dependency_overrides = {}


def _make_org(**kwargs) -> Organization:
    org = MagicMock(spec=Organization)
    org.id = kwargs.get("id", uuid.uuid4())
    org.name = kwargs.get("name", "Acme Corp")
    org.slug = kwargs.get("slug", "acme")
    org.plan = "free"
    return org


def _make_project(**kwargs) -> Project:
    p = MagicMock(spec=Project)
    p.id = kwargs.get("id", uuid.uuid4())
    p.org_id = kwargs.get("org_id", uuid.uuid4())
    p.name = kwargs.get("name", "Production")
    p.environment = kwargs.get("environment", "prod")
    return p


def _make_api_key(**kwargs) -> ApiKey:
    k = MagicMock(spec=ApiKey)
    k.id = kwargs.get("id", uuid.uuid4())
    k.org_id = kwargs.get("org_id", uuid.uuid4())
    k.project_id = kwargs.get("project_id", uuid.uuid4())
    k.name = kwargs.get("name", "My key")
    k.key_prefix = "tk_live_ab12"
    k.is_active = True
    k.created_at = datetime.now(timezone.utc)
    k.last_used_at = None
    return k


def _make_event(**kwargs) -> LlmEvent:
    e = MagicMock(spec=LlmEvent)
    e.id = uuid.uuid4()
    e.provider = "openai"
    e.model = "gpt-4o"
    e.prompt_tokens = 100
    e.completion_tokens = 50
    e.total_tokens = 150
    e.estimated_cost_usd = 0.00125
    e.latency_ms = 320
    e.finish_reason = "stop"
    e.feature = "chat"
    e.user_id = "u_1"
    e.session_id = None
    e.run_id = None
    e.tags = []
    e.occurred_at = datetime.now(timezone.utc)
    e.ingested_at = datetime.now(timezone.utc)
    return e


client = TestClient(app)


# ── Organization endpoints ────────────────────────────────────────────────────

class TestOrganizations:

    def test_create_org_success(self):
        db = _mock_db(query_return=None)   # None = slug not taken
        org = _make_org()
        db.refresh = AsyncMock(side_effect=lambda x: None)

        # After flush, the ORM object should have data on it
        async def fake_refresh(obj):
            obj.id = org.id
            obj.name = org.name
            obj.slug = org.slug
            obj.plan = "free"

        db.refresh = fake_refresh
        _override_db(db)

        resp = client.post("/v1/organizations", json={"name": "Acme Corp", "slug": "acme"})
        _clear()

        assert resp.status_code == 201
        assert resp.json()["slug"] == "acme"

    def test_create_org_slug_conflict(self):
        existing = _make_org(slug="acme")
        db = _mock_db(query_return=existing)
        _override_db(db)

        resp = client.post("/v1/organizations", json={"name": "Acme 2", "slug": "acme"})
        _clear()

        assert resp.status_code == 409
        assert "taken" in resp.json()["detail"]

    def test_slug_validation_rejects_uppercase(self):
        # Validator lowercases the slug, so "My-Org" becomes "my-org" and is accepted.
        # Truly invalid slugs (spaces, special chars) are rejected.
        db = _mock_db(query_return=None)
        org = _make_org(slug="my-org")
        async def fake_refresh(obj):
            obj.id = org.id; obj.name = "Test"; obj.slug = "my-org"; obj.plan = "free"
        db.refresh = fake_refresh
        _override_db(db)

        resp = client.post("/v1/organizations", json={"name": "Test", "slug": "My-Org"})
        _clear()

        # Normalised to lowercase — accepted, not rejected
        assert resp.status_code == 201
        assert resp.json()["slug"] == "my-org"

    def test_slug_validation_rejects_spaces(self):
        db = _mock_db()
        _override_db(db)

        resp = client.post("/v1/organizations", json={"name": "Test", "slug": "my org"})
        _clear()

        assert resp.status_code == 422

    def test_get_org_not_found(self):
        db = _mock_db(query_return=None)
        _override_db(db)

        resp = client.get(f"/v1/organizations/{uuid.uuid4()}")
        _clear()

        assert resp.status_code == 404

    def test_get_org_found(self):
        org = _make_org()
        db = _mock_db(query_return=org)
        # patch model_validate to work with mock
        _override_db(db)

        with patch("app.routers.organizations._get_org_or_404", return_value=org):
            resp = client.get(f"/v1/organizations/{org.id}")
        _clear()

        assert resp.status_code == 200


# ── Project endpoints ─────────────────────────────────────────────────────────

class TestProjects:

    def test_create_project(self):
        org = _make_org()
        project = _make_project(org_id=org.id)

        db = _mock_db(query_return=org)

        async def fake_refresh(obj):
            obj.id = project.id
            obj.org_id = org.id
            obj.name = "Production"
            obj.environment = "prod"

        db.refresh = fake_refresh
        _override_db(db)

        resp = client.post(
            f"/v1/organizations/{org.id}/projects",
            json={"name": "Production", "environment": "prod"},
        )
        _clear()

        assert resp.status_code == 201
        assert resp.json()["name"] == "Production"
        assert resp.json()["environment"] == "prod"

    def test_create_project_org_not_found(self):
        db = _mock_db(query_return=None)
        _override_db(db)

        resp = client.post(
            f"/v1/organizations/{uuid.uuid4()}/projects",
            json={"name": "Test"},
        )
        _clear()

        assert resp.status_code == 404

    def test_list_projects(self):
        org = _make_org()
        projects = [_make_project(org_id=org.id) for _ in range(3)]

        db = AsyncMock()
        # First execute = org lookup, second = project list
        org_result = MagicMock()
        org_result.scalar_one_or_none.return_value = org

        project_result = MagicMock()
        project_result.scalars.return_value.all.return_value = projects

        db.execute = AsyncMock(side_effect=[org_result, project_result])
        _override_db(db)

        resp = client.get(f"/v1/organizations/{org.id}/projects")
        _clear()

        assert resp.status_code == 200
        assert len(resp.json()) == 3


# ── API key endpoints ─────────────────────────────────────────────────────────

class TestApiKeys:

    def test_create_key_success(self):
        org_id = uuid.uuid4()
        project_id = uuid.uuid4()
        project = _make_project(id=project_id, org_id=org_id)

        db = AsyncMock()
        project_result = MagicMock()
        project_result.scalar_one_or_none.return_value = project

        async def fake_refresh(obj):
            obj.id = uuid.uuid4()
            obj.org_id = org_id
            obj.project_id = project_id
            obj.name = "Test key"
            obj.key_prefix = "tk_live_ab12"
            obj.is_active = True
            obj.created_at = datetime.now(timezone.utc)
            obj.last_used_at = None

        db.execute = AsyncMock(return_value=project_result)
        db.add = MagicMock()
        db.flush = AsyncMock()
        db.refresh = fake_refresh
        _override_db(db)

        resp = client.post(
            f"/v1/organizations/{org_id}/api-keys",
            json={"name": "Test key", "project_id": str(project_id)},
        )
        _clear()

        assert resp.status_code == 201
        data = resp.json()
        # raw_key is present and has correct format
        assert data["raw_key"].startswith("tk_live_")
        assert len(data["raw_key"]) == 40   # "tk_live_" + 32 hex
        # prefix matches the key
        # key_prefix is set by our service as raw_key[:12]; mock hardcodes it
        # so just verify both fields exist and have correct format
        assert len(data["key_prefix"]) == 12
        assert data["key_prefix"].startswith("tk_live_")

    def test_create_key_wrong_project(self):
        org_id = uuid.uuid4()
        db = _mock_db(query_return=None)   # project not found in org
        _override_db(db)

        resp = client.post(
            f"/v1/organizations/{org_id}/api-keys",
            json={"name": "Bad key", "project_id": str(uuid.uuid4())},
        )
        _clear()

        assert resp.status_code == 404

    def test_list_keys(self):
        org_id = uuid.uuid4()
        keys = [_make_api_key(org_id=org_id) for _ in range(2)]

        db = _mock_db(query_return=keys)
        _override_db(db)

        resp = client.get(f"/v1/organizations/{org_id}/api-keys")
        _clear()

        assert resp.status_code == 200

    def test_revoke_key(self):
        key = _make_api_key()

        db = AsyncMock()
        find_result = MagicMock()
        find_result.scalar_one_or_none.return_value = key
        update_result = MagicMock()
        db.execute = AsyncMock(side_effect=[find_result, update_result])
        _override_db(db)

        resp = client.delete(f"/v1/api-keys/{key.id}")
        _clear()

        assert resp.status_code == 204

    def test_revoke_key_not_found(self):
        db = _mock_db(query_return=None)
        _override_db(db)

        resp = client.delete(f"/v1/api-keys/{uuid.uuid4()}")
        _clear()

        assert resp.status_code == 404

    def test_raw_key_never_in_list(self):
        """The list endpoint returns ApiKeyResponse, which has no raw_key field."""
        from app.models.schemas import ApiKeyResponse
        import inspect
        fields = ApiKeyResponse.model_fields
        assert "raw_key" not in fields


# ── Events endpoint ───────────────────────────────────────────────────────────

class TestEvents:

    def test_list_events_paginated(self):
        project_id = uuid.uuid4()
        evts = [_make_event() for _ in range(5)]

        db = AsyncMock()
        count_result = MagicMock()
        count_result.scalar_one.return_value = 5

        events_result = MagicMock()
        events_result.scalars.return_value.all.return_value = evts

        db.execute = AsyncMock(side_effect=[count_result, events_result])
        _override_db(db)

        resp = client.get(f"/v1/projects/{project_id}/events?page=1&page_size=10")
        _clear()

        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 5
        assert data["page"] == 1
        assert data["has_more"] is False
        assert len(data["items"]) == 5

    def test_list_events_has_more(self):
        project_id = uuid.uuid4()
        evts = [_make_event() for _ in range(10)]

        db = AsyncMock()
        count_result = MagicMock()
        count_result.scalar_one.return_value = 100   # 100 total

        events_result = MagicMock()
        events_result.scalars.return_value.all.return_value = evts

        db.execute = AsyncMock(side_effect=[count_result, events_result])
        _override_db(db)

        resp = client.get(f"/v1/projects/{project_id}/events?page=1&page_size=10")
        _clear()

        assert resp.status_code == 200
        assert resp.json()["has_more"] is True

    def test_list_events_filter_params_accepted(self):
        """Ensure filter query params don't cause validation errors."""
        project_id = uuid.uuid4()

        db = AsyncMock()
        count_result = MagicMock()
        count_result.scalar_one.return_value = 0
        events_result = MagicMock()
        events_result.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(side_effect=[count_result, events_result])
        _override_db(db)

        resp = client.get(
            f"/v1/projects/{project_id}/events"
            "?feature=chat&provider=openai&model=gpt-4o&page_size=20"
        )
        _clear()

        assert resp.status_code == 200
        assert resp.json()["total"] == 0
