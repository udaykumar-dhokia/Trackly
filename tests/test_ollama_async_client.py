import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from trackly import Trackly


def test_ollama_async_client_is_lazily_initialized_and_reused():
    fake_instance = MagicMock(name="AsyncClientInstance")
    fake_constructor = MagicMock(return_value=fake_instance)
    fake_ollama = SimpleNamespace(AsyncClient=fake_constructor)

    with patch.dict(sys.modules, {"ollama": fake_ollama}):
        trackly = Trackly(provider="ollama")

        first = trackly._get_ollama_async_client()
        second = trackly._get_ollama_async_client()

    assert first is fake_instance
    assert second is fake_instance
    fake_constructor.assert_called_once_with()
