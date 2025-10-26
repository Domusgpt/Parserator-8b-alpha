import asyncio
import sys
from pathlib import Path

import pytest

SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from parserator import BatchParseResponse, ParseResponse, ParseratorClient


def test_client_from_env(monkeypatch):
    """``ParseratorClient.from_env`` should respect environment overrides."""

    monkeypatch.setenv("PARSERATOR_API_KEY", "pk_test_env")
    monkeypatch.setenv("PARSERATOR_BASE_URL", "https://example.test")
    monkeypatch.setenv("PARSERATOR_TIMEOUT", "12.5")
    monkeypatch.setenv("PARSERATOR_ORG_ID", "org_123")

    client = ParseratorClient.from_env()

    assert client.config.api_key == "pk_test_env"
    assert client.config.base_url == "https://example.test"
    assert client.config.timeout == 12.5
    assert client.config.organization_id == "org_123"


def test_client_from_env_missing_key(monkeypatch):
    """A helpful error is raised when the API key variable is absent."""

    monkeypatch.delenv("PARSERATOR_API_KEY", raising=False)

    with pytest.raises(ValueError):
        ParseratorClient.from_env()


def test_parse_async_uses_thread(monkeypatch):
    """The async wrapper should delegate to the synchronous ``parse`` method."""

    result = ParseResponse(success=True, parsed_data={"value": 1})

    def fake_parse(self, **kwargs):
        fake_parse.called = True
        return result

    fake_parse.called = False
    monkeypatch.setattr(ParseratorClient, "parse", fake_parse)

    client = ParseratorClient(api_key="pk_test_123")

    parsed = asyncio.run(
        client.parse_async(
            input_data="hello",
            output_schema={"value": "number"},
        )
    )

    assert parsed is result
    assert fake_parse.called is True


def test_batch_parse_async(monkeypatch):
    """Batch async wrapper should mirror ``batch_parse``."""

    fake_response = BatchParseResponse(results=[], failed=[])

    def fake_batch(self, requests, options=None):
        fake_batch.captured = {
            "requests": list(requests),
            "options": options,
        }
        return fake_response

    fake_batch.captured = {}
    monkeypatch.setattr(ParseratorClient, "batch_parse", fake_batch)

    client = ParseratorClient(api_key="pk_test_123")

    response = asyncio.run(client.batch_parse_async([]))

    assert response is fake_response
    assert fake_batch.captured["requests"] == []
    assert fake_batch.captured["options"] is None


def test_health_check_async(monkeypatch):
    """Async health checks should call the synchronous method once."""

    def fake_health(self):
        fake_health.called += 1
        return True

    fake_health.called = 0
    monkeypatch.setattr(ParseratorClient, "health_check", fake_health)

    client = ParseratorClient(api_key="pk_test_123")

    result = asyncio.run(client.health_check_async())

    assert result is True
    assert fake_health.called == 1
