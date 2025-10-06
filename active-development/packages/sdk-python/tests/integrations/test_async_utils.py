"""Tests for the synchronous bridge used by Parserator integrations."""

from __future__ import annotations

import asyncio
import contextvars
import importlib.util
import threading
from pathlib import Path

import pytest

module_path = Path(__file__).resolve().parents[2] / "src" / "parserator" / "integrations" / "_async_utils.py"
spec = importlib.util.spec_from_file_location("parserator.integrations._async_utils", module_path)
_async_utils = importlib.util.module_from_spec(spec)
assert spec.loader is not None  # for mypy/static tools
spec.loader.exec_module(_async_utils)
run_async = _async_utils.run_async


async def _return_value(value: str) -> str:
    await asyncio.sleep(0)
    return value


def test_run_async_executes_coroutine_without_running_loop():
    """The helper should run coroutines when no loop is active."""

    result = run_async(lambda: _return_value("ok"))
    assert result == "ok"


def test_run_async_accepts_coroutine_object():
    """A coroutine object can be supplied directly."""

    result = run_async(_return_value("direct"))
    assert result == "direct"


def test_run_async_handles_running_loop():
    """When a loop is already running, execution should still succeed."""

    async def runner() -> str:
        return run_async(lambda: _return_value("loop"))

    assert asyncio.run(runner()) == "loop"


def test_run_async_uses_background_thread_for_running_loop():
    """Coroutines dispatched from a running loop should execute on the helper thread."""

    async def capture_thread() -> str:
        return threading.current_thread().name

    async def runner() -> tuple[str, str]:
        first = run_async(capture_thread)
        second = run_async(capture_thread)
        return first, second

    thread_one, thread_two = asyncio.run(runner())

    assert thread_one == thread_two == "parserator-run-async"


def test_run_async_preserves_contextvars_in_thread():
    """Context variables should flow through when no loop is running."""

    marker: contextvars.ContextVar[str | None] = contextvars.ContextVar("marker", default=None)
    token = marker.set("thread-context")

    async def read_marker() -> str | None:
        return marker.get()

    try:
        assert run_async(read_marker) == "thread-context"
    finally:
        marker.reset(token)


def test_run_async_preserves_contextvars_from_running_loop():
    """Context variables set inside an active loop should propagate."""

    marker: contextvars.ContextVar[str | None] = contextvars.ContextVar("marker", default=None)

    async def runner() -> str | None:
        token = marker.set("running-loop")
        try:
            async def read_marker() -> str | None:
                return marker.get()

            return run_async(read_marker)
        finally:
            marker.reset(token)

    assert asyncio.run(runner()) == "running-loop"


def test_run_async_propagates_exceptions():
    """Errors raised by the awaitable should bubble up."""

    async def raises() -> None:
        raise ValueError("boom")

    with pytest.raises(ValueError, match="boom"):
        run_async(raises)


def test_run_async_rejects_nonawaitable():
    """Passing a callable that does not yield an awaitable should fail."""

    def not_async():
        return "not awaitable"

    with pytest.raises(TypeError):
        run_async(not_async)
