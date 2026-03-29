import time
from typing import Any, Optional, TYPE_CHECKING
from ..constants import Providers

if TYPE_CHECKING:
    from ..client import Trackly

class AnthropicMessagesWrapper:
    def __init__(self, trackly: 'Trackly'):
        self._trackly = trackly
        self._client = None
        self._async_client = None

    def _get_client(self, api_key: Optional[str] = None):
        if self._trackly.provider != Providers.ANTHROPIC:
            raise ValueError(
                f"Trackly instance not configured for Anthropic provider. "
                f"Current provider: {self._trackly.provider}"
            )
            
        from anthropic import Anthropic
        if api_key:
            return Anthropic(api_key=api_key)
        if self._client is None:
            self._client = Anthropic(api_key=self._trackly.anthropic_api_key)
        return self._client

    def _get_async_client(self, api_key: Optional[str] = None):
        if self._trackly.provider != Providers.ANTHROPIC:
            raise ValueError(
                f"Trackly instance not configured for Anthropic provider. "
                f"Current provider: {self._trackly.provider}"
            )

        from anthropic import AsyncAnthropic
        if api_key:
            return AsyncAnthropic(api_key=api_key)
        if self._async_client is None:
            self._async_client = AsyncAnthropic(api_key=self._trackly.anthropic_api_key)
        return self._async_client

    def create(self, **kwargs):
        """Wrap anthropic messages create and log usage."""
        api_key = kwargs.pop("api_key", None)
        client = self._get_client(api_key=api_key)
        start_time = time.time()
        response = client.messages.create(**kwargs)
        latency_ms = int((time.time() - start_time) * 1000)
        self._trackly._log_anthropic_event(response, latency_ms)
        return response

    async def create_async(self, **kwargs):
        """Wrap anthropic messages create async and log usage."""
        api_key = kwargs.pop("api_key", None)
        client = self._get_async_client(api_key=api_key)
        start_time = time.time()
        response = await client.messages.create(**kwargs)
        latency_ms = int((time.time() - start_time) * 1000)
        self._trackly._log_anthropic_event(response, latency_ms)
        return response
