"""Simple asynchronous rate limiter used by the Parserator client."""

from __future__ import annotations

import asyncio
import time


class RateLimiter:
    """Asynchronous token bucket rate limiter."""

    def __init__(self, requests_per_second: float = 10.0) -> None:
        if requests_per_second <= 0:
            raise ValueError("requests_per_second must be positive")
        self._interval = 1.0 / requests_per_second
        self._lock = asyncio.Lock()
        self._last_acquired = 0.0

    async def acquire(self) -> None:
        """Wait until the caller is allowed to proceed."""

        async with self._lock:
            now = time.monotonic()
            wait_time = self._interval - (now - self._last_acquired)
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self._last_acquired = time.monotonic()


__all__ = ["RateLimiter"]
