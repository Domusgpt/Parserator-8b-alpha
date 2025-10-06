"""Utilities for bridging async Parserator client calls from sync integrations."""

from __future__ import annotations

import asyncio
import atexit
import contextvars
import threading
from collections.abc import Awaitable, Callable
from typing import TypeVar

_T = TypeVar("_T")


async def _resolve(awaitable: Awaitable[_T]) -> _T:
    """Await an awaitable value and return the resolved result."""

    return await awaitable


class _BackgroundLoop:
    """Manage a dedicated event loop running in a background thread."""

    def __init__(self) -> None:
        self._loop_ready = threading.Event()
        self._lock = threading.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None

    def _run_loop(self) -> None:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        self._loop = loop
        self._loop_ready.set()

        try:
            loop.run_forever()
        finally:
            pending = asyncio.all_tasks(loop)
            for task in pending:
                task.cancel()
            if pending:
                loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
            loop.close()
            self._loop = None

    def ensure_running(self) -> asyncio.AbstractEventLoop:
        loop = self._loop
        if loop is not None and loop.is_running():
            return loop

        with self._lock:
            loop = self._loop
            if loop is not None and loop.is_running():
                return loop

            self._loop_ready.clear()
            self._thread = threading.Thread(
                target=self._run_loop,
                name="parserator-run-async",
                daemon=True,
            )
            self._thread.start()

        self._loop_ready.wait()
        assert self._loop is not None
        return self._loop

    def stop(self) -> None:
        with self._lock:
            loop = self._loop
            thread = self._thread

        if loop is not None and loop.is_running():
            loop.call_soon_threadsafe(loop.stop)

        if thread is not None:
            thread.join(timeout=1.0)

        with self._lock:
            self._loop = None
            self._thread = None

    def run(self, coroutine: Awaitable[_T]) -> _T:
        loop = self.ensure_running()
        future = asyncio.run_coroutine_threadsafe(coroutine, loop)
        return future.result()


_BACKGROUND_LOOP = _BackgroundLoop()
atexit.register(_BACKGROUND_LOOP.stop)


def run_async(call: Callable[[], Awaitable[_T]] | Awaitable[_T]) -> _T:
    """Execute an awaitable in synchronous contexts.

    The Parserator integrations need to invoke the async SDK client from
    synchronous entry points exposed to third-party frameworks. When those
    frameworks already have an event loop running (for example, in Jupyter
    notebooks or async agent runtimes), ``asyncio.run`` cannot be used
    directly. This helper detects that scenario and offloads execution to a
    dedicated thread where a private event loop can safely drive the coroutine.

    The helper accepts either a callable that returns an awaitable or an
    awaitable object directly. In both cases, execution happens inside a copy
    of the current :mod:`contextvars` context so request-scoped data is
    preserved even when the coroutine is resolved on a different thread.
    """

    context = contextvars.copy_context()

    def produce() -> Awaitable[_T]:
        if isinstance(call, Awaitable):
            awaitable = call
        elif callable(call):
            awaitable = call()
        else:  # pragma: no cover - defensive
            raise TypeError("run_async expected an awaitable or a callable returning one")

        if not isinstance(awaitable, Awaitable):
            raise TypeError("run_async received a non-awaitable value")

        return awaitable

    awaitable = context.run(produce)

    def execute() -> _T:
        def runner() -> _T:
            coroutine = _resolve(awaitable)
            return asyncio.run(coroutine)

        return context.run(runner)

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return execute()

    coroutine = context.run(lambda: _resolve(awaitable))
    return _BACKGROUND_LOOP.run(coroutine)
