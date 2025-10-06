"""Core type definitions for the Parserator Python SDK.

These light-weight data containers intentionally avoid any heavy runtime
behaviour so they can be imported in environments where the optional
integration dependencies may not be installed.  The real HTTP client in the
SDK populates the fields defined here when communicating with the Parserator
API.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Sequence


class ValidationType(str, Enum):
    """Supported validation strategies for parse responses."""

    STRICT = "strict"
    LENIENT = "lenient"


class ErrorCode(str, Enum):
    """High level error codes returned by the Parserator API."""

    VALIDATION_ERROR = "validation_error"
    AUTHENTICATION_ERROR = "authentication_error"
    RATE_LIMITED = "rate_limited"
    SERVER_ERROR = "server_error"
    NETWORK_ERROR = "network_error"


@dataclass(slots=True)
class ParseOptions:
    """Optional parameters that tweak the parsing behaviour."""

    validation: ValidationType = ValidationType.STRICT
    locale: Optional[str] = None
    timezone: Optional[str] = None
    max_retries: int = 3


@dataclass(slots=True)
class ParseMetadata:
    """Metadata describing how a parse request was processed."""

    confidence: float = 0.0
    processing_time_ms: int = 0
    request_id: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ParseError:
    """Represents an error returned by the Parserator API."""

    code: ErrorCode
    message: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ParseratorConfig:
    """Configuration data associated with a :class:`ParseratorClient`."""

    api_key: str
    base_url: str = "https://api.parserator.com"
    timeout: float = 30.0
    organization_id: Optional[str] = None


@dataclass(slots=True)
class ParseRequest:
    """Payload submitted to the Parserator parsing endpoint."""

    input_data: str
    output_schema: Dict[str, Any]
    instructions: Optional[str] = None
    options: Optional[ParseOptions] = None


@dataclass(slots=True)
class ParseResponse:
    """Structured response returned after a parsing operation."""

    success: bool
    parsed_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    metadata: ParseMetadata = field(default_factory=ParseMetadata)
    error: Optional[ParseError] = None


# Historically the integrations used ``ParseResult`` as the return type name.
# Alias the dataclass to maintain backwards compatibility with that API.
ParseResult = ParseResponse


@dataclass(slots=True)
class BatchParseRequest:
    """Collection of parse requests submitted as a batch."""

    requests: Sequence[ParseRequest]


@dataclass(slots=True)
class BatchOptions:
    """Batch specific tuning parameters."""

    parallelism: int = 4
    halt_on_error: bool = False


@dataclass(slots=True)
class BatchParseResponse:
    """Response payload returned from a batch parse operation."""

    results: List[ParseResponse]
    failed: List[ParseError] = field(default_factory=list)


@dataclass(slots=True)
class SearchStep:
    """Represents an individual step inside a search plan."""

    description: str
    schema: Dict[str, Any]


@dataclass(slots=True)
class SearchPlan:
    """Plan describing how to iteratively extract structured data."""

    name: str
    steps: Sequence[SearchStep]


@dataclass(slots=True)
class SchemaValidationResult:
    """Outcome of validating an output schema before parsing."""

    valid: bool
    errors: List[str] = field(default_factory=list)


@dataclass(slots=True)
class ParsePreset:
    """Named preset that bundles a schema with usage instructions."""

    name: str
    description: str
    schema: Dict[str, Any]


__all__ = [
    "ValidationType",
    "ErrorCode",
    "ParseOptions",
    "ParseMetadata",
    "ParseError",
    "ParseratorConfig",
    "ParseRequest",
    "ParseResponse",
    "ParseResult",
    "BatchParseRequest",
    "BatchOptions",
    "BatchParseResponse",
    "SearchStep",
    "SearchPlan",
    "SchemaValidationResult",
    "ParsePreset",
]
