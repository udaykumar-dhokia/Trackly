from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app
from app.services.playground import PlaygroundUsageBasis


client = TestClient(app)


def _override_db():
    async def override():
        yield AsyncMock()

    app.dependency_overrides[get_db] = override


def _clear_overrides():
    app.dependency_overrides = {}


class TestPlaygroundEndpoints:
    def test_get_playground_options(self):
        project_id = uuid.uuid4()
        _override_db()

        pricing_row = SimpleNamespace(
            provider="openai",
            model="gpt-4o",
            input_cost_per_1k=Decimal("0.002500"),
            output_cost_per_1k=Decimal("0.010000"),
            effective_from=datetime.now(timezone.utc),
        )
        recent_model = {
            "provider": "openai",
            "model": "gpt-4o",
            "event_count": 18,
            "prompt_tokens": 12000,
            "completion_tokens": 4000,
            "total_tokens": 16000,
            "total_cost_usd": 0.37,
            "avg_latency_ms": 420.0,
            "last_seen_at": datetime.now(timezone.utc),
            "matched_pricing_model": "gpt-4o",
            "input_cost_per_1k": 0.0025,
            "output_cost_per_1k": 0.01,
        }

        with (
            patch("app.routers.playground.require_project_access_by_auth0_id", new=AsyncMock()),
            patch("app.routers.playground.list_active_model_pricing", new=AsyncMock(return_value=[pricing_row])),
            patch("app.routers.playground.get_project_recent_models", new=AsyncMock(return_value=[recent_model])),
        ):
            response = client.get(
                f"/v1/projects/{project_id}/playground/options?auth0_id=auth0|user"
            )

        _clear_overrides()

        assert response.status_code == 200
        payload = response.json()
        assert len(payload["catalog"]) == 1
        assert payload["catalog"][0]["model"] == "gpt-4o"
        assert len(payload["recent_models"]) == 1
        assert payload["recent_models"][0]["event_count"] == 18

    def test_compare_playground_models_historical(self):
        project_id = uuid.uuid4()
        _override_db()

        source_pricing = SimpleNamespace(
            provider="openai",
            model="gpt-4o",
            input_cost_per_1k=Decimal("0.002500"),
            output_cost_per_1k=Decimal("0.010000"),
        )
        target_pricing = SimpleNamespace(
            provider="openai",
            model="gpt-4o-mini",
            input_cost_per_1k=Decimal("0.000150"),
            output_cost_per_1k=Decimal("0.000600"),
        )
        historical_basis = PlaygroundUsageBasis(
            event_count=100,
            prompt_tokens=100_000,
            completion_tokens=25_000,
            total_tokens=125_000,
            total_cost_usd=Decimal("0.50000000"),
            avg_latency_ms=310.0,
            last_seen_at=datetime.now(timezone.utc),
        )

        with (
            patch("app.routers.playground.require_project_access_by_auth0_id", new=AsyncMock()),
            patch(
                "app.routers.playground.find_active_pricing",
                new=AsyncMock(side_effect=[source_pricing, target_pricing]),
            ),
            patch(
                "app.routers.playground.get_historical_usage_basis",
                new=AsyncMock(return_value=historical_basis),
            ),
        ):
            response = client.post(
                f"/v1/projects/{project_id}/playground/compare?auth0_id=auth0|user",
                json={
                    "source_provider": "openai",
                    "source_model": "gpt-4o",
                    "target_provider": "openai",
                    "target_model": "gpt-4o-mini",
                    "mode": "historical",
                    "traffic_multiplier": 2,
                },
            )

        _clear_overrides()

        assert response.status_code == 200
        payload = response.json()
        assert payload["source"]["request_count"] == 200
        assert payload["source"]["total_cost_usd"] == 1.0
        assert payload["target"]["total_cost_usd"] == 0.06
        assert payload["delta"]["savings_usd"] == 0.94

    def test_compare_playground_model_against_all(self):
        project_id = uuid.uuid4()
        _override_db()

        source_pricing = SimpleNamespace(
            provider="openai",
            model="gpt-4o",
            input_cost_per_1k=Decimal("0.002500"),
            output_cost_per_1k=Decimal("0.010000"),
        )
        catalog_rows = [
            source_pricing,
            SimpleNamespace(
                provider="openai",
                model="gpt-4o-mini",
                input_cost_per_1k=Decimal("0.000150"),
                output_cost_per_1k=Decimal("0.000600"),
            ),
            SimpleNamespace(
                provider="anthropic",
                model="claude-3-5-sonnet",
                input_cost_per_1k=Decimal("0.003000"),
                output_cost_per_1k=Decimal("0.015000"),
            ),
        ]
        historical_basis = PlaygroundUsageBasis(
            event_count=100,
            prompt_tokens=100_000,
            completion_tokens=25_000,
            total_tokens=125_000,
            total_cost_usd=Decimal("0.50000000"),
            avg_latency_ms=310.0,
            last_seen_at=datetime.now(timezone.utc),
        )

        with (
            patch("app.routers.playground.require_project_access_by_auth0_id", new=AsyncMock()),
            patch(
                "app.routers.playground.find_active_pricing",
                new=AsyncMock(return_value=source_pricing),
            ),
            patch(
                "app.routers.playground.list_active_model_pricing",
                new=AsyncMock(return_value=catalog_rows),
            ),
            patch(
                "app.routers.playground.get_historical_usage_basis",
                new=AsyncMock(return_value=historical_basis),
            ),
        ):
            response = client.post(
                f"/v1/projects/{project_id}/playground/compare-all?auth0_id=auth0|user",
                json={
                    "source_provider": "openai",
                    "source_model": "gpt-4o",
                    "mode": "historical",
                    "traffic_multiplier": 2,
                },
            )

        _clear_overrides()

        assert response.status_code == 200
        payload = response.json()
        assert payload["source"]["request_count"] == 200
        assert len(payload["comparisons"]) == 3
        assert payload["comparisons"][0]["model"] == "gpt-4o-mini"
        assert payload["comparisons"][0]["projected_total_cost_usd"] == 0.06
        assert payload["comparisons"][0]["savings_usd"] == 0.94
        assert payload["comparisons"][1]["is_source_model"] is True
