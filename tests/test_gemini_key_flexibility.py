import sys
from unittest.mock import MagicMock, patch

# Mock the google parts if not present
mock_genai = MagicMock()
sys.modules["google"] = MagicMock()
sys.modules["google.genai"] = mock_genai

from trackly import Trackly

def test_gemini_api_key_flexibility():
    # 1. Initialize Trackly without keys (should not crash now)
    trackly = Trackly(provider="gemini", debug=True)
    print("Trackly initialized without keys successfully.")

    # 2. Test generate_content with per-call api_key
    with patch("google.genai.Client") as mock_client_class:
        mock_client = mock_client_class.return_value
        
        print("\nTesting generate_content with per-call api_key:")
        trackly.models.generate_content(
            model="gemini-1.5-flash",
            contents="Hello",
            api_key="sk-per-call-key"
        )
        
        # Verify that Client was called with the specific api_key
        mock_client_class.assert_called_with(api_key="sk-per-call-key")
        print("✓ Success: Client initialized with per-call api_key.")

    # 3. Test default gemini_api_key
    trackly_with_key = Trackly(provider="gemini", gemini_api_key="sk-default-gemini-key", debug=True)
    with patch("google.genai.Client") as mock_client_class:
        trackly_with_key.models.generate_content(
            model="gemini-1.5-flash",
            contents="Hello"
        )
        mock_client_class.assert_called_with(api_key="sk-default-gemini-key")
        print("✓ Success: Client initialized with default gemini_api_key.")

if __name__ == "__main__":
    test_gemini_api_key_flexibility()
