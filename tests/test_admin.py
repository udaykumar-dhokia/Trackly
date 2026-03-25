from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

from app.config import settings
from app.db.session import get_db
from app.main import app


client = TestClient(app)


def _override_db(db_mock):
    async def override():
        yield db_mock

    app.dependency_overrides[get_db] = override


def _clear():
    app.dependency_overrides = {}


class TestAdminRouter:
    def test_admin_requires_configured_token(self):
        original = settings.admin_api_token
        settings.admin_api_token = None

        response = client.get(
            "/api/v1/admin/overview",
            headers={"Authorization": "Bearer anything"},
        )

        settings.admin_api_token = original
        assert response.status_code == 503
        assert "ADMIN_API_TOKEN" in response.json()["detail"]

    def test_admin_overview_returns_platform_summary(self):
        original = settings.admin_api_token
        settings.admin_api_token = "secret-token"

        totals_result = MagicMock()
        totals_result.one.return_value = (5, 2, 3, 4)

        usage_result = MagicMock()
        usage_result.one.return_value = (100, 1000, 1.23, 220)

        daily_result = MagicMock()
        daily_result.all.return_value = []

        providers_result = MagicMock()
        providers_result.all.return_value = []

        recent_users_result = MagicMock()
        recent_users_result.scalars.return_value.all.return_value = []

        recent_orgs_result = MagicMock()
        recent_orgs_result.scalars.return_value.all.return_value = []

        recent_projects_result = MagicMock()
        recent_projects_result.all.return_value = []

        recent_events_result = MagicMock()
        recent_events_result.all.return_value = []

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                totals_result,
                usage_result,
                daily_result,
                providers_result,
                recent_users_result,
                recent_orgs_result,
                recent_projects_result,
                recent_events_result,
            ]
        )
        _override_db(db)

        response = client.get(
            "/api/v1/admin/overview",
            headers={"Authorization": "Bearer secret-token"},
        )

        _clear()
        settings.admin_api_token = original

        assert response.status_code == 200
        payload = response.json()
        assert payload["total_users"] == 5
        assert payload["total_organizations"] == 2
        assert payload["total_projects"] == 3
        assert payload["total_api_keys"] == 4
        assert payload["total_events"] == 100
        assert payload["total_cost_usd"] == 1.23
