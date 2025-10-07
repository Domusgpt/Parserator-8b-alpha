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
from typing import Any, Dict, FrozenSet, List, Optional, Sequence, Set, Union


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


_UNSET: object = object()


@dataclass(slots=True, init=False)
class ParseOptions:
    """Optional parameters that tweak the parsing behaviour."""

    validation: ValidationType
    locale: Optional[str]
    timezone: Optional[str]
    max_retries: int
    _explicit_fields: FrozenSet[str] = field(default_factory=frozenset, init=False, repr=False)

    def __init__(
        self,
        validation: Union[ValidationType, str, object] = _UNSET,
        *,
        locale: Union[Optional[str], object] = _UNSET,
        timezone: Union[Optional[str], object] = _UNSET,
        max_retries: Union[int, object] = _UNSET,
    ) -> None:
        explicit: Set[str] = set()

        if validation is _UNSET:
            validation_value = ValidationType.STRICT
        else:
            if not isinstance(validation, ValidationType):
                try:
                    validation = ValidationType(str(validation))
                except ValueError as exc:  # pragma: no cover - defensive
                    raise ValueError("Invalid validation mode for ParseOptions.") from exc
            validation_value = validation
            explicit.add("validation")

        if locale is _UNSET:
            locale_value = None
        else:
            if locale is not None and not isinstance(locale, str):
                raise TypeError("ParseOptions.locale must be a string or None.")
            locale_value = locale
            explicit.add("locale")

        if timezone is _UNSET:
            timezone_value = None
        else:
            if timezone is not None and not isinstance(timezone, str):
                raise TypeError("ParseOptions.timezone must be a string or None.")
            timezone_value = timezone
            explicit.add("timezone")

        if max_retries is _UNSET:
            retries_value = 3
        else:
            try:
                retries_value = int(max_retries)
            except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
                raise TypeError("ParseOptions.max_retries must be an integer.") from exc
            if retries_value < 0:
                raise ValueError("ParseOptions.max_retries must be non-negative.")
            explicit.add("max_retries")

        object.__setattr__(self, "validation", validation_value)
        object.__setattr__(self, "locale", locale_value)
        object.__setattr__(self, "timezone", timezone_value)
        object.__setattr__(self, "max_retries", retries_value)
        object.__setattr__(self, "_explicit_fields", frozenset(explicit))

    @property
    def explicit_fields(self) -> FrozenSet[str]:
        """Fields that were explicitly provided when constructing the options."""

        return self._explicit_fields


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

    def __post_init__(self) -> None:
        try:
            parallelism_value = int(self.parallelism)
        except (TypeError, ValueError) as exc:  # pragma: no cover - defensive
            raise TypeError("BatchOptions.parallelism must be an integer.") from exc

        if parallelism_value < 1:
            raise ValueError("BatchOptions.parallelism must be at least 1.")

        object.__setattr__(self, "parallelism", parallelism_value)

        if not isinstance(self.halt_on_error, bool):  # pragma: no cover - defensive
            object.__setattr__(self, "halt_on_error", bool(self.halt_on_error))


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
