"""LangChain helpers that delegate parsing to :class:`ParseratorClient`."""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..client import ParseratorClient

try:  # pragma: no cover - optional dependency
    from langchain.schema import BaseOutputParser
    from langchain.schema.output_parser import OutputParserException
except ImportError:  # pragma: no cover - optional dependency
    class BaseOutputParser:  # type: ignore[override]
        """Fallback base parser used when LangChain is unavailable."""

        def parse(self, text: str) -> Dict[str, Any]:
            raise RuntimeError(
                "LangChain is not installed. Install `langchain` to use ParseratorOutputParser."
            )

    class OutputParserException(Exception):
        """Fallback exception matching LangChain's output parser errors."""

    _LANGCHAIN_AVAILABLE = False
else:  # pragma: no cover - optional dependency
    _LANGCHAIN_AVAILABLE = True


class ParseratorOutputParser(BaseOutputParser):
    """Minimal LangChain-compatible output parser backed by :class:`ParseratorClient`."""

    def __init__(
        self,
        api_key: str,
        output_schema: Dict[str, Any],
        *,
        instructions: Optional[str] = None,
        base_url: Optional[str] = None,
        client: Optional[ParseratorClient] = None,
    ) -> None:
        if not _LANGCHAIN_AVAILABLE:  # pragma: no cover - defensive
            raise ImportError(
                "ParseratorOutputParser requires LangChain. Install it with `pip install langchain`."
            )

        self._schema = output_schema
        self._instructions = instructions
        self._client = client or ParseratorClient(api_key=api_key, base_url=base_url)
        self._type = "parserator"

    def parse(self, text: str) -> Dict[str, Any]:  # type: ignore[override]
        try:
            result = self._client.parse(
                input_data=text,
                output_schema=self._schema,
                instructions=self._instructions,
            )
        except Exception as exc:  # pragma: no cover - defensive
            raise OutputParserException(f"Parserator request failed: {exc}") from exc

        if not result.success:
            message = result.error_message or "Parserator request failed."
            raise OutputParserException(message)

        return result.parsed_data or {}

    def get_format_instructions(self) -> str:  # pragma: no cover - simple passthrough
        return (
            "Respond naturally. The Parserator SDK will convert the reply to the configured schema."
        )

    @property
    def _type(self) -> str:  # type: ignore[override]
        return "parserator"


class ParseratorChainOutputParser(ParseratorOutputParser):
    """Alias retained for backwards compatibility with earlier releases."""


class ParseratorListOutputParser(ParseratorOutputParser):
    """Alias retained for backwards compatibility with earlier releases."""


__all__ = [
    "ParseratorOutputParser",
    "ParseratorChainOutputParser",
    "ParseratorListOutputParser",
]
