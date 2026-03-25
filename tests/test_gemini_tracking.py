import sys
from unittest.mock import MagicMock, patch

# Mock the google parts if not present
mock_genai = MagicMock()
sys.modules["google"] = MagicMock()
sys.modules["google.genai"] = mock_genai

import json
from trackly.client import Trackly

class MockUsage:
    def __init__(self):
        self.prompt_token_count = 10
        self.candidates_token_count = 20
        self.total_token_count = 30

class MockCandidate:
    def __init__(self):
        self.finish_reason = "STOP"

class MockResponse:
    def __init__(self):
        self.usage_metadata = MockUsage()
        self.candidates = [MockCandidate()]

def test_gemini_tracking():
    # 1. Setup mock response
    mock_response = MockResponse()

    # 2. Initialize Trackly for Gemini
    trackly = Trackly(
        provider="gemini",
        api_key="sk-test-key",
        debug=True
    )

    # 3. Patch the genai.Client
    with patch("google.genai.Client") as mock_client_class:
        mock_client = mock_client_class.return_value
        mock_client.models.generate_content.return_value = mock_response

        # 4. Trigger tracking
        response = trackly.models.generate_content(
            model="gemini-1.5-flash",
            contents="Hello"
        )

        # 5. Verify
        print("\nVerification:")
        print(f"Response usage: {response.usage_metadata.total_token_count} tokens")
        
        # Check if event was enqueued (we can check the internal queue)
        with trackly._worker._lock:
            events = trackly._worker._queue
            print(f"Enqueued events: {len(events)}")
            if events:
                event = events[0]
                print(f"Captured Event: {json.dumps(event, indent=2)}")
                assert event["provider"] == "google"
                assert event["model"] == "gemini-1.5-flash"
                assert event["total_tokens"] == 30
                print("✓ Success: Gemini event captured correctly.")

if __name__ == "__main__":
    test_gemini_tracking()
