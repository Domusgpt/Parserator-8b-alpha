"""Utilities for bridging async Parserator client calls from sync integrations."""

from __future__ import annotations

import asyncio
import threading
from typing import Awaitable, Callable, TypeVar

_T = TypeVar("_T")


def run_async(call: Callable[[], Awaitable[_T]]) -> _T:
    """Execute an awaitable in synchronous contexts.

    The Parserator integrations need to invoke the async SDK client from
    synchronous entry points exposed to third-party frameworks. When those
    frameworks already have an event loop running (for example, in Jupyter
    notebooks or async agent runtimes), ``asyncio.run`` cannot be used
    directly. This helper detects that scenario and offloads execution to a
    dedicated thread where ``asyncio.run`` can safely manage its own loop.
    """

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(call())

    result: list[_T] = []
    error: list[BaseException] = []

    def runner() -> None:
        try:
            result.append(asyncio.run(call()))
        except BaseException as exc:  # pragma: no cover - defensive
            error.append(exc)

    thread = threading.Thread(target=runner, daemon=True)
    thread.start()
    thread.join()

    if error:
        raise error[0]

    return result[0]
