import os
import time
import requests
import atexit
import threading
from typing import Optional, Dict, Any

class _TracklyWorker:
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        debug: bool = False,
        max_queue_size: int = 5000,
    ):
        self.debug = debug or os.getenv("TRACKLY_DEBUG", "").strip() == "1"
        self.api_key = api_key or os.getenv("TRACKLY_API_KEY")
        if not self.api_key and self.debug:
            print(
                "[Trackly] warning: No API key found. "
                "Tracking is disabled. Set TRACKLY_API_KEY to enable."
            )

        url = base_url or os.getenv("TRACKLY_BASE_URL", "https://trackly-backend-fxob.onrender.com/api/v1")
        self.base_url = url.rstrip("/")

        self._queue: list = []
        self._max_queue_size = max_queue_size
        self._lock = threading.Lock()

        self._stop_event = threading.Event()
        self._thread = threading.Thread(
            target=self._worker, daemon=True, name="trackly-flusher"
        )
        self._thread.start()
        atexit.register(self.shutdown)

    def _enqueue(self, event: Dict[str, Any]):
        with self._lock:
            if len(self._queue) >= self._max_queue_size:
                self._queue.pop(0)
            self._queue.append(event)
        if self.debug:
            etype = event.get("event_type", "generation")
            if etype in ("trace_start", "trace_end"):
                print(f"[Trackly] enqueued: {etype} name={event.get('name')} "
                      f"trace_id={event.get('trace_id', '')[:8]}...")
            elif etype in ("span", "step", "generation"):
                print(f"[Trackly] enqueued: {etype} name={event.get('name')} "
                      f"type={event.get('type')} status={event.get('status')}")
            else:
                print(f"[Trackly] enqueued: provider={event.get('provider')} "
                      f"model={event.get('model')} tokens={event.get('total_tokens')}")

    def _worker(self):
        while not self._stop_event.is_set():
            self._stop_event.wait(timeout=2.0)
            self._flush()

    def _flush(self):
        with self._lock:
            if not self._queue:
                return
            batch = self._queue[:]
            self._queue.clear()

        endpoint = self.base_url
        if not endpoint.endswith("/events"):
            endpoint = f"{endpoint}/events"

        for attempt in range(3):
            try:
                res = requests.post(
                    endpoint,
                    json={"events": batch},
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5.0,
                )
                if self.debug:
                    print(f"[Trackly] sent {len(batch)} events → HTTP {res.status_code}")
                return
            except Exception as exc:
                if self.debug:
                    print(f"[Trackly] send failed (attempt {attempt + 1}/3): {exc}")
                if attempt < 2:
                    time.sleep(1.0)

        if self.debug:
            print(f"[Trackly] dropped {len(batch)} events after 3 failed attempts")

    def shutdown(self, timeout: float = 5.0):
        """Flush remaining events and stop the background thread."""
        if self._stop_event.is_set():
            return
        self._stop_event.set()
        if self.debug:
            print("[Trackly] shutting down, flushing...")
        self._flush()
        self._thread.join(timeout=timeout)
