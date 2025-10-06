"""Utilities for bridging async Parserator client calls from sync integrations."""

from __future__ import annotations

import asyncio
import threading
from typing import Awaitable, Callable, Optional, TypeVar

_T = TypeVar("_T")


class _BackgroundEventLoopRunner:
    """Manage a background event loop used when a loop is already running.

    Some host environments (e.g., notebooks or agent runtimes) keep an asyncio
    event loop alive on the main thread. Calling ``asyncio.run`` from those
    contexts raises ``RuntimeError``. To keep the integrations synchronous while
    still leveraging the async Parserator SDK, we lazily spin up a dedicated
    background loop and submit work to it.
    """

    def __init__(self) -> None:
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._thread: Optional[threading.Thread] = None
        self._ready = threading.Event()
        self._lock = threading.Lock()

    def _ensure_loop(self) -> asyncio.AbstractEventLoop:
        with self._lock:
            loop = self._loop
            if loop is not None and loop.is_running():
                return loop

            self._ready.clear()
            loop = asyncio.new_event_loop()

            def _runner() -> None:
                asyncio.set_event_loop(loop)
                self._ready.set()
                try:
                    loop.run_forever()
                finally:  # pragma: no cover - interpreter shutdown safety
                    loop.run_until_complete(loop.shutdown_asyncgens())
                    loop.close()

            thread = threading.Thread(
                target=_runner,
                name="parserator-async-bridge",
                daemon=True,
            )
            thread.start()
            self._ready.wait()

            self._loop = loop
            self._thread = thread
            return loop

    def run(self, call: Callable[[], Awaitable[_T]]) -> _T:
        loop = self._ensure_loop()

        try:
            coroutine = call()
        except BaseException:
            raise

        future = asyncio.run_coroutine_threadsafe(coroutine, loop)
        return future.result()


_BACKGROUND_LOOP_RUNNER = _BackgroundEventLoopRunner()


def run_async(call: Callable[[], Awaitable[_T]]) -> _T:
    """Execute an awaitable in synchronous contexts.

    The Parserator integrations need to invoke the async SDK client from
    synchronous entry points exposed to third-party frameworks. When those
    frameworks already have an event loop running (for example, in Jupyter
    notebooks or async agent runtimes), ``asyncio.run`` cannot be used directly.
    This helper detects that scenario and delegates execution to a shared
    background event loop so we do not spawn new threads for each call.
    """

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(call())

    return _BACKGROUND_LOOP_RUNNER.run(call)
