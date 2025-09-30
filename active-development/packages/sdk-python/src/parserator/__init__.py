"""Lightweight Parserator SDK facade used in integration examples."""
from __future__ import annotations

from .client import (
    ParseMetadata,
    ParseResponse,
    ParseratorClient,
    ParseratorError,
    ValidationError,
)

__all__ = [
    "ParseratorClient",
    "ParseratorError",
    "ValidationError",
    "ParseResponse",
    "ParseMetadata",
    "create_client",
    "quick_parse",
]


def create_client(api_key: str, **kwargs) -> ParseratorClient:
    """Helper that mirrors the JavaScript SDK interface."""

    return ParseratorClient(api_key=api_key, **kwargs)


def quick_parse(
    api_key: str,
    input_data: str,
    output_schema: dict,
    instructions: str | None = None,
) -> ParseResponse:
    """Single-call helper used by documentation snippets."""

    client = ParseratorClient(api_key=api_key)
    return client.parse(
        input_data=input_data,
        output_schema=output_schema,
        instructions=instructions,
    )
