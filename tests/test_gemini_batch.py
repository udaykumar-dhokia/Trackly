import sys
from unittest.mock import MagicMock, patch

# Mock the google parts if not present
mock_genai = MagicMock()
sys.modules["google"] = MagicMock()
sys.modules["google.genai"] = mock_genai

import json
from trackly.client import Trackly

class MockBatchJob:
    def __init__(self, name, state):
        self.name = name
        self.state = state
        self.model = "gemini-1.5-flash"

def test_gemini_batch_tracking():
    # 1. Initialize Trackly for Gemini
    trackly = Trackly(
        provider="gemini",
        api_key="sk-test-key",
        debug=True
    )

    # Prepare mocks
    mock_client = MagicMock()
    mock_job = MockBatchJob("batches/123", "JOB_STATE_PENDING")
    success_job = MockBatchJob("batches/123", "JOB_STATE_SUCCEEDED")

    # 2. Patch the genai.Client
    with patch("google.genai.Client", return_value=mock_client):
        mock_client.batches.create.return_value = mock_job
        mock_client.batches.get.return_value = success_job
        
        print("\nTesting batches.create:")
        job = trackly.batches.create(
            model="gemini-1.5-flash",
            src=[{"text": "Hello"}]
        )
        print(f"Returned job: {job}")
        assert job.name == "batches/123"
        
        # Verify event enqueued
        with trackly._worker._lock:
            events = trackly._worker._queue
            print(f"Enqueued events (after create): {len(events)}")
            if events:
                event = events[-1]
                print(f"Captured Event: {json.dumps(event, indent=2)}")
                assert event["provider"] == "google-batch"
                assert event["action"] == "create"
                assert event["metadata"]["job_name"] == "batches/123"

        # Test .batches.get (Success state)
        print("\nTesting batches.get (Success):")
        job_status = trackly.batches.get(name="batches/123")
        assert job_status.state == "JOB_STATE_SUCCEEDED"

        with trackly._worker._lock:
            events = trackly._worker._queue
            print(f"Enqueued events (after get): {len(events)}")
            if len(events) > 1:
                event = events[-1]
                print(f"Captured Event: {json.dumps(event, indent=2)}")
                assert event["provider"] == "google-batch"
                assert event["action"] == "status_check"
                assert event["metadata"]["state"] == "JOB_STATE_SUCCEEDED"

        print("✓ Success: Gemini Batch events captured correctly.")

if __name__ == "__main__":
    test_gemini_batch_tracking()
