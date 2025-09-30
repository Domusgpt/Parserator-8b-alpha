import json

import httpx
import pytest

from parserator import ParseratorClient
from parserator.errors import ValidationError


def _success_response() -> dict:
    return {
        "success": True,
        "parsedData": {"name": "Ada Lovelace"},
        "metadata": {
            "confidence": 0.98,
            "tokensUsed": 128,
            "processingTimeMs": 321,
            "requestId": "req_test",
            "timestamp": "2024-01-01T00:00:00Z",
        },
    }


@pytest.mark.asyncio
async def test_parse_success_merges_options() -> None:
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["headers"] = dict(request.headers)
        captured["body"] = json.loads(request.content.decode())
        return httpx.Response(200, json=_success_response())

    transport = httpx.MockTransport(handler)

    async with ParseratorClient(
        api_key="pk_test_123",
        default_options={"include_metadata": True},
        transport=transport,
    ) as client:
        result = await client.parse(
            input_data="Name: Ada Lovelace",
            output_schema={"name": "string"},
            options={"validate_output": True},
        )

    assert result.success is True
    assert result.parsed_data["name"] == "Ada Lovelace"
    assert captured["headers"]["authorization"].startswith("Bearer pk_test_123")
    assert captured["body"]["inputData"] == "Name: Ada Lovelace"
    assert captured["body"]["options"] == {
        "includeMetadata": True,
        "validateOutput": True,
    }


@pytest.mark.asyncio
async def test_parse_validation_error() -> None:
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=_success_response()))

    async with ParseratorClient(api_key="pk_test_123", transport=transport) as client:
        with pytest.raises(ValidationError):
            await client.parse(input_data="   ", output_schema={})
