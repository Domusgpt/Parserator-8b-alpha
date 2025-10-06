import asyncio
import sys
from pathlib import Path

SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from parserator import BatchParseResponse, ParseResponse, ValidationType, quick_parse, quick_parse_batch


def test_quick_parse_background_thread(monkeypatch):
    """The ``quick_parse`` helper should proxy calls through the real client."""

    captured = {}

    def fake_init(self, api_key: str, **kwargs):
        captured["api_key"] = api_key
        captured["init_kwargs"] = kwargs

    def fake_parse(self, *, input_data, output_schema, instructions=None, options=None):
        captured["input_data"] = input_data
        captured["output_schema"] = output_schema
        captured["instructions"] = instructions
        captured["options"] = options
        return ParseResponse(success=True, parsed_data={"foo": "bar"})

    monkeypatch.setattr("parserator.ParseratorClient.__init__", fake_init)
    monkeypatch.setattr("parserator.ParseratorClient.parse", fake_parse)

    result = asyncio.run(
        quick_parse(
            "pk_test_123",
            "Sample text",
            {"foo": "string"},
            instructions="Do the thing",
            validation=ValidationType.LENIENT,
        )
    )

    assert result.parsed_data == {"foo": "bar"}
    assert captured["api_key"] == "pk_test_123"
    assert captured["input_data"] == "Sample text"
    assert captured["output_schema"] == {"foo": "string"}
    assert captured["instructions"] == "Do the thing"
    assert captured["options"].validation is ValidationType.LENIENT


def test_quick_parse_batch_background_thread(monkeypatch):
    """The batch helper should forward requests to ``ParseratorClient``."""

    captured = {}

    def fake_init(self, api_key: str, **kwargs):
        captured["api_key"] = api_key
        captured["init_kwargs"] = kwargs

    def fake_batch(self, requests, options=None):
        captured["requests"] = list(requests)
        captured["options"] = options
        return BatchParseResponse(
            results=[ParseResponse(success=True, parsed_data={"foo": "bar"})],
            failed=[],
        )

    monkeypatch.setattr("parserator.ParseratorClient.__init__", fake_init)
    monkeypatch.setattr("parserator.ParseratorClient.batch_parse", fake_batch)

    response = asyncio.run(
        quick_parse_batch(
            "pk_test_batch",
            ["Sample text"],
            {"foo": "string"},
        )
    )

    assert len(response.results) == 1
    assert response.results[0].parsed_data == {"foo": "bar"}
    assert captured["api_key"] == "pk_test_batch"
    assert len(captured["requests"]) == 1
    assert captured["requests"][0].input_data == "Sample text"
    assert captured["options"] is None
