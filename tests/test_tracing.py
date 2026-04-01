from __future__ import annotations

import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import app
from trackly import Trackly, get_active_trace


class _FakeWorker:
    def __init__(self):
        self.events: list[dict] = []
        self.debug = False

    def _enqueue(self, event: dict) -> None:
        self.events.append(event)

    def shutdown(self, timeout: float = 5.0) -> None:
        return None


def test_bound_observe_creates_trace_and_nested_spans():
    worker = _FakeWorker()

    with patch("trackly.client._TracklyWorker", return_value=worker):
        tracker = Trackly(api_key="test-key")

        @tracker.observe(name="pipeline")
        def pipeline() -> str:
            with tracker.span("retrieve"):
                active = get_active_trace()
                assert active is not None
                active.record_generation(
                    provider="openai",
                    model="gpt-4o-mini",
                    prompt_tokens=10,
                    completion_tokens=5,
                    total_tokens=15,
                    latency_ms=42,
                )
            return "done"

        assert pipeline() == "done"

    event_types = [event.get("event_type") for event in worker.events]
    assert event_types[0] == "trace_start"
    assert event_types[-1] == "trace_end"
    span_events = [event for event in worker.events if event.get("event_type") == "span"]
    assert len(span_events) == 3

    pipeline_span = next(event for event in span_events if event["name"] == "pipeline" and event["type"] == "span")
    retrieve_span = next(event for event in span_events if event["name"] == "retrieve")
    generation_span = next(event for event in span_events if event["type"] == "generation")
    assert retrieve_span["parent_span_id"] == pipeline_span["span_id"]
    assert generation_span["parent_span_id"] == retrieve_span["span_id"]
    assert generation_span["provider"] == "openai"
    assert generation_span["model"] == "gpt-4o-mini"


def test_trace_graph_endpoint_reads_trace_and_span_data():
    project_id = uuid.uuid4()
    trace = SimpleNamespace(
        trace_id="trace_123",
        name="support-bot",
        session_id="session_1",
        user_id="user_1",
        status="completed",
        metadata_json={"team": "support"},
        tags=["prod"],
        total_cost_usd=0.0123,
        total_tokens=120,
        total_latency_ms=340,
        step_count=2,
        pipeline_fingerprint="abc123",
        health_score=98.5,
        started_at=datetime.now(timezone.utc),
        ended_at=datetime.now(timezone.utc),
    )
    spans = [
        SimpleNamespace(
            trace_id="trace_123",
            span_id="span_root",
            parent_span_id=None,
            name="retrieve",
            type="span",
            provider=None,
            model=None,
            prompt_tokens=None,
            completion_tokens=None,
            total_tokens=None,
            estimated_cost_usd=None,
            latency_ms=40,
            finish_reason=None,
            status="ok",
            level=0,
            started_at=datetime.now(timezone.utc),
        ),
        SimpleNamespace(
            trace_id="trace_123",
            span_id="span_llm",
            parent_span_id="span_root",
            name="openai/gpt-4o-mini",
            type="generation",
            provider="openai",
            model="gpt-4o-mini",
            prompt_tokens=80,
            completion_tokens=40,
            total_tokens=120,
            estimated_cost_usd=0.0123,
            latency_ms=300,
            finish_reason="stop",
            status="ok",
            level=1,
            started_at=datetime.now(timezone.utc),
        ),
    ]

    db = AsyncMock()
    trace_result = MagicMock()
    trace_result.scalar_one_or_none.return_value = trace
    spans_result = MagicMock()
    spans_result.scalars.return_value.all.return_value = spans
    db.execute = AsyncMock(side_effect=[trace_result, spans_result])
    db.flush = AsyncMock()

    async def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db

    with patch("app.routers.traces.require_project_access_by_auth0_id", new=AsyncMock()):
        client = TestClient(app)
        response = client.get(
            f"/v1/projects/{project_id}/traces/graph?auth0_id=auth0|user&session_id=trace_123"
        )

    app.dependency_overrides = {}

    assert response.status_code == 200
    payload = response.json()
    assert payload["trace_id"] == "trace_123"
    assert payload["name"] == "support-bot"
    assert payload["status"] == "completed"
    assert len(payload["nodes"]) == 2
    assert payload["edges"] == [{"source": "span_root", "target": "span_llm"}]
    assert payload["nodes"][0]["provider"] == "application"
    assert payload["nodes"][1]["provider"] == "openai"


def test_ingest_endpoint_accepts_trace_lifecycle_events():
    api_key = MagicMock()
    api_key.id = uuid.uuid4()
    api_key.project_id = uuid.uuid4()
    api_key.parent_key_id = None
    api_key.created_by_user_id = None

    result_none = MagicMock()
    result_none.scalar_one_or_none.return_value = None

    db = AsyncMock()
    db.execute = AsyncMock(return_value=result_none)
    db.add = MagicMock()
    db.flush = AsyncMock()

    async def override_db():
        yield db

    app.dependency_overrides[get_db] = override_db

    with (
        patch("app.routers.ingest.authenticate", new=AsyncMock(return_value=api_key)),
        patch("app.routers.ingest.maybe_send_project_budget_alert", new=AsyncMock()),
    ):
        client = TestClient(app)
        response = client.post(
            "/v1/events",
            json={
                "events": [
                    {
                        "event_type": "trace_start",
                        "trace_id": "trace_abc",
                        "name": "langchain-flow",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    {
                        "event_type": "span",
                        "trace_id": "trace_abc",
                        "span_id": "span_root",
                        "name": "retrieve",
                        "type": "span",
                        "level": 0,
                        "status": "ok",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                    {
                        "event_type": "trace_end",
                        "trace_id": "trace_abc",
                        "status": "completed",
                        "total_tokens": 42,
                        "total_latency_ms": 120,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                ]
            },
            headers={"Authorization": "Bearer tk_live_testkey1234567890123456"},
        )

    app.dependency_overrides = {}

    assert response.status_code == 202
    assert response.json() == {"accepted": 3, "rejected": 0}
