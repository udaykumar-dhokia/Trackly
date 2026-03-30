from __future__ import annotations

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


class TestLandingCache:
    def test_global_stats_uses_cached_users(self):
        db = AsyncMock()
        events_result = MagicMock()
        events_result.one.return_value = SimpleNamespace(total_events=12, total_tokens=345)
        db.execute = AsyncMock(return_value=events_result)
        db.scalar = AsyncMock()
        _override_db(db)

        cached_payload = {
            "total_users": 99,
            "featured_users": [
                {"name": "Taylor", "email": "taylor@example.com", "profile_photo": None}
            ],
        }

        with patch("app.routers.stats.get_cache_json", new=AsyncMock(return_value=cached_payload)), patch(
            "app.routers.stats.set_cache_json", new=AsyncMock()
        ) as set_cache_mock:
            response = client.get("/api/v1/stats/global")

        _clear()

        assert response.status_code == 200
        payload = response.json()
        assert payload["total_events"] == 12
        assert payload["total_tokens"] == 345
        assert payload["total_users"] == 99
        assert payload["featured_users"][0]["email"] == "taylor@example.com"
        assert db.scalar.await_count == 0
        assert db.execute.await_count == 1
        set_cache_mock.assert_not_awaited()

    def test_global_stats_populates_users_cache_on_miss(self):
        db = AsyncMock()

        events_result = MagicMock()
        events_result.one.return_value = SimpleNamespace(total_events=7, total_tokens=89)

        users_result = MagicMock()
        users_result.all.return_value = [
            SimpleNamespace(name="Alex", email="alex@example.com", profile_photo="https://img.test/alex.png")
        ]

        db.execute = AsyncMock(side_effect=[events_result, users_result])
        db.scalar = AsyncMock(return_value=10)
        _override_db(db)

        with patch("app.routers.stats.get_cache_json", new=AsyncMock(return_value=None)), patch(
            "app.routers.stats.set_cache_json", new=AsyncMock()
        ) as set_cache_mock:
            response = client.get("/api/v1/stats/global")

        _clear()

        assert response.status_code == 200
        payload = response.json()
        assert payload["total_users"] == 10
        assert payload["featured_users"][0]["name"] == "Alex"
        set_cache_mock.assert_awaited_once()

    def test_verified_feedback_uses_cache(self):
        db = AsyncMock()
        _override_db(db)

        cached_feedback = [
            {
                "id": "c6614c84-dfe8-4127-b0fb-3c7a14a09bbf",
                "user_id": "6e6e37af-3508-4ad1-b867-2d9ea66d6347",
                "user_name": "Jordan",
                "user_photo": None,
                "content": "Helpful product.",
                "is_verified": True,
                "created_at": "2026-03-30T10:00:00Z",
            }
        ]

        with patch("app.routers.feedback.get_cache_json", new=AsyncMock(return_value=cached_feedback)), patch(
            "app.routers.feedback.set_cache_json", new=AsyncMock()
        ) as set_cache_mock:
            response = client.get("/api/v1/feedback")

        _clear()

        assert response.status_code == 200
        payload = response.json()
        assert payload[0]["user_name"] == "Jordan"
        assert db.execute.await_count == 0
        set_cache_mock.assert_not_awaited()

    def test_verified_feedback_populates_cache_on_miss(self):
        db = AsyncMock()
        feedback = SimpleNamespace(
            id="3a3bdb87-38e7-4d01-a605-b5e6dd8b04d7",
            user_id="193753a1-cf72-44f2-86eb-935c75920515",
            content="Excellent visibility.",
            is_verified=True,
            created_at="2026-03-30T11:00:00Z",
            user=SimpleNamespace(
                name="Priya",
                email="priya@example.com",
                profile_photo="https://img.test/priya.png",
            ),
        )
        result = MagicMock()
        result.scalars.return_value.all.return_value = [feedback]
        db.execute = AsyncMock(return_value=result)
        _override_db(db)

        with patch("app.routers.feedback.get_cache_json", new=AsyncMock(return_value=None)), patch(
            "app.routers.feedback.set_cache_json", new=AsyncMock()
        ) as set_cache_mock:
            response = client.get("/api/v1/feedback")

        _clear()

        assert response.status_code == 200
        payload = response.json()
        assert payload[0]["content"] == "Excellent visibility."
        set_cache_mock.assert_awaited_once()
