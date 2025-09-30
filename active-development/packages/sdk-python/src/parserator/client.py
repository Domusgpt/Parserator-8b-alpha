"""Minimal Parserator client used by integration examples.

The repository does not ship the production client that talks to the live
Parserator service.  Instead we provide a tiny in-memory implementation so the
integration helpers can be imported during documentation builds and smoke
tests.  The mock client performs basic validation and returns the payload back
in a structured :class:`ParseResponse` object.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


class ParseratorError(Exception):
    """Base error for the lightweight Parserator client."""


class ValidationError(ParseratorError):
    """Raised when the provided inputs are invalid."""


@dataclass
class ParseMetadata:
    """Metadata returned from a parse request."""

    confidence: float = 0.0
    processing_time_ms: int = 0
    request_id: str = "local-test"
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParseResponse:
    """Result object returned by :meth:`ParseratorClient.parse`."""

    success: bool
    parsed_data: Dict[str, Any]
    error_message: Optional[str] = None
    metadata: ParseMetadata = field(default_factory=ParseMetadata)


class ParseratorClient:
    """Extremely small stand-in for the real Parserator API client."""

    def __init__(self, api_key: str, *, base_url: Optional[str] = None) -> None:
        if not isinstance(api_key, str) or not api_key.strip():
            raise ValidationError("Parserator API key must be a non-empty string.")

        self.api_key = api_key
        self.base_url = base_url or "https://api.parserator.com"

    def parse(
        self,
        *,
        input_data: str,
        output_schema: Dict[str, Any],
        instructions: Optional[str] = None,
    ) -> ParseResponse:
        """Return a deterministic response echoing the supplied payload."""

        if not isinstance(input_data, str) or not input_data.strip():
            raise ValidationError("input_data must be a non-empty string.")

        if not isinstance(output_schema, dict) or not output_schema:
            raise ValidationError("output_schema must be a non-empty dictionary.")

        parsed: Dict[str, Any] = {
            "input": input_data,
            "schema": output_schema,
        }

        if instructions:
            parsed["instructions"] = instructions

        return ParseResponse(success=True, parsed_data=parsed)


__all__ = [
    "ParseratorClient",
    "ParseratorError",
    "ValidationError",
    "ParseResponse",
    "ParseMetadata",
]
