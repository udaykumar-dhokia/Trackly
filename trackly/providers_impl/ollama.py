import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class _OllamaHandler:
    def __init__(self, trackly: 'Trackly'):
        self._trackly = trackly

    def chat(self, *args, **kwargs):
        """Wrap ollama.chat and log the usage."""
        import ollama
        if kwargs.get('stream'):
            return self._ollama_stream_wrapper(ollama.chat(*args, **kwargs))
        
        response = ollama.chat(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    def generate(self, *args, **kwargs):
        """Wrap ollama.generate and log the usage."""
        import ollama
        if kwargs.get('stream'):
            return self._ollama_stream_wrapper(ollama.generate(*args, **kwargs))
        
        response = ollama.generate(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    def embed(self, *args, **kwargs):
        """Generate embeddings via ollama and log usage."""
        import ollama
        response = ollama.embed(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    async def chat_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.chat and log usage."""
        client = self._trackly._get_ollama_async_client()
        if kwargs.get('stream'):
            return self._ollama_async_stream_wrapper(await client.chat(*args, **kwargs))
        response = await client.chat(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    async def generate_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.generate and log usage."""
        client = self._trackly._get_ollama_async_client()
        if kwargs.get('stream'):
            return self._ollama_async_stream_wrapper(await client.generate(*args, **kwargs))
        response = await client.generate(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    async def embed_async(self, *args, **kwargs):
        """Wrap ollama.AsyncClient.embed and log usage."""
        client = self._trackly._get_ollama_async_client()
        response = await client.embed(*args, **kwargs)
        self._log_ollama_event(response)
        return response

    def _ollama_stream_wrapper(self, stream):
        for chunk in stream:
            if chunk.get('done'):
                self._log_ollama_event(chunk)
            yield chunk

    async def _ollama_async_stream_wrapper(self, async_gen):
        async for chunk in async_gen:
            if chunk.get('done'):
                self._log_ollama_event(chunk)
            yield chunk

    def _log_ollama_event(self, response: Dict[str, Any]):
        try:
            total_duration = response.get("total_duration", 0)
            prompt_eval_count = response.get("prompt_eval_count", 0)
            eval_count = response.get("eval_count", 0)
            
            is_embedding = "embeddings" in response or "embedding" in response
            
            latency_ms = int(total_duration / 1_000_000)
            
            event = {
                "provider": "ollama",
                "model": response.get("model", "unknown"),
                "prompt_tokens": prompt_eval_count if not is_embedding else None,
                "completion_tokens": eval_count if not is_embedding else None,
                "total_tokens": (prompt_eval_count + eval_count) if not is_embedding else None,
                "latency_ms": latency_ms,
                "feature": self._trackly.feature,
                "environment": self._trackly.environment,
                "session_id": self._trackly.session_id,
                "run_id": str(uuid.uuid4()),
                "extra": self._trackly._trace_event_context() or None,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            
            if is_embedding:
                event["finish_reason"] = "embedding"

            prompt_eval_duration = response.get("prompt_eval_duration")
            eval_duration = response.get("eval_duration")
            if prompt_eval_duration is not None or eval_duration is not None:
                extra = event.get("extra") or {}
                extra.update({
                    "prompt_eval_duration_ms": int(prompt_eval_duration / 1_000_000) if prompt_eval_duration else None,
                    "eval_duration_ms": int(eval_duration / 1_000_000) if eval_duration else None,
                })
                event["extra"] = extra

            self._trackly._worker._enqueue(event)

            from ..tracing import get_active_trace
            active = get_active_trace()
            if active:
                model_name = response.get("model", "unknown")
                p_tokens = prompt_eval_count if not is_embedding else None
                c_tokens = eval_count if not is_embedding else None
                t_tokens = (prompt_eval_count + eval_count) if not is_embedding else None
                active.record_generation(
                    provider="ollama",
                    model=model_name,
                    prompt_tokens=p_tokens,
                    completion_tokens=c_tokens,
                    total_tokens=t_tokens,
                    latency_ms=latency_ms,
                    finish_reason="embedding" if is_embedding else None,
                )
        except Exception as exc:
            if self._trackly._worker.debug:
                print(f"[Trackly] warning: failed to process Ollama event: {exc}")
