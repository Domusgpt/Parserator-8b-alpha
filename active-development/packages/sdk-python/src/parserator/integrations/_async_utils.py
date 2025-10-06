"""Utilities for bridging async Parserator client calls from sync integrations."""

from __future__ import annotations

import asyncio
import contextvars
import threading
from collections.abc import Awaitable, Callable
from typing import TypeVar

_T = TypeVar("_T")


async def _resolve(awaitable: Awaitable[_T]) -> _T:
    """Await an awaitable value and return the resolved result."""

    return await awaitable


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

    def run_with_context(func: Callable[[], _T]) -> _T:
        return context.run(func)

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return run_with_context(lambda: asyncio.run(_resolve(produce())))

    result: list[_T] = []
    error: list[BaseException] = []

    def runner() -> None:
        loop = asyncio.new_event_loop()
        try:
            asyncio.set_event_loop(loop)

            def execute() -> _T:
                return loop.run_until_complete(_resolve(produce()))

            result.append(run_with_context(execute))
        except BaseException as exc:  # pragma: no cover - defensive
            error.append(exc)
        finally:
            asyncio.set_event_loop(None)
            loop.close()

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    thread.join()

    if error:
        raise error[0]

    return result[0]
