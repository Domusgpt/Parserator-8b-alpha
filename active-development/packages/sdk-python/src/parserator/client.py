"""Asynchronous HTTP client for interacting with the Parserator API."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Dict, Mapping, MutableMapping, Optional, Union

import httpx
from pydantic import ValidationError as PydanticValidationError

from .errors import (
    AuthenticationError,
    NetworkError,
    ParseFailedError,
    ParseratorError,
    RateLimitError,
    ServiceUnavailableError,
    TimeoutError,
    ValidationError,
)
from .services import RateLimiter, async_retry
from .types import (
    EventHandler,
    ParseError,
    ParseEvent,
    ParseOptions,
    ParseRequest,
    ParseResponse,
    RetryConfig,
    validate_config,
    validate_parse_request,
)
from .types import get_validation_error_message
from .utils import validate_api_key, validate_input_data, validate_schema

Headers = MutableMapping[str, str]


class ParseratorClient:
    """High level API client that mirrors the Node.js SDK."""

    USER_AGENT = "Parserator Python SDK v1.0.0"

    def __init__(
        self,
        api_key: str,
        *,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None,
        retries: Optional[int] = None,
        default_options: Optional[Union[ParseOptions, Mapping[str, Any]]] = None,
        debug: bool = False,
        rate_limit_per_second: float = 10.0,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        config_input: Dict[str, Any] = {
            "apiKey": api_key,
            "baseUrl": base_url,
            "timeout": timeout,
            "retries": retries,
            "defaultOptions": default_options,
            "debug": debug,
        }

        try:
            config = validate_config({k: v for k, v in config_input.items() if v is not None})
        except PydanticValidationError as exc:  # pragma: no cover - defensive programming
            message = get_validation_error_message(exc)
            raise ValidationError(message, {"errors": exc.errors()}) from exc

        self._config = config
        self._config.api_key = validate_api_key(self._config.api_key)
        self._timeout_ms = self._config.timeout
        self._debug = debug

        default_headers: Headers = {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
            "User-Agent": self.USER_AGENT,
        }

        timeout_seconds = self._timeout_ms / 1000.0
        self._client = httpx.AsyncClient(
            base_url=self._config.base_url,
            timeout=timeout_seconds,
            headers=default_headers,
            transport=transport,
        )
        self._closed = False

        self._rate_limiter = RateLimiter(rate_limit_per_second)
        self._retry_config = RetryConfig(
            maxRetries=self._config.retries,
            baseDelay=1.0,
            maxDelay=10.0,
            backoffFactor=2.0,
        )

        self._event_handlers: list[EventHandler] = []

    async def __aenter__(self) -> "ParseratorClient":
        return self

    async def __aexit__(self, *exc_info: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        """Close the underlying HTTP client."""

        if not self._closed:
            await self._client.aclose()
            self._closed = True

    async def parse(
        self,
        request: Optional[Union[ParseRequest, Mapping[str, Any]]] = None,
        **kwargs: Any,
    ) -> ParseResponse:
        """Parse unstructured data into structured JSON."""

        payload_dict: Mapping[str, Any]
        if request is not None and kwargs:
            raise ValidationError("Provide either a request object or keyword arguments, not both")
        if request is None:
            payload_dict = kwargs
        else:
            payload_dict = request if isinstance(request, Mapping) else request.model_dump()

        if "input_data" in payload_dict or kwargs.get("input_data") is not None:
            validate_input_data(kwargs.get("input_data", payload_dict.get("input_data")))
        if "output_schema" in payload_dict or kwargs.get("output_schema") is not None:
            schema_candidate = kwargs.get("output_schema", payload_dict.get("output_schema"))
            schema_result = validate_schema(schema_candidate)
            if not schema_result.valid:
                raise ValidationError(
                    "Schema validation failed",
                    {
                        "errors": [error.model_dump() for error in schema_result.errors],
                        "suggestions": schema_result.suggestions,
                    },
                )

        try:
            parse_request = validate_parse_request(payload_dict)
        except PydanticValidationError as exc:
            message = get_validation_error_message(exc)
            raise ValidationError(message, {"errors": exc.errors()}) from exc

        final_request = self._merge_options(parse_request)

        await self._rate_limiter.acquire()
        self._emit_event(
            "start",
            {
                "requestSize": len(parse_request.input_data),
            },
        )

        async def _send() -> httpx.Response:
            response = await self._client.post("/v1/parse", json=final_request)
            if response.status_code == 429 or response.status_code >= 500:
                response.raise_for_status()
            return response

        async def _request() -> ParseResponse:
            try:
                response = await async_retry(_send, self._retry_config, self._should_retry)
            except httpx.TimeoutException as exc:
                raise TimeoutError(self._timeout_ms) from exc
            except httpx.RequestError as exc:
                raise NetworkError(str(exc)) from exc
            except httpx.HTTPStatusError as exc:
                error = self._handle_http_error(exc.response)
                raise error from exc

            if response.status_code >= 400:
                error = self._handle_http_error(response)
                raise error

            try:
                payload = response.json()
            except ValueError as exc:
                raise ParseratorError("INTERNAL_ERROR", "Invalid JSON response", {"body": response.text}) from exc

            try:
                result = ParseResponse.model_validate(payload)
            except PydanticValidationError as exc:
                raise ParseratorError(
                    "INTERNAL_ERROR",
                    get_validation_error_message(exc),
                    {"payload": payload, "errors": exc.errors()},
                ) from exc

            self._emit_event(
                "complete",
                {
                    "success": result.success,
                    "tokensUsed": result.metadata.tokens_used,
                    "processingTime": result.metadata.processing_time_ms,
                },
            )

            if not result.success:
                error_model = result.error or ParseError.model_validate(
                    {"code": "PARSE_FAILED", "message": "Parse operation failed"}
                )
                raise ParseFailedError(error_model.message, error_model.details)

            return result

        return await _request()

    def add_event_listener(self, handler: EventHandler) -> None:
        """Register an event handler for parse lifecycle events."""

        self._event_handlers.append(handler)

    def remove_event_listener(self, handler: EventHandler) -> None:
        """Remove a previously registered event handler."""

        if handler in self._event_handlers:
            self._event_handlers.remove(handler)

    def _merge_options(self, parse_request: ParseRequest) -> Dict[str, Any]:
        default_options = self._config.default_options
        request_options = parse_request.options

        merged: Dict[str, Any] = {}
        if default_options is not None:
            merged.update(default_options.model_dump(by_alias=True, exclude_none=True))
        if request_options is not None:
            merged.update(request_options.model_dump(by_alias=True, exclude_none=True))

        request_payload = parse_request.model_dump(by_alias=True, exclude_none=True)
        if merged:
            request_payload["options"] = merged
        return request_payload

    def _should_retry(self, exc: Exception, attempt: int) -> bool:
        if isinstance(exc, httpx.TimeoutException):
            return True
        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            return status == 429 or status >= 500
        if isinstance(exc, httpx.RequestError):
            return True
        if isinstance(exc, ParseratorError):
            return exc.code in {"RATE_LIMIT_EXCEEDED", "SERVICE_UNAVAILABLE", "NETWORK_ERROR", "TIMEOUT"}
        return False

    def _handle_http_error(self, response: httpx.Response) -> ParseratorError:
        status = response.status_code
        try:
            data = response.json()
        except ValueError:
            data = {"message": response.text, "code": "INTERNAL_ERROR"}

        details = {"status": status, "response": data}

        if status == 401:
            return AuthenticationError()
        if status == 403:
            return ParseratorError("QUOTA_EXCEEDED", data.get("message", "Quota exceeded"), details)
        if status == 429:
            retry_after_header = response.headers.get("retry-after")
            retry_after = float(retry_after_header) if retry_after_header else None
            return RateLimitError(data.get("message", "Rate limit exceeded"), retry_after)
        if status in {500, 502, 503, 504}:
            return ServiceUnavailableError(data.get("message", "Service temporarily unavailable"))
        if status == 400:
            return ValidationError(data.get("message", "Invalid request"), details)

        code = data.get("code", "INTERNAL_ERROR")
        return ParseratorError(code, data.get("message", "An unexpected error occurred"), details)

    def _emit_event(self, event_type: str, data: Dict[str, Any]) -> None:
        event = ParseEvent(type=event_type, timestamp=datetime.now(UTC).isoformat(), data=data)
        for handler in list(self._event_handlers):
            try:
                handler(event)
            except Exception:  # pragma: no cover - defensive logging path
                if self._debug:
                    print("Error in event handler", flush=True)


__all__ = ["ParseratorClient"]
