import sys
from unittest.mock import MagicMock, patch

# Mock anthropic module
mock_anthropic_mod = MagicMock()
sys.modules["anthropic"] = mock_anthropic_mod

import json
from trackly.client import Trackly

class MockUsage:
    def __init__(self):
        self.input_tokens = 10
        self.output_tokens = 19

class MockMessage:
    def __init__(self):
        self.id = "msg_01HASd1BviLefzZwavDFfVrA"
        self.model = "claude-haiku-4-5-20251001"
        self.stop_reason = "end_turn"
        self.usage = MockUsage()

def test_anthropic_tracking():
    # 1. Setup mock response
    mock_response = MockMessage()

    # 2. Initialize Trackly for Anthropic
    trackly = Trackly(
        provider="anthropic",
        api_key="sk-test-key",
        anthropic_api_key="ant-test-key",
        debug=True
    )

    # 3. Patch the Anthropic client
    with patch("anthropic.Anthropic") as mock_client_class:
        mock_client = mock_client_class.return_value
        mock_client.messages.create.return_value = mock_response

        # 4. Trigger tracking
        response = trackly.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": "Hello"}]
        )

        # 5. Verify
        print("\nVerification:")
        print(f"Response usage: {response.usage.input_tokens} input, {response.usage.output_tokens} output")
        
        # Check if event was enqueued
        with trackly._worker._lock:
            events = list(trackly._worker._queue)
            print(f"Enqueued events: {len(events)}")
            if events:
                event = events[0]
                print(f"Captured Event: {json.dumps(event, indent=2)}")
                assert event["provider"] == "anthropic"
                assert event["model"] == "claude-haiku-4-5-20251001"
                assert event["prompt_tokens"] == 10
                assert event["completion_tokens"] == 19
                assert event["total_tokens"] == 29
                assert event["metadata"]["message_id"] == "msg_01HASd1BviLefzZwavDFfVrA"
                print("Success: Anthropic event captured correctly.")

if __name__ == "__main__":
    test_anthropic_tracking()
