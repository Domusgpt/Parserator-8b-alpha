"""Minimal Parserator API client used by the integrations test-suite.

The real production client performs authenticated HTTP requests against the
Parserator service.  For the purposes of the repository smoke tests we only
need a deterministic implementation that validates inputs and returns a mock
response.  This keeps the integration examples importable without requiring
network access or credentials.
"""
from __future__ import annotations

from typing import Any, Dict, Optional, Sequence

from .errors import NetworkError, ParseratorError, ValidationError
from .types import (
    BatchOptions,
    BatchParseRequest,
    BatchParseResponse,
    ParseMetadata,
    ParseOptions,
    ParseRequest,
    ParseResponse,
    ParseResult,
    ParseratorConfig,
)
from .utils import validate_api_key, validate_input_data, validate_schema

_DEFAULT_BASE_URL = "https://api.parserator.com"


class ParseratorClient:
    """Light-weight stand in for the real Parserator API client."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        default_options: Optional[ParseOptions] = None,
    ) -> None:
        validate_api_key(api_key)
        self.config = ParseratorConfig(
            api_key=api_key,
            base_url=base_url or _DEFAULT_BASE_URL,
            timeout=timeout,
        )
        self._default_options = default_options or ParseOptions()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def parse(
        self,
        *,
        input_data: str,
        output_schema: Dict[str, Any],
        instructions: Optional[str] = None,
        options: Optional[ParseOptions] = None,
    ) -> ParseResult:
        """Perform a mock parse call.

        The implementation only validates the inputs and returns the payload so
        tests can exercise higher level logic without performing real network
        requests.
        """

        validate_input_data(input_data)
        validate_schema(output_schema)

        combined_options = options or self._default_options
        metadata = ParseMetadata(
            confidence=0.5,
            processing_time_ms=5,
            request_id="local-test",
            raw={
                "options": {
                    "validation": combined_options.validation.value,
                    "locale": combined_options.locale,
                    "timezone": combined_options.timezone,
                }
            },
        )

        parsed = {
            "input": input_data,
            "schema": output_schema,
        }
        if instructions:
            parsed["instructions"] = instructions

        return ParseResponse(success=True, parsed_data=parsed, metadata=metadata)

    def batch_parse(
        self,
        requests: Sequence[ParseRequest] | BatchParseRequest,
        *,
        options: Optional[BatchOptions] = None,
    ) -> BatchParseResponse:
        """Mock batch parse helper used in documentation snippets."""

        if isinstance(requests, BatchParseRequest):
            request_list = list(requests.requests)
        else:
            request_list = list(requests)

        results = []
        for request in request_list:
            try:
                result = self.parse(
                    input_data=request.input_data,
                    output_schema=request.output_schema,
                    instructions=request.instructions,
                    options=request.options,
                )
            except ValidationError as exc:  # pragma: no cover - defensive
                results.append(
                    ParseResponse(
                        success=False,
                        error_message=str(exc),
                        metadata=ParseMetadata(),
                    )
                )
            else:
                results.append(result)

        return BatchParseResponse(results=results)

    # ------------------------------------------------------------------
    # Helper utilities
    # ------------------------------------------------------------------
    def health_check(self) -> bool:
        """Pretend to perform a network connectivity check."""

        # The mock client always succeeds unless a consumer overrides it.
        return True

    def raise_for_network(self) -> None:
        """Helper method used in documentation to demonstrate error handling."""

        raise NetworkError("Simulated network failure for documentation examples.")

    def ensure_authenticated(self) -> None:
        """Ensure the configured API key is present."""

        if not self.config.api_key:
            raise ParseratorError("Parserator API key is missing from configuration.")

    # Allow the client to be used as a context manager in documentation
    def __enter__(self) -> "ParseratorClient":  # pragma: no cover - syntactic sugar
        self.ensure_authenticated()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - syntactic sugar
        return None


__all__ = ["ParseratorClient"]
