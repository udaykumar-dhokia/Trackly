from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.db.session import get_db
from app.models.orm import User

client = TestClient(app)

def _mock_db(query_return=None):
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
    db.commit = AsyncMock()
    return db

def _override_db(db_mock):
    async def override():
        yield db_mock
    app.dependency_overrides[get_db] = override

def _clear():
    app.dependency_overrides = {}

class TestUserRegistration:

    def test_register_new_user(self):
        db = _mock_db(query_return=None)

        added_objs = []
        def fake_add(obj):
            added_objs.append(obj)
        db.add = MagicMock(side_effect=fake_add)

        async def fake_flush(*args, **kwargs):
            for obj in added_objs:
                if getattr(obj, "__tablename__", "") == "organizations" and getattr(obj, "id", None) is None:
                    obj.id = uuid.uuid4()
        db.flush = fake_flush

        async def fake_refresh(obj):
            if isinstance(obj, User):
                obj.id = uuid.uuid4()
                obj.created_at = datetime.now(timezone.utc)
            else:
                obj.id = uuid.uuid4()

        db.refresh = fake_refresh
        _override_db(db)

        payload = {
            "auth0_id": "auth0|12345",
            "email": "test@example.com",
            "name": "Test User"
        }

        from unittest.mock import AsyncMock, patch
        with patch("app.routers.users.ensure_welcome_email_sent", new=AsyncMock(return_value=True)) as welcome_mock, patch(
            "app.routers.users.delete_cache_key", new=AsyncMock()
        ) as delete_cache_mock:
            resp = client.post("/v1/users/register", json=payload)
        _clear()
        
        assert resp.status_code == 201
        data = resp.json()
        assert data["auth0_id"] == "auth0|12345"
        assert data["email"] == "test@example.com"
        assert "id" in data
        assert "org_id" in data
        assert welcome_mock.await_count == 1
        delete_cache_mock.assert_awaited_once()

    def test_register_existing_user(self):
        user = MagicMock(spec=User)
        user.id = uuid.uuid4()
        user.auth0_id = "auth0|duplicate"
        user.email = "dup@example.com"
        user.name = "Dup User"
        user.profile_photo = None
        user.org_id = uuid.uuid4()
        user.created_at = datetime.now(timezone.utc)

        db = _mock_db(query_return=user)
        _override_db(db)

        payload = {
            "auth0_id": "auth0|duplicate",
            "email": "dup@example.com",
            "name": "Dup User"
        }

        from unittest.mock import AsyncMock, patch
        first_org_result = MagicMock()
        first_org_result.scalar_one_or_none.return_value = user.org_id
        db.execute = AsyncMock(side_effect=[MagicMock(scalar_one_or_none=MagicMock(return_value=user)), first_org_result])
        with patch("app.routers.users.ensure_welcome_email_sent", new=AsyncMock(return_value=False)) as welcome_mock:
            resp = client.post("/v1/users/register", json=payload)
        _clear()
        
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == str(user.id)
        assert data["org_id"] == str(user.org_id)
        assert welcome_mock.await_count == 1

    def test_get_user_me_invalidates_landing_cache_when_profile_photo_changes(self):
        user = MagicMock(spec=User)
        user.id = uuid.uuid4()
        user.auth0_id = "auth0|profile"
        user.email = "profile@example.com"
        user.name = "Profile User"
        user.profile_photo = "https://old.example.com/avatar.png"
        user.created_at = datetime.now(timezone.utc)

        db = _mock_db(query_return=user)
        _override_db(db)

        with patch("app.routers.users.delete_cache_key", new=AsyncMock()) as delete_cache_mock:
            resp = client.get(
                "/v1/users/me",
                params={
                    "auth0_id": "auth0|profile",
                    "profile_photo": "https://new.example.com/avatar.png",
                },
            )

        _clear()

        assert resp.status_code == 200
        assert db.commit.await_count == 1
        delete_cache_mock.assert_awaited_once()
