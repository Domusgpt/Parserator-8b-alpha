"""HTTP client for interacting with the Parserator API."""
from __future__ import annotations

import json
import socket
from dataclasses import replace
from typing import Any, Dict, Iterable, Mapping, MutableMapping, Optional, Sequence, Tuple
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
    ParseError,
    ParseMetadata,
    ParseOptions,
    ParseRequest,
    ParseResponse,
    ParseResult,
    ParseratorConfig,
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
        requests: Sequence[ParseRequest] | BatchParseRequest,
        *,
        options: Optional[BatchOptions] = None,
    ) -> BatchParseResponse:
        """Sequentially parse multiple requests."""

        request_items = self._coerce_batch_requests(requests)
        results: list[ParseResponse] = []
        failures: list[ParseError] = []

        for request in request_items:
            try:
                results.append(self.parse_request(request))
            except ParseratorError as exc:
                error_code = _error_code_for_exception(exc)
                parse_error = ParseError(
                    code=error_code,
                    message=str(exc),
                    details={"request": request.output_schema},
                )
                failures.append(parse_error)
                results.append(
                    ParseResponse(
                        success=False,
                        error_message=str(exc),
                        metadata=ParseMetadata(
                            request_id=getattr(exc, "request_id", None),
                            raw={"status": "failed"},
                        ),
                        error=parse_error,
                    )
                )

                if options and options.halt_on_error:
                    break

        if options and options.halt_on_error and failures:
            raise ParseFailedError(
                "Batch parse halted after encountering an error.",
                request_id=failures[-1].details.get("requestId") if failures else None,
            )

        return BatchParseResponse(results=results, failed=failures)

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
        return payload

    def _merge_options(self, override: Optional[ParseOptions]) -> Optional[ParseOptions]:
        if override is None:
            return self._default_options
        if self._default_options is None:
            return override
        if not override.explicit_fields:
            return self._default_options

        updates = {field: getattr(override, field) for field in override.explicit_fields}
        return replace(self._default_options, **updates)

    def _build_parse_response(
        self, data: MutableMapping[str, Any], headers: Mapping[str, str]
    ) -> ParseResponse:
        metadata_dict = _ensure_mapping(data.get("metadata"))
        request_id = headers.get("x-request-id") or metadata_dict.get("requestId")
        metadata = ParseMetadata(
            confidence=float(metadata_dict.get("confidence", 0.0) or 0.0),
            processing_time_ms=int(metadata_dict.get("processingTimeMs", 0) or 0),
            request_id=request_id if isinstance(request_id, str) else None,
            raw=dict(metadata_dict),
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
        self, requests: Sequence[ParseRequest] | BatchParseRequest
    ) -> Iterable[ParseRequest]:
        if isinstance(requests, BatchParseRequest):
            return list(requests.requests)
        return list(requests)


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
