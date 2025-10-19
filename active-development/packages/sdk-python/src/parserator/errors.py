"""Custom exceptions used by the Parserator Python SDK."""

from __future__ import annotations

from typing import Any, Dict, Optional, Type

from .types import ErrorCode, ParseError


class ParseratorError(Exception):
    """Base error class for all SDK exceptions."""

    code: ErrorCode
    details: Optional[Dict[str, Any]]
    suggestion: Optional[str]

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        suggestion: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.details = details
        self.suggestion = suggestion

    @classmethod
    def from_api_response(
        cls, data: Dict[str, Any], status: Optional[int] = None
    ) -> "ParseratorError":
        details = data.get("details") or {}
        if status is not None:
            details = {**details, "status": status}
        return cls(
            data.get("code", "INTERNAL_ERROR"),
            data.get("message", "An unexpected error occurred"),
            details,
            data.get("suggestion"),
        )

    def to_dict(self) -> ParseError:
        """Return a serialisable representation of the error."""

        return ParseError(  # type: ignore[return-value]
            code=self.code,
            message=str(self),
            details=self.details,
            suggestion=self.suggestion,
        )

    def get_display_message(self) -> str:
        """Human friendly message including suggestions when available."""

        if self.suggestion:
            return f"{self} Suggestion: {self.suggestion}"
        return str(self)


class ValidationError(ParseratorError):
    """Raised when SDK level validation fails."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(
            "INVALID_INPUT",
            f"Validation failed: {message}",
            details,
            "Please check your input data and try again",
        )


class AuthenticationError(ParseratorError):
    """Raised for invalid or missing API keys."""

    def __init__(self, message: str = "Invalid API key") -> None:
        super().__init__(
            "INVALID_API_KEY",
            message,
            suggestion="Please verify that your API key is correct and has the required permissions",
        )


class RateLimitError(ParseratorError):
    """Raised when the API signals rate limiting."""

    retry_after: Optional[float]

    def __init__(
        self, message: str = "Rate limit exceeded", retry_after: Optional[float] = None
    ) -> None:
        suggestion = (
            f"Please wait {retry_after} seconds before retrying"
            if retry_after is not None
            else "Please reduce the rate of requests"
        )
        super().__init__(
            "RATE_LIMIT_EXCEEDED",
            message,
            details={"retry_after": retry_after} if retry_after is not None else None,
            suggestion=suggestion,
        )
        self.retry_after = retry_after


class QuotaExceededError(ParseratorError):
    """Raised when the organisation has exhausted its API quota."""

    def __init__(self, message: str = "API quota exceeded") -> None:
        super().__init__(
            "QUOTA_EXCEEDED",
            message,
            suggestion="Please upgrade your plan or wait for quota reset",
        )


class NetworkError(ParseratorError):
    """Raised for transport level issues."""

    def __init__(self, message: str = "Network error", details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(
            "NETWORK_ERROR",
            message,
            details,
            "Please check your internet connection and try again",
        )


class TimeoutError(ParseratorError):
    """Raised when a request exceeds the configured timeout."""

    def __init__(self, timeout: int) -> None:
        super().__init__(
            "TIMEOUT",
            f"Request timed out after {timeout}ms",
            details={"timeout": timeout},
            suggestion="Try increasing the timeout value or reducing the size of your input data",
        )


class ParseFailedError(ParseratorError):
    """Raised when the Parserator API returns an unsuccessful response."""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None) -> None:
        super().__init__(
            "PARSE_FAILED",
            message,
            details,
            "Try adjusting your output schema or providing clearer instructions",
        )


class ServiceUnavailableError(ParseratorError):
    """Raised when the service is temporarily unavailable."""

    def __init__(self, message: str = "Service temporarily unavailable") -> None:
        super().__init__(
            "SERVICE_UNAVAILABLE",
            message,
            suggestion="Please try again later",
        )


class ErrorFactory:
    """Utility helper to convert API error codes into exceptions."""

    def __init__(self) -> None:  # pragma: no cover - simple initialisation
        self.code_map: Dict[str, Type[ParseratorError]] = {
            "INVALID_INPUT": ValidationError,
            "INVALID_API_KEY": AuthenticationError,
            "RATE_LIMIT_EXCEEDED": RateLimitError,
            "QUOTA_EXCEEDED": QuotaExceededError,
            "NETWORK_ERROR": NetworkError,
            "TIMEOUT": TimeoutError,
            "PARSE_FAILED": ParseFailedError,
            "SERVICE_UNAVAILABLE": ServiceUnavailableError,
        }

    def create_from_code(
        self, code: str, message: str, details: Optional[Dict[str, Any]] = None
    ) -> ParseratorError:
        error_cls = self.code_map.get(code, ParseratorError)
        if error_cls is ParseratorError:
            return ParseratorError(code, message, details)
        if error_cls is TimeoutError:
            timeout = int(details.get("timeout", 0)) if details else 0
            return TimeoutError(timeout)
        if error_cls is RateLimitError:
            retry_after = details.get("retry_after") if details else None
            return RateLimitError(message, retry_after)
        if error_cls is ValidationError:
            return ValidationError(message, details)
        if error_cls is AuthenticationError:
            return AuthenticationError(message)
        if error_cls is QuotaExceededError:
            return QuotaExceededError(message)
        if error_cls is NetworkError:
            return NetworkError(message, details)
        if error_cls is ParseFailedError:
            return ParseFailedError(message, details)
        if error_cls is ServiceUnavailableError:
            return ServiceUnavailableError(message)
        return error_cls(message)  # type: ignore[call-arg]


ERROR_FACTORY = ErrorFactory()


__all__ = [
    "AuthenticationError",
    "ERROR_FACTORY",
    "NetworkError",
    "ParseFailedError",
    "ParseratorError",
    "QuotaExceededError",
    "RateLimitError",
    "ServiceUnavailableError",
    "TimeoutError",
    "ValidationError",
]
