"""Tests for metadata parsing, including fallback summaries."""
from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import pytest

SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from parserator import ParseRequest, ParseratorClient  # noqa: E402


def make_client_with_body(body: dict) -> ParseratorClient:
    client = ParseratorClient("pk_test_metadata")

    def fake_request(self, method, path, payload):
        return 200, json.dumps(body).encode("utf-8"), {"x-request-id": "req_123"}

    client._request = types.MethodType(fake_request, client)  # type: ignore[attr-defined]
    return client


def test_parse_response_populates_fallback_summary() -> None:
    body = {
        "success": True,
        "parsedData": {"total": "42"},
        "metadata": {
            "confidence": 0.91,
            "processingTimeMs": 120,
            "fallback": {
                "leanLLM": {
                    "totalInvocations": 2,
                    "resolvedFields": 1,
                    "reusedResolutions": 1,
                    "skippedByPlanConfidence": 0,
                    "skippedByLimits": 1,
                    "sharedExtractions": 1,
                    "totalTokens": 88,
                    "planConfidenceGate": 0.4,
                    "maxInvocationsPerParse": 3,
                    "maxTokensPerParse": 200,
                    "fields": [
                        {
                            "field": "total",
                            "action": "invoked",
                            "resolved": True,
                            "confidence": 0.72,
                            "tokensUsed": 44,
                            "reason": "llm fallback used",
                            "sharedKeys": ["subtotal", "tax"],
                            "plannerConfidence": 0.35,
                            "gate": 0.4,
                        },
                        {
                            "field": "notes",
                            "action": "skipped",
                            "limitType": "tokens",
                            "limit": 200,
                            "currentTokens": 205,
                            "error": "token budget reached",
                        },
                    ],
                }
            },
        },
    }

    client = make_client_with_body(body)
    request = ParseRequest(input_data="sample", output_schema={"total": "string"})

    response = client.parse_request(request)

    fallback = response.metadata.fallback
    assert fallback is not None
    assert fallback.lean_llm is not None
    summary = fallback.lean_llm
    assert summary.total_invocations == 2
    assert summary.resolved_fields == 1
    assert summary.skipped_by_limits == 1
    assert summary.plan_confidence_gate == pytest.approx(0.4)
    assert summary.fields and summary.fields[0].field == "total"
    assert summary.fields[0].shared_keys == ["subtotal", "tax"]
    assert summary.fields[1].limit_type == "tokens"
    assert summary.fields[1].limit == 200
    assert summary.fields[1].error == "token budget reached"
