"""Custom exception hierarchy for the Parserator Python SDK."""
from __future__ import annotations

from typing import Optional


class ParseratorError(Exception):
    """Base exception for all Parserator SDK errors."""

    def __init__(self, message: str, *, request_id: Optional[str] = None) -> None:
        super().__init__(message)
        self.request_id = request_id


class ValidationError(ParseratorError):
    """Raised when the supplied schema or data fails validation."""


class AuthenticationError(ParseratorError):
    """Raised when authentication with the Parserator API fails."""


class RateLimitError(ParseratorError):
    """Raised when the API rate limit has been exceeded."""


class QuotaExceededError(ParseratorError):
    """Raised when the organisation has exceeded its allocated usage."""


class NetworkError(ParseratorError):
    """Raised when a network level issue prevents the request from completing."""


class TimeoutError(ParseratorError):
    """Raised when the API request exceeds the configured timeout."""


class ParseFailedError(ParseratorError):
    """Raised when the Parserator service fails to extract the requested data."""


class ServiceUnavailableError(ParseratorError):
    """Raised when the Parserator service is temporarily unavailable."""


__all__ = [
    "ParseratorError",
    "ValidationError",
    "AuthenticationError",
    "RateLimitError",
    "QuotaExceededError",
    "NetworkError",
    "TimeoutError",
    "ParseFailedError",
    "ServiceUnavailableError",
]
