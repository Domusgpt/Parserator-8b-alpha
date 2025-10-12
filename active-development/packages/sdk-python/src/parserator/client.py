"""HTTP client for interacting with the Parserator API."""
from __future__ import annotations

import json
import os
import socket
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import replace
from typing import (
    Any,
    Dict,
    Iterable,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Tuple,
    Union,
)
from urllib import error as urlerror
from urllib import parse as urlparse
from urllib import request as urlrequest

from .errors import (
    AuthenticationError,
    NetworkError,
    ParseFailedError,
    ParseratorError,
    QuotaExceededError,
    RateLimitError,
    ServiceUnavailableError,
    TimeoutError,
    ValidationError,
)
from .types import (
    BatchOptions,
    BatchParseRequest,
    BatchParseResponse,
    ErrorCode,
    LeanLLMFallbackFieldUsage,
    LeanLLMFallbackUsageSummary,
    ParseError,
    ParseMetadata,
    ParseOptions,
    ParseRequest,
    ParseResponse,
    ParseResult,
    ParserFallbackSummary,
    ParseratorConfig,
    _merge_lean_runtime_options,
    _coerce_optional_bool,
    _coerce_optional_float,
    _coerce_optional_int,
    _coerce_string_list,
    _to_optional_string,
)
from .utils import validate_api_key, validate_input_data, validate_schema

_DEFAULT_BASE_URL = "https://api.parserator.com"
_USER_AGENT = "parserator-python-sdk/1.0.0"


class ParseratorClient:
    """Synchronous client for the Parserator REST API."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: Optional[str] = None,
        timeout: float = 30.0,
        organization_id: Optional[str] = None,
        default_options: Optional[ParseOptions] = None,
    ) -> None:
        validate_api_key(api_key)
        self.config = ParseratorConfig(
            api_key=api_key,
            base_url=base_url or _DEFAULT_BASE_URL,
            timeout=timeout,
            organization_id=organization_id,
        )
        self._default_options = default_options
        self._headers = self._build_headers()

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
        """Parse a single payload."""

        request = ParseRequest(
            input_data=input_data,
            output_schema=output_schema,
            instructions=instructions,
            options=options,
        )
        return self.parse_request(request)

    def parse_request(self, request: ParseRequest) -> ParseResult:
        """Parse using a pre-constructed :class:`ParseRequest`."""

        validate_input_data(request.input_data)
        validate_schema(request.output_schema)

        payload = self._build_parse_payload(request)
        status, body, headers = self._request("POST", "/v1/parse", payload)
        data = self._decode_json_bytes(body)
        response = self._build_parse_response(data, headers)
        if not response.success and response.error is None:
            raise ParseFailedError(
                response.error_message or "Parserator request failed.",
                request_id=response.metadata.request_id,
            )
        return response

    def batch_parse(
        self,
        requests: Union[Sequence[ParseRequest], BatchParseRequest],
        *,
        options: Optional[BatchOptions] = None,
    ) -> BatchParseResponse:
        """Parse multiple requests, optionally in parallel."""

        request_items = list(self._coerce_batch_requests(requests))
        if not request_items:
            return BatchParseResponse(results=[], failed=[])

        if options and options.halt_on_error:
            return self._batch_parse_sequential(request_items, options)

        parallelism = options.parallelism if options else 4
        parallelism = max(1, min(parallelism, len(request_items)))

        results: List[Optional[ParseResponse]] = [None] * len(request_items)
        failure_map: Dict[int, ParseError] = {}

        def _execute(index: int, request: ParseRequest) -> Tuple[int, ParseResponse, Optional[ParseError]]:
            try:
                response = self.parse_request(request)
                return index, response, None
            except ParseratorError as exc:
                failure_response, parse_error = self._build_failure_result(request, exc)
                return index, failure_response, parse_error
            except Exception as exc:  # pragma: no cover - defensive
                wrapped = ParseratorError(str(exc))
                failure_response, parse_error = self._build_failure_result(request, wrapped)
                return index, failure_response, parse_error

        with ThreadPoolExecutor(max_workers=parallelism) as executor:
            futures = [executor.submit(_execute, idx, req) for idx, req in enumerate(request_items)]
            for future in as_completed(futures):
                index, response, failure = future.result()
                results[index] = response
                if failure:
                    failure_map[index] = failure

        ordered_results = [response for response in results if response is not None]
        failures = [failure_map[idx] for idx in sorted(failure_map)]
        return BatchParseResponse(results=ordered_results, failed=failures)

    def health_check(self) -> bool:
        """Ping the API health endpoint."""

        self._request("GET", "/health", None)
        return True

    def close(self) -> None:  # pragma: no cover - maintained for API parity
        """Provided for compatibility with context manager usage."""

    def __enter__(self) -> "ParseratorClient":  # pragma: no cover - convenience
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - convenience
        self.close()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _request(
        self,
        method: str,
        path: str,
        payload: Optional[Mapping[str, Any]],
    ) -> Tuple[int, bytes, Dict[str, str]]:
        url = urlparse.urljoin(self._base_url_prefix(), path.lstrip("/"))
        data_bytes = None
        if payload is not None:
            data_bytes = json.dumps(payload).encode("utf-8")

        req = urlrequest.Request(url, data=data_bytes, method=method.upper())
        for key, value in self._headers.items():
            req.add_header(key, value)
        if data_bytes is not None:
            req.add_header("Content-Type", "application/json")

        try:
            with urlrequest.urlopen(req, timeout=self.config.timeout) as response:
                body = response.read()
                status = response.getcode()
                headers = dict(response.headers.items())
                if status >= 400:
                    self._raise_api_error(status, body, headers)
                return status, body, headers
        except urlerror.HTTPError as exc:
            body = exc.read()
            headers = dict(exc.headers.items()) if exc.headers else {}
            self._raise_api_error(exc.code, body, headers)
        except socket.timeout as exc:
            raise TimeoutError("Parserator request timed out.") from exc
        except urlerror.URLError as exc:
            raise NetworkError("Network error while contacting the Parserator API.") from exc

        raise ParseratorError("Unexpected response from the Parserator API.")

    def _build_headers(self) -> Dict[str, str]:
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "User-Agent": _USER_AGENT,
            "Accept": "application/json",
        }
        if self.config.organization_id:
            headers["X-Organization-Id"] = self.config.organization_id
        return headers

    def _base_url_prefix(self) -> str:
        base = self.config.base_url.rstrip("/")
        return f"{base}/"

    def _build_parse_payload(self, request: ParseRequest) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "inputData": request.input_data,
            "outputSchema": request.output_schema,
        }
        if request.instructions:
            payload["instructions"] = request.instructions

        options_payload = self._resolve_options(request.options)
        if options_payload:
            payload["options"] = options_payload
        return payload

    def _resolve_options(self, override: Optional[ParseOptions]) -> Dict[str, Any]:
        merged = self._merge_options(override)
        if merged is None:
            return {}

        payload: Dict[str, Any] = {
            "validation": merged.validation.value,
            "maxRetries": merged.max_retries,
        }
        if merged.locale:
            payload["locale"] = merged.locale
        if merged.timezone:
            payload["timezone"] = merged.timezone
        if merged.lean_llm is not None:
            lean_payload = merged.lean_llm.to_payload()
            if lean_payload:
                payload["leanLLM"] = lean_payload
        elif "lean_llm" in merged.explicit_fields:
            payload["leanLLM"] = None
        return payload

    def _merge_options(self, override: Optional[ParseOptions]) -> Optional[ParseOptions]:
        if override is None:
            return self._default_options
        if self._default_options is None:
            return override
        if not override.explicit_fields:
            return self._default_options

        updates = {field: getattr(override, field) for field in override.explicit_fields}
        if "lean_llm" in updates:
            updates["lean_llm"] = _merge_lean_runtime_options(
                self._default_options.lean_llm,
                updates["lean_llm"],
            )
        return replace(self._default_options, **updates)

    def _build_parse_response(
        self, data: MutableMapping[str, Any], headers: Mapping[str, str]
    ) -> ParseResponse:
        metadata_dict = _ensure_mapping(data.get("metadata"))
        request_id = headers.get("x-request-id") or metadata_dict.get("requestId")
        fallback_payload = _ensure_mapping(metadata_dict.get("fallback"))
        fallback_summary = _parse_fallback_summary(fallback_payload)

        metadata = ParseMetadata(
            confidence=float(metadata_dict.get("confidence", 0.0) or 0.0),
            processing_time_ms=int(metadata_dict.get("processingTimeMs", 0) or 0),
            request_id=request_id if isinstance(request_id, str) else None,
            raw=dict(metadata_dict),
            fallback=fallback_summary,
        )

        error_payload = _ensure_mapping(data.get("error"))
        parse_error = _parse_error_payload(error_payload) if error_payload else None

        parsed_data = data.get("parsedData")
        if not isinstance(parsed_data, Mapping):
            parsed_data = None

        error_message = data.get("errorMessage")
        if not isinstance(error_message, str) and parse_error:
            error_message = parse_error.message

        success = bool(data.get("success", False))
        return ParseResponse(
            success=success,
            parsed_data=dict(parsed_data) if parsed_data else None,
            error_message=error_message,
            metadata=metadata,
            error=parse_error,
        )

    def _raise_api_error(self, status: int, body: bytes, headers: Mapping[str, str]) -> None:
        data = self._decode_json_bytes(body)
        message, details = self._extract_error_message(data)
        request_id = headers.get("x-request-id")

        if status in {400, 409, 422}:
            raise ValidationError(message, request_id=request_id)
        if status in {401, 403}:
            raise AuthenticationError(message, request_id=request_id)
        if status == 402:
            raise QuotaExceededError(message, request_id=request_id)
        if status == 429:
            raise RateLimitError(message, request_id=request_id)
        if status in {500, 502, 503, 504}:
            raise ServiceUnavailableError(message, request_id=request_id)

        if details.get("success") is False:
            raise ParseFailedError(message, request_id=request_id)
        raise ParseratorError(message, request_id=request_id)

    def _decode_json_bytes(self, payload: Optional[bytes]) -> MutableMapping[str, Any]:
        if not payload:
            return {}
        try:
            data = json.loads(payload.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}
        if isinstance(data, MutableMapping):
            return data
        if isinstance(data, Mapping):
            return dict(data)
        return {}

    def _extract_error_message(self, data: Mapping[str, Any]) -> Tuple[str, Mapping[str, Any]]:
        error = _ensure_mapping(data.get("error"))
        message = "Parserator API returned an error."
        if error:
            message = _coerce_message(error.get("message")) or message
        elif "message" in data:
            message = _coerce_message(data.get("message")) or message
        return message, error or data

    def _coerce_batch_requests(
        self, requests: Union[Sequence[ParseRequest], BatchParseRequest]
    ) -> Iterable[ParseRequest]:
        if isinstance(requests, BatchParseRequest):
            return list(requests.requests)
        return list(requests)

    def _batch_parse_sequential(
        self, requests: Sequence[ParseRequest], options: BatchOptions
    ) -> BatchParseResponse:
        results: List[ParseResponse] = []
        failures: List[ParseError] = []

        for request in requests:
            try:
                results.append(self.parse_request(request))
            except ParseratorError as exc:
                failure_response, parse_error = self._build_failure_result(request, exc)
                failures.append(parse_error)
                results.append(failure_response)
                if options.halt_on_error:
                    break

        if options.halt_on_error and failures:
            raise ParseFailedError(
                "Batch parse halted after encountering an error.",
                request_id=failures[-1].details.get("requestId") if failures else None,
            )

        return BatchParseResponse(results=results, failed=failures)

    def _build_failure_result(
        self, request: ParseRequest, exc: ParseratorError
    ) -> Tuple[ParseResponse, ParseError]:
        error_code = _error_code_for_exception(exc)
        parse_error = ParseError(
            code=error_code,
            message=str(exc),
            details={"request": request.output_schema},
        )
        response = ParseResponse(
            success=False,
            error_message=str(exc),
            metadata=ParseMetadata(
                request_id=getattr(exc, "request_id", None),
                raw={"status": "failed"},
            ),
            error=parse_error,
        )
        return response, parse_error

    # ------------------------------------------------------------------
    # Alternate constructors
    # ------------------------------------------------------------------
    @classmethod
    def from_env(
        cls,
        *,
        env_var: str = "PARSERATOR_API_KEY",
        **kwargs: Any,
    ) -> "ParseratorClient":
        """Create a client from an environment variable containing the API key."""

        api_key = os.getenv(env_var)
        if not api_key:
            raise ValueError(
                f"Environment variable '{env_var}' must be set to a Parserator API key."
            )
        return cls(api_key=api_key, **kwargs)


def _parse_fallback_summary(payload: Mapping[str, Any]) -> Optional[ParserFallbackSummary]:
    if not payload:
        return None

    lean_payload = _ensure_mapping(payload.get("leanLLM") or payload.get("lean_llm"))
    lean_summary = _parse_lean_llm_summary(lean_payload) if lean_payload else None

    summary = ParserFallbackSummary(lean_llm=lean_summary, raw=dict(payload))
    if summary.lean_llm is None and not summary.raw:
        return None
    return summary


def _parse_lean_llm_summary(
    payload: Mapping[str, Any]
) -> Optional[LeanLLMFallbackUsageSummary]:
    if not payload:
        return None

    summary = LeanLLMFallbackUsageSummary(
        total_invocations=_coerce_optional_int(payload.get("totalInvocations")) or 0,
        resolved_fields=_coerce_optional_int(payload.get("resolvedFields")) or 0,
        reused_resolutions=_coerce_optional_int(payload.get("reusedResolutions")) or 0,
        skipped_by_plan_confidence=_coerce_optional_int(payload.get("skippedByPlanConfidence"))
        or 0,
        skipped_by_limits=_coerce_optional_int(payload.get("skippedByLimits")) or 0,
        shared_extractions=_coerce_optional_int(payload.get("sharedExtractions")) or 0,
        total_tokens=_coerce_optional_int(payload.get("totalTokens")) or 0,
        plan_confidence_gate=_coerce_optional_float(payload.get("planConfidenceGate")),
        max_invocations_per_parse=_coerce_optional_int(payload.get("maxInvocationsPerParse")),
        max_tokens_per_parse=_coerce_optional_int(payload.get("maxTokensPerParse")),
        raw=dict(payload),
    )

    fields_payload = payload.get("fields")
    if isinstance(fields_payload, Iterable):
        entries: List[LeanLLMFallbackFieldUsage] = []
        for entry in fields_payload:
            usage = _parse_lean_llm_field_usage(entry)
            if usage:
                entries.append(usage)
        summary.fields = entries

    return summary


def _parse_lean_llm_field_usage(value: Any) -> Optional[LeanLLMFallbackFieldUsage]:
    mapping = _ensure_mapping(value)
    field = mapping.get("field")
    action = mapping.get("action")
    if not isinstance(field, str) or not isinstance(action, str):
        return None

    usage = LeanLLMFallbackFieldUsage(
        field=field,
        action=action,
        resolved=_coerce_optional_bool(mapping.get("resolved")),
        confidence=_coerce_optional_float(mapping.get("confidence")),
        tokens_used=_coerce_optional_int(mapping.get("tokensUsed")),
        reason=_to_optional_string(mapping.get("reason")),
        source_field=_to_optional_string(mapping.get("sourceField"))
        if mapping.get("sourceField") is not None
        else None,
        shared_keys=_coerce_string_list(mapping.get("sharedKeys")),
        planner_confidence=_coerce_optional_float(mapping.get("plannerConfidence")),
        gate=_coerce_optional_float(mapping.get("gate")),
        error=_to_optional_string(mapping.get("error")),
        limit_type=_to_optional_string(mapping.get("limitType")),
        limit=_coerce_optional_int(mapping.get("limit")),
        current_invocations=_coerce_optional_int(mapping.get("currentInvocations")),
        current_tokens=_coerce_optional_int(mapping.get("currentTokens")),
        raw=dict(mapping),
    )

    return usage


def _parse_error_payload(payload: Mapping[str, Any]) -> ParseError:
    code_value = payload.get("code", ErrorCode.SERVER_ERROR.value)
    try:
        code = ErrorCode(code_value)
    except ValueError:
        code = ErrorCode.SERVER_ERROR
    message = _coerce_message(payload.get("message")) or "Parserator request failed."
    details = payload.get("details")
    if not isinstance(details, Mapping):
        details = {"details": details} if details is not None else {}
    return ParseError(code=code, message=message, details=dict(details))


def _ensure_mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, MutableMapping):
        return value
    if isinstance(value, Mapping):
        return dict(value)
    return {}


def _coerce_message(value: Any) -> Optional[str]:
    if isinstance(value, str):
        return value
    if value is None:
        return None
    return str(value)


def _error_code_for_exception(exc: ParseratorError) -> ErrorCode:
    if isinstance(exc, ValidationError):
        return ErrorCode.VALIDATION_ERROR
    if isinstance(exc, AuthenticationError):
        return ErrorCode.AUTHENTICATION_ERROR
    if isinstance(exc, RateLimitError):
        return ErrorCode.RATE_LIMITED
    if isinstance(exc, QuotaExceededError):
        return ErrorCode.RATE_LIMITED
    if isinstance(exc, NetworkError):
        return ErrorCode.NETWORK_ERROR
    return ErrorCode.SERVER_ERROR


__all__ = ["ParseratorClient"]
