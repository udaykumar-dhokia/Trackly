import time
from datetime import datetime, timezone
from typing import Any, Optional, Dict, List

class GeminiModelsWrapper:
    def __init__(self, trackly: 'Trackly'):
        self._trackly = trackly
        self._client = None

    def _get_client(self, api_key: Optional[str] = None):
        """Get a genai client, optionally overriding the API key."""
        from google import genai
        if api_key:
            return genai.Client(api_key=api_key)
        
        if self._client is None:
            self._client = genai.Client(api_key=self._trackly.gemini_api_key)
        return self._client

    def generate_content(self, model: str, contents: Any, **kwargs):
        api_key = kwargs.pop("api_key", None)
        client = self._get_client(api_key=api_key)
        start_time = time.time()
        response = client.models.generate_content(model=model, contents=contents, **kwargs)
        latency_ms = int((time.time() - start_time) * 1000)
        self._trackly._log_gemini_event(model, response, latency_ms)
        return response

    async def generate_content_async(self, model: str, contents: Any, **kwargs):
        api_key = kwargs.pop("api_key", None)
        client = self._get_client(api_key=api_key)
        start_time = time.time()
        response = await client.models.generate_content(model=model, contents=contents, **kwargs)
        latency_ms = int((time.time() - start_time) * 1000)
        self._trackly._log_gemini_event(model, response, latency_ms)
        return response

class GeminiBatchesWrapper:
    def __init__(self, trackly: 'Trackly'):
        self._trackly = trackly
        self._client = None

    def _get_client(self, api_key: Optional[str] = None):
        """Get a genai client, optionally overriding the API key."""
        from google import genai
        if api_key:
            return genai.Client(api_key=api_key)
        
        if self._client is None:
            self._client = genai.Client(api_key=self._trackly.gemini_api_key)
        return self._client

    def create(self, model: str, src: Any, config: Optional[Dict] = None, **kwargs):
        """Wrap client.batches.create and log the job initiation."""
        api_key = kwargs.pop("api_key", None)
        client = self._get_client(api_key=api_key)
        response = client.batches.create(model=model, src=src, config=config, **kwargs)
        
        self._trackly._log_gemini_batch_event(model, response, "create")
        return response

    def create_embeddings(self, model: str, src: Any, config: Optional[Dict] = None, **kwargs):
        """Wrap client.batches.create_embeddings and log the job initiation."""
        api_key = kwargs.pop("api_key", None)
        client = self._get_client(api_key=api_key)
        response = client.batches.create_embeddings(model=model, src=src, config=config, **kwargs)
        self._trackly._log_gemini_batch_event(model, response, "create_embeddings")
        return response

    def get(self, name: str, **kwargs):
        """Wrap client.batches.get and log usage if job is completed."""
        api_key = kwargs.pop("api_key", None)
        client = self._get_client(api_key=api_key)
        job = client.batches.get(name=name, **kwargs)
        
        if hasattr(job, "state") and str(job.state) == "JOB_STATE_SUCCEEDED":
            self._trackly._log_gemini_batch_event(getattr(job, "model", "unknown"), job, "status_check")
        
        return job

    def list(self, **kwargs):
        api_key = kwargs.pop("api_key", None)
        return self._get_client(api_key=api_key).batches.list(**kwargs)

    def cancel(self, name: str, **kwargs):
        api_key = kwargs.pop("api_key", None)
        return self._get_client(api_key=api_key).batches.cancel(name=name, **kwargs)

    def delete(self, name: str, **kwargs):
        api_key = kwargs.pop("api_key", None)
        return self._get_client(api_key=api_key).batches.delete(name=name, **kwargs)
