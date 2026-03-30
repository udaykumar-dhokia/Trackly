from __future__ import annotations

import uuid
from datetime import datetime, timezone
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
    result.scalars.return_value.all.return_value = value if isinstance(value, list) else []
    return result


class TestProjectVisibility:
    def test_member_only_sees_projects_they_belong_to(self):
        org_id = uuid.uuid4()
        user = SimpleNamespace(id=uuid.uuid4())
        org = SimpleNamespace(id=org_id)
        allowed_project = SimpleNamespace(
            id=uuid.uuid4(),
            org_id=org_id,
            name="Allowed",
            environment="prod",
            description=None,
            created_at=datetime.now(timezone.utc),
        )

        db = AsyncMock()
        db.execute = AsyncMock(return_value=_result(org))
        _override_db(db)

        with patch("app.routers.organizations.get_user_by_auth0_id", new=AsyncMock(return_value=user)), patch(
            "app.routers.organizations.list_accessible_projects",
            new=AsyncMock(return_value=[allowed_project]),
        ):
            response = client.get(
                f"/api/v1/organizations/{org_id}/projects",
                params={"auth0_id": "auth0|member"},
            )

        _clear()

        assert response.status_code == 200
        payload = response.json()
        assert len(payload) == 1
        assert payload[0]["name"] == "Allowed"

    def test_org_member_cannot_get_access_key_for_unassigned_project(self):
        org_id = uuid.uuid4()
        project_id = uuid.uuid4()
        user_id = uuid.uuid4()
        key_id = uuid.uuid4()

        parent_key = SimpleNamespace(
            id=key_id,
            is_active=True,
            org_id=org_id,
            project_id=project_id,
            name="Project Key",
        )
        user = SimpleNamespace(id=user_id, email="member@example.com", name="Member")

        db = AsyncMock()
        db.execute = AsyncMock(
            side_effect=[
                _result(parent_key),
                _result(None),
            ]
        )
        _override_db(db)

        with patch("app.routers.api_keys.get_user_by_auth0_id", new=AsyncMock(return_value=user)), patch(
            "app.routers.api_keys.is_org_admin_or_owner",
            new=AsyncMock(return_value=False),
        ):
            response = client.post(
                f"/api/v1/api-keys/{key_id}/access",
                json={"auth0_id": "auth0|member"},
            )

        _clear()

        assert response.status_code == 403
        assert "member of this project" in response.json()["detail"]
