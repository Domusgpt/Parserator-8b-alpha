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
from typing import Any, Dict, FrozenSet, Iterable, List, Mapping, Optional, Sequence, Set, Union


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


_LEAN_RUNTIME_FIELDS = (
    "disabled",
    "allow_optional_fields",
    "default_confidence",
    "max_input_characters",
    "plan_confidence_gate",
    "max_invocations_per_parse",
    "max_tokens_per_parse",
)


@dataclass(slots=True, init=False)
class LeanLLMRuntimeOptions:
    """Runtime controls for the lean LLM fallback resolver."""

    disabled: Optional[bool]
    allow_optional_fields: Optional[bool]
    default_confidence: Optional[float]
    max_input_characters: Optional[int]
    plan_confidence_gate: Optional[float]
    max_invocations_per_parse: Optional[int]
    max_tokens_per_parse: Optional[int]
    _explicit_fields: FrozenSet[str] = field(default_factory=frozenset, init=False, repr=False)

    def __init__(
        self,
        *,
        disabled: Union[bool, int, str, None, object] = _UNSET,
        allow_optional_fields: Union[bool, int, str, None, object] = _UNSET,
        default_confidence: Union[float, int, str, None, object] = _UNSET,
        max_input_characters: Union[int, str, None, object] = _UNSET,
        plan_confidence_gate: Union[float, int, str, None, object] = _UNSET,
        max_invocations_per_parse: Union[int, str, None, object] = _UNSET,
        max_tokens_per_parse: Union[int, str, None, object] = _UNSET,
    ) -> None:
        explicit: Set[str] = set()

        if disabled is _UNSET:
            disabled_value: Optional[bool] = None
        else:
            coerced = _coerce_optional_bool(disabled)
            if coerced is None and disabled not in {None, False}:
                raise TypeError("disabled must be a boolean value or None.")
            disabled_value = coerced
            explicit.add("disabled")

        if allow_optional_fields is _UNSET:
            allow_optional_value: Optional[bool] = None
        else:
            coerced = _coerce_optional_bool(allow_optional_fields)
            if coerced is None and allow_optional_fields not in {None, False}:
                raise TypeError("allow_optional_fields must be a boolean value or None.")
            allow_optional_value = coerced
            explicit.add("allow_optional_fields")

        if default_confidence is _UNSET:
            default_confidence_value: Optional[float] = None
        else:
            if default_confidence is None:
                coerced = None
            else:
                coerced = _coerce_optional_float(default_confidence)
                if coerced is None:
                    raise TypeError("default_confidence must be a number between 0 and 1 or None.")
                if coerced < 0 or coerced > 1:
                    raise ValueError("default_confidence must be within [0, 1].")
            default_confidence_value = coerced
            explicit.add("default_confidence")

        if max_input_characters is _UNSET:
            max_input_characters_value: Optional[int] = None
        else:
            if max_input_characters is None:
                coerced = None
            else:
                coerced = _coerce_optional_int(max_input_characters)
                if coerced is None:
                    raise TypeError("max_input_characters must be an integer or None.")
                if coerced < 0:
                    raise ValueError("max_input_characters must be non-negative.")
            max_input_characters_value = coerced
            explicit.add("max_input_characters")

        if plan_confidence_gate is _UNSET:
            plan_confidence_gate_value: Optional[float] = None
        else:
            if plan_confidence_gate is None:
                coerced = None
            else:
                coerced = _coerce_optional_float(plan_confidence_gate)
                if coerced is None:
                    raise TypeError("plan_confidence_gate must be a number between 0 and 1 or None.")
                if coerced < 0 or coerced > 1:
                    raise ValueError("plan_confidence_gate must be within [0, 1].")
            plan_confidence_gate_value = coerced
            explicit.add("plan_confidence_gate")

        if max_invocations_per_parse is _UNSET:
            max_invocations_value: Optional[int] = None
        else:
            if max_invocations_per_parse is None:
                coerced = None
            else:
                coerced = _coerce_optional_int(max_invocations_per_parse)
                if coerced is None:
                    raise TypeError("max_invocations_per_parse must be an integer or None.")
                if coerced < 0:
                    raise ValueError("max_invocations_per_parse must be non-negative.")
            max_invocations_value = coerced
            explicit.add("max_invocations_per_parse")

        if max_tokens_per_parse is _UNSET:
            max_tokens_value: Optional[int] = None
        else:
            if max_tokens_per_parse is None:
                coerced = None
            else:
                coerced = _coerce_optional_int(max_tokens_per_parse)
                if coerced is None:
                    raise TypeError("max_tokens_per_parse must be an integer or None.")
                if coerced < 0:
                    raise ValueError("max_tokens_per_parse must be non-negative.")
            max_tokens_value = coerced
            explicit.add("max_tokens_per_parse")

        object.__setattr__(self, "disabled", disabled_value)
        object.__setattr__(self, "allow_optional_fields", allow_optional_value)
        object.__setattr__(self, "default_confidence", default_confidence_value)
        object.__setattr__(self, "max_input_characters", max_input_characters_value)
        object.__setattr__(self, "plan_confidence_gate", plan_confidence_gate_value)
        object.__setattr__(self, "max_invocations_per_parse", max_invocations_value)
        object.__setattr__(self, "max_tokens_per_parse", max_tokens_value)
        object.__setattr__(self, "_explicit_fields", frozenset(explicit))

    @property
    def explicit_fields(self) -> FrozenSet[str]:
        """Fields explicitly provided when constructing the runtime options."""

        return self._explicit_fields

    def copy(self) -> "LeanLLMRuntimeOptions":
        """Create a shallow copy preserving explicit field tracking."""

        payload: Dict[str, Any] = {}
        for field in _LEAN_RUNTIME_FIELDS:
            value = getattr(self, field)
            if value is not None or field in self._explicit_fields:
                payload[field] = value
        return LeanLLMRuntimeOptions(**payload)

    def to_payload(self) -> Dict[str, Any]:
        """Serialise the runtime options into an API payload."""

        field_map = {
            "disabled": "disabled",
            "allow_optional_fields": "allowOptionalFields",
            "default_confidence": "defaultConfidence",
            "max_input_characters": "maxInputCharacters",
            "plan_confidence_gate": "planConfidenceGate",
            "max_invocations_per_parse": "maxInvocationsPerParse",
            "max_tokens_per_parse": "maxTokensPerParse",
        }

        payload: Dict[str, Any] = {}
        for field, key in field_map.items():
            value = getattr(self, field)
            if value is not None or field in self._explicit_fields:
                payload[key] = value
        return payload


def _coerce_optional_bool(value: Any) -> Optional[bool]:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        text = value.strip().lower()
        if text in {"true", "1", "yes"}:
            return True
        if text in {"false", "0", "no"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return None


def _coerce_optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        result = int(value)
    except (TypeError, ValueError):
        return None
    return result


def _coerce_optional_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result


def _coerce_string_list(value: Any) -> Optional[List[str]]:
    if value is None:
        return None
    if isinstance(value, str):
        return [value]
    if isinstance(value, Iterable):
        result: List[str] = []
        for item in value:
            if isinstance(item, str):
                result.append(item)
        return result if result else None
    return None


def _to_optional_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value
    return str(value)


def _merge_lean_runtime_options(
    base: Optional["LeanLLMRuntimeOptions"],
    override: Optional["LeanLLMRuntimeOptions"],
) -> Optional["LeanLLMRuntimeOptions"]:
    if override is None:
        return None
    if base is None:
        return override.copy()
    if not override.explicit_fields:
        return base

    merged: Dict[str, Any] = {
        field: getattr(base, field)
        for field in _LEAN_RUNTIME_FIELDS
    }

    for field in override.explicit_fields:
        merged[field] = getattr(override, field)

    return LeanLLMRuntimeOptions(**merged)


def _coerce_lean_runtime_options(
    value: Union["LeanLLMRuntimeOptions", Mapping[str, Any], None]
) -> Optional["LeanLLMRuntimeOptions"]:
    if value is None:
        return None
    if isinstance(value, LeanLLMRuntimeOptions):
        return value
    if isinstance(value, Mapping):
        normalised: Dict[str, Any] = {}
        for key, entry in value.items():
            if key in {"disabled", "allow_optional_fields", "default_confidence",
                       "max_input_characters", "plan_confidence_gate",
                       "max_invocations_per_parse", "max_tokens_per_parse"}:
                normalised[key] = entry
            else:
                camel_map = {
                    "allowOptionalFields": "allow_optional_fields",
                    "defaultConfidence": "default_confidence",
                    "maxInputCharacters": "max_input_characters",
                    "planConfidenceGate": "plan_confidence_gate",
                    "maxInvocationsPerParse": "max_invocations_per_parse",
                    "maxTokensPerParse": "max_tokens_per_parse",
                }
                if key in camel_map:
                    normalised[camel_map[key]] = entry
        return LeanLLMRuntimeOptions(**normalised)
    raise TypeError("Lean LLM runtime options must be a mapping or LeanLLMRuntimeOptions instance.")


def _lean_runtime_payload(
    options: Optional["LeanLLMRuntimeOptions"],
) -> Optional[Dict[str, Any]]:
    if options is None:
        return None
    payload = options.to_payload()
    return payload if payload else None


@dataclass(slots=True, init=False)
class ParseOptions:
    """Optional parameters that tweak the parsing behaviour."""

    validation: ValidationType
    locale: Optional[str]
    timezone: Optional[str]
    max_retries: int
    lean_llm: Optional[LeanLLMRuntimeOptions]
    _explicit_fields: FrozenSet[str] = field(default_factory=frozenset, init=False, repr=False)

    def __init__(
        self,
        validation: Union[ValidationType, str, object] = _UNSET,
        *,
        locale: Union[Optional[str], object] = _UNSET,
        timezone: Union[Optional[str], object] = _UNSET,
        max_retries: Union[int, object] = _UNSET,
        lean_llm: Union[Optional[LeanLLMRuntimeOptions], Mapping[str, Any], object] = _UNSET,
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

        if lean_llm is _UNSET:
            lean_value = None
        else:
            lean_value = _coerce_lean_runtime_options(lean_llm)
            explicit.add("lean_llm")

        object.__setattr__(self, "validation", validation_value)
        object.__setattr__(self, "locale", locale_value)
        object.__setattr__(self, "timezone", timezone_value)
        object.__setattr__(self, "max_retries", retries_value)
        object.__setattr__(self, "lean_llm", lean_value)
        object.__setattr__(self, "_explicit_fields", frozenset(explicit))

    @property
    def explicit_fields(self) -> FrozenSet[str]:
        """Fields that were explicitly provided when constructing the options."""

        return self._explicit_fields


@dataclass(slots=True)
class LeanLLMFallbackFieldUsage:
    """Per-field record of lean LLM fallback activity."""

    field: str
    action: str
    resolved: Optional[bool] = None
    confidence: Optional[float] = None
    tokens_used: Optional[int] = None
    reason: Optional[str] = None
    source_field: Optional[str] = None
    shared_keys: Optional[List[str]] = None
    planner_confidence: Optional[float] = None
    gate: Optional[float] = None
    error: Optional[str] = None
    limit_type: Optional[str] = None
    limit: Optional[int] = None
    current_invocations: Optional[int] = None
    current_tokens: Optional[int] = None
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)


@dataclass(slots=True)
class LeanLLMFallbackUsageSummary:
    """Aggregate lean LLM fallback metrics for a parse."""

    total_invocations: int = 0
    resolved_fields: int = 0
    reused_resolutions: int = 0
    skipped_by_plan_confidence: int = 0
    skipped_by_limits: int = 0
    shared_extractions: int = 0
    total_tokens: int = 0
    plan_confidence_gate: Optional[float] = None
    max_invocations_per_parse: Optional[int] = None
    max_tokens_per_parse: Optional[int] = None
    fields: List[LeanLLMFallbackFieldUsage] = field(default_factory=list)
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)


@dataclass(slots=True)
class ParserFallbackSummary:
    """Wrapper for fallback usage across resolver strategies."""

    lean_llm: Optional[LeanLLMFallbackUsageSummary] = None
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)


@dataclass(slots=True)
class ParseMetadata:
    """Metadata describing how a parse request was processed."""

    confidence: float = 0.0
    processing_time_ms: int = 0
    request_id: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)
    fallback: Optional[ParserFallbackSummary] = None


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
