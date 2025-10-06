"""Unit tests for Parserator framework integrations.

These tests provide lightweight stubs for optional third-party dependencies
and ensure the integration helpers synchronously execute the async SDK client.
"""

from __future__ import annotations

import json
import sys
import types
from pathlib import Path
from typing import Any, Dict
from unittest.mock import AsyncMock

import pytest


@pytest.fixture(scope="module", autouse=True)
def add_sdk_src_to_path():
    """Ensure the Parserator package under src/ is importable during tests."""

    sdk_src = Path(__file__).resolve().parents[2] / "src"
    sys.path.insert(0, str(sdk_src))

    try:
        yield
    finally:
        if str(sdk_src) in sys.path:
            sys.path.remove(str(sdk_src))


@pytest.fixture(scope="module", autouse=True)
def stub_third_party_modules():
    """Provide lightweight stand-ins for optional integration dependencies."""

    created: Dict[str, types.ModuleType] = {}

    # Pydantic placeholder used by multiple integrations
    pydantic_module = types.ModuleType("pydantic")

    class BaseModel:  # pragma: no cover - minimal stub
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

    def Field(*_args: Any, **_kwargs: Any):  # pragma: no cover - stub helper
        return None

    pydantic_module.BaseModel = BaseModel
    pydantic_module.Field = Field
    created["pydantic"] = pydantic_module

    # LangChain schema stubs
    langchain_module = types.ModuleType("langchain")
    schema_module = types.ModuleType("langchain.schema")

    class BaseOutputParser:  # pragma: no cover - minimal stub
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

    class OutputParserException(Exception):
        pass

    schema_module.BaseOutputParser = BaseOutputParser
    output_parser_module = types.ModuleType("langchain.schema.output_parser")
    output_parser_module.OutputParserException = OutputParserException
    langchain_module.schema = schema_module

    created["langchain"] = langchain_module
    created["langchain.schema"] = schema_module
    created["langchain.schema.output_parser"] = output_parser_module

    # CrewAI tool stub
    crewai_tools_module = types.ModuleType("crewai_tools")

    class BaseTool:  # pragma: no cover - minimal stub
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            pass

    crewai_tools_module.BaseTool = BaseTool
    created["crewai_tools"] = crewai_tools_module

    # AutoGPT stubs
    autogpt_module = types.ModuleType("autogpt")
    agent_module = types.ModuleType("autogpt.agent")

    class Agent:  # pragma: no cover - minimal stub
        pass

    agent_module.Agent = Agent
    command_module = types.ModuleType("autogpt.command_decorator")

    def command(*_args: Any, **_kwargs: Any):  # pragma: no cover - minimal stub
        def decorator(func):
            return func

        return decorator

    command_module.command = command
    config_module = types.ModuleType("autogpt.config")

    class Config:  # pragma: no cover - minimal stub
        parserator_api_key: str | None = None

    config_module.Config = Config
    autogpt_module.agent = agent_module
    autogpt_module.command_decorator = command_module
    autogpt_module.config = config_module

    created.update(
        {
            "autogpt": autogpt_module,
            "autogpt.agent": agent_module,
            "autogpt.command_decorator": command_module,
            "autogpt.config": config_module,
        }
    )

    previous: Dict[str, types.ModuleType | None] = {
        name: sys.modules.get(name) for name in created
    }
    sys.modules.update(created)

    try:
        yield
    finally:
        for name, module in created.items():
            if previous[name] is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous[name]


@pytest.fixture(scope="module", autouse=True)
def stub_parserator_sdk_modules():
    """Provide placeholder Parserator SDK modules expected by integrations."""

    created: Dict[str, types.ModuleType] = {}

    types_module = types.ModuleType("parserator.types")

    class ParseResponse:
        def __init__(
            self,
            success: bool = True,
            parsed_data: Dict[str, Any] | None = None,
            metadata: Dict[str, Any] | None = None,
            error_message: str | None = None,
        ) -> None:
            self.success = success
            self.parsed_data = parsed_data or {}
            self.metadata = metadata or {}
            self.error_message = error_message

    # Lightweight placeholders for other exported SDK symbols
    placeholder_class_names = [
        "ParseRequest",
        "ParseOptions",
        "ParseMetadata",
        "ParseratorConfig",
        "BatchParseRequest",
        "BatchParseResponse",
        "BatchOptions",
        "SearchStep",
        "SearchPlan",
        "ValidationType",
        "ParseError",
        "ErrorCode",
        "SchemaValidationResult",
        "ParsePreset",
    ]
    for name in placeholder_class_names:
        setattr(types_module, name, type(name, (), {}))

    types_module.ParseResponse = ParseResponse
    created["parserator.types"] = types_module

    client_module = types.ModuleType("parserator.client")

    class ParseratorClient:  # pragma: no cover - replaced with AsyncMock per test
        async def parse(self, **_kwargs: Any) -> ParseResponse:
            return ParseResponse()

    client_module.ParseratorClient = ParseratorClient
    created["parserator.client"] = client_module

    errors_module = types.ModuleType("parserator.errors")
    for name in [
        "ParseratorError",
        "ValidationError",
        "AuthenticationError",
        "RateLimitError",
        "QuotaExceededError",
        "NetworkError",
        "TimeoutError",
        "ParseFailedError",
        "ServiceUnavailableError",
    ]:
        errors_module.__dict__[name] = type(name, (Exception,), {})
    created["parserator.errors"] = errors_module

    presets_module = types.ModuleType("parserator.presets")
    for name in [
        "EMAIL_PARSER",
        "INVOICE_PARSER",
        "CONTACT_PARSER",
        "CSV_PARSER",
        "LOG_PARSER",
        "DOCUMENT_PARSER",
        "ALL_PRESETS",
    ]:
        setattr(presets_module, name, {})

    def _return_dummy(*_args: Any, **_kwargs: Any):  # pragma: no cover - stub
        return {}

    presets_module.get_preset_by_name = _return_dummy
    presets_module.list_available_presets = lambda: []
    created["parserator.presets"] = presets_module

    utils_module = types.ModuleType("parserator.utils")
    for name in [
        "validate_api_key",
        "validate_schema",
        "validate_input_data",
        "to_pandas",
        "to_polars",
        "to_numpy",
        "from_pandas",
        "from_polars",
    ]:
        utils_module.__dict__[name] = lambda *_a, **_k: True

    utils_module.DataFrame = object
    utils_module.Series = object
    created["parserator.utils"] = utils_module

    previous: Dict[str, types.ModuleType | None] = {
        name: sys.modules.get(name) for name in created
    }
    sys.modules.update(created)

    try:
        yield ParseResponse
    finally:
        for name in created:
            if previous[name] is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = previous[name]


@pytest.fixture()
def parse_response():
    """Return the stub ParseResponse class for convenience."""

    from parserator.types import ParseResponse

    return ParseResponse


def test_langchain_output_parser_sync_executes_async_client(monkeypatch, parse_response):
    import importlib

    module = importlib.import_module("parserator.integrations.langchain")

    response = parse_response(
        success=True,
        parsed_data={"field": "value"},
        metadata={"confidence": 0.91, "processingTimeMs": 42},
    )

    async_client = AsyncMock()
    async_client.parse.return_value = response

    class ClientFactory:
        def __init__(self) -> None:
            self.instance = async_client

        def __call__(self, **_kwargs: Any) -> AsyncMock:
            return async_client

    monkeypatch.setattr(module, "ParseratorClient", ClientFactory())

    parser = module.ParseratorOutputParser(
        api_key="test", output_schema={"field": "string"}
    )
    result = parser.parse("example")

    assert result == {"field": "value"}
    async_client.parse.assert_awaited()


def test_crewai_tool_returns_structured_payload(monkeypatch, parse_response):
    import importlib

    module = importlib.import_module("parserator.integrations.crewai")

    response = parse_response(
        success=True,
        parsed_data={"summary": "ok"},
        metadata={"confidence": 0.73},
    )

    async_client = AsyncMock()
    async_client.parse.return_value = response

    class ClientFactory:
        def __call__(self, **_kwargs: Any) -> AsyncMock:
            return async_client

    monkeypatch.setattr(module, "ParseratorClient", ClientFactory())
    tool = module.ParseratorTool(api_key="key")
    payload = tool._run("text", {"summary": "string"})

    assert payload["parsed_data"] == {"summary": "ok"}
    assert payload["error"] is False
    async_client.parse.assert_awaited()


def test_autogpt_plugin_parses_and_formats_json(monkeypatch, parse_response):
    import importlib

    module = importlib.import_module("parserator.integrations.autogpt")
    monkeypatch.setattr(module, "AUTOGPT_AVAILABLE", True)
    monkeypatch.setenv("PARSERATOR_API_KEY", "key")

    response = parse_response(
        success=True,
        parsed_data={"name": "Parserator"},
        metadata={"processingTimeMs": 21},
    )

    async_client = AsyncMock()
    async_client.parse.return_value = response

    class ClientFactory:
        def __call__(self, **_kwargs: Any) -> AsyncMock:
            return async_client

    monkeypatch.setattr(module, "ParseratorClient", ClientFactory())

    plugin = module.ParseratorPlugin()
    result_json = plugin.parse_text("text", {"name": "string"})
    payload = json.loads(result_json)

    assert payload["success"] is True
    assert payload["parsed_data"] == {"name": "Parserator"}
    async_client.parse.assert_awaited()

    # The register helper should instantiate without error
    registered = module.register()
    assert isinstance(registered, module.ParseratorPlugin)
