"""Async retry helpers for network calls."""

from __future__ import annotations

import asyncio
import random
from typing import Awaitable, Callable, Optional, TypeVar

from ..types import RetryConfig

T = TypeVar("T")


async def async_retry(
    func: Callable[[], Awaitable[T]],
    config: RetryConfig,
    should_retry: Optional[Callable[[Exception, int], bool]] = None,
) -> T:
    """Retry an async callable with exponential backoff."""

    attempt = 0
    delay = config.base_delay

    while True:
        try:
            return await func()
        except Exception as exc:  # pragma: no cover - behaviour exercised in client tests
            if attempt >= config.max_retries:
                raise
            if should_retry is not None and not should_retry(exc, attempt):
                raise

            jitter = random.random() * 0.5
            await asyncio.sleep(min(config.max_delay, delay) + jitter)
            delay = min(config.max_delay, delay * config.backoff_factor)
            attempt += 1


__all__ = ["async_retry"]
