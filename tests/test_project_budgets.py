from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app


client = TestClient(app)


def _override_db(db_mock):
    async def override():
        yield db_mock

    app.dependency_overrides[get_db] = override


def _clear():
    app.dependency_overrides = {}


def _result(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


class TestProjectBudgets:
    def test_project_budget_can_be_updated_by_org_owner(self):
        project_id = uuid.uuid4()
        org_id = uuid.uuid4()
        actor_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        project = SimpleNamespace(id=project_id, org_id=org_id)
        actor = SimpleNamespace(id=actor_id)
        org_membership = SimpleNamespace(role="owner")

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _result(project),
                _result(actor),
                _result(org_membership),
                _result(SimpleNamespace(id=uuid.uuid4())),
                _result(None),
            ]
        )
        db.add = MagicMock()
        db.flush = AsyncMock()

        async def fake_refresh(obj):
            obj.id = uuid.uuid4()
            obj.project_id = project_id
            obj.monthly_token_limit = 5000
            obj.monthly_cost_limit_usd = 250
            obj.created_at = now
            obj.updated_at = now

        db.refresh = fake_refresh
        _override_db(db)

        response = client.put(
            f"/api/v1/projects/{project_id}/budget?auth0_id=auth0|owner",
            json={"monthly_token_limit": 5000, "monthly_cost_limit_usd": 250},
        )

        _clear()

        assert response.status_code == 200
        payload = response.json()
        assert payload["project_id"] == str(project_id)
        assert payload["monthly_token_limit"] == 5000
        assert payload["monthly_cost_limit_usd"] == 250.0
        assert payload["configured"] is True

    def test_project_budget_rejects_org_admin_without_owner_or_project_admin_access(self):
        project_id = uuid.uuid4()
        org_id = uuid.uuid4()
        actor_id = uuid.uuid4()

        project = SimpleNamespace(id=project_id, org_id=org_id)
        actor = SimpleNamespace(id=actor_id)
        org_membership = SimpleNamespace(role="admin")

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _result(project),
                _result(actor),
                _result(org_membership),
                _result(SimpleNamespace(id=uuid.uuid4())),
                _result(None),
            ]
        )
        _override_db(db)

        response = client.put(
            f"/api/v1/projects/{project_id}/budget?auth0_id=auth0|admin",
            json={"monthly_token_limit": 5000},
        )

        _clear()

        assert response.status_code == 403
        assert "project admins or organization owners" in response.json()["detail"]

    def test_project_usage_returns_project_budget_status(self):
        project_id = uuid.uuid4()
        org_id = uuid.uuid4()
        now = datetime.now(timezone.utc)

        project = SimpleNamespace(id=project_id, org_id=org_id)
        org = SimpleNamespace(id=org_id, plan="pro")
        budget = SimpleNamespace(
            project_id=project_id,
            monthly_token_limit=1000,
            monthly_cost_limit_usd=Decimal("100"),
            created_at=now,
            updated_at=now,
        )
        usage = SimpleNamespace(
            event_count=24,
            total_tokens=910,
            total_cost_usd=Decimal("95"),
        )

        db = AsyncMock()
        db.execute = AsyncMock(side_effect=[_result(org)])
        _override_db(db)

        with patch(
            "app.routers.organizations.require_project_access_by_auth0_id",
            new=AsyncMock(return_value=(SimpleNamespace(id=uuid.uuid4()), project)),
        ), patch("app.routers.organizations.get_project_usage_snapshot", new=AsyncMock(return_value=usage)), patch(
            "app.routers.organizations.get_project_budget", new=AsyncMock(return_value=budget)
        ):
            response = client.get(
                f"/api/v1/projects/{project_id}/usage",
                params={"auth0_id": "auth0|member"},
            )

        _clear()

        assert response.status_code == 200
        payload = response.json()
        assert payload["project_id"] == str(project_id)
        assert payload["current_month_events"] == 24
        assert payload["budget"]["status"] == "warning"
        assert payload["budget"]["token_usage_percentage"] == 91.0
        assert payload["budget"]["cost_usage_percentage"] == 95.0

    def test_ingest_triggers_project_budget_alert_check(self):
        project_id = uuid.uuid4()
        api_key = SimpleNamespace(
            project_id=project_id,
            id=uuid.uuid4(),
            parent_key_id=None,
            created_by_user_id=None,
        )

        db = AsyncMock()
        db.add = MagicMock()
        db.flush = AsyncMock()
        _override_db(db)

        with patch("app.routers.ingest.authenticate", new=AsyncMock(return_value=api_key)), patch(
            "app.routers.ingest.compute_cost", new=AsyncMock(return_value=Decimal("0.5"))
        ), patch(
            "app.routers.ingest.maybe_send_project_budget_alert", new=AsyncMock()
        ) as alert_mock:
            response = client.post(
                "/api/v1/events",
                headers={"Authorization": "Bearer tk_live_test"},
                json={
                    "events": [
                        {
                            "provider": "openai",
                            "model": "gpt-4o",
                            "prompt_tokens": 10,
                            "completion_tokens": 5,
                        }
                    ]
                },
            )

        _clear()

        assert response.status_code == 202
        assert response.json() == {"accepted": 1, "rejected": 0}
        db.flush.assert_awaited_once()
        alert_mock.assert_awaited_once_with(db, project_id)
