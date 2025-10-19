from __future__ import annotations

import sys
import threading
import types
from pathlib import Path

import pytest

SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from parserator import BatchOptions, ParseRequest, ParseResponse, ParseratorClient


def test_batch_parse_parallelism_runs_concurrently():
    client = ParseratorClient("pk_test_parallel")

    sequential_detected = False
    second_started = threading.Event()
    allow_first_to_finish = threading.Event()

    def fake_parse_request(self, request: ParseRequest) -> ParseResponse:
        nonlocal sequential_detected
        if request.input_data == "first":
            if not second_started.wait(timeout=0.5):
                sequential_detected = True
            allow_first_to_finish.wait(timeout=1)
        else:
            second_started.set()
        return ParseResponse(success=True, parsed_data={"value": request.input_data})

    client.parse_request = types.MethodType(fake_parse_request, client)

    release_thread = threading.Thread(
        target=lambda: (second_started.wait(timeout=1), allow_first_to_finish.set()),
        daemon=True,
    )
    release_thread.start()

    requests = [
        ParseRequest(input_data="first", output_schema={"field": "string"}),
        ParseRequest(input_data="second", output_schema={"field": "string"}),
    ]

    response = client.batch_parse(requests, options=BatchOptions(parallelism=2))

    release_thread.join(timeout=1)

    assert not sequential_detected, "batch_parse should schedule work in parallel when possible"
    assert [result.parsed_data["value"] for result in response.results] == ["first", "second"]
    assert response.failed == []


def test_batch_options_rejects_invalid_parallelism() -> None:
    with pytest.raises(ValueError):
        BatchOptions(parallelism=0)

    with pytest.raises(TypeError):
        BatchOptions(parallelism="workers")
