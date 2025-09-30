"""LangChain helper that wires Parserator into LangChain output parsers."""
from __future__ import annotations

from typing import Any, Dict, Optional

try:  # pragma: no cover - optional dependency
    from langchain.schema import BaseOutputParser
    from langchain.schema.output_parser import OutputParserException
except ImportError:  # pragma: no cover - optional dependency
    BaseOutputParser = object  # type: ignore[misc, assignment]
    OutputParserException = Exception  # type: ignore[misc, assignment]
    LANGCHAIN_AVAILABLE = False
else:  # pragma: no cover - imported during runtime use only
    LANGCHAIN_AVAILABLE = True

from ..client import ParseratorClient, ParseratorError

__all__ = ["ParseratorOutputParser"]


class ParseratorOutputParser(BaseOutputParser):
    """Minimal drop-in output parser for LangChain chains."""

    def __init__(
        self,
        api_key: str,
        output_schema: Dict[str, Any],
        instructions: Optional[str] = None,
        base_url: Optional[str] = None,
        *,
        client: Optional[ParseratorClient] = None,
    ) -> None:
        if not LANGCHAIN_AVAILABLE:
            raise ImportError(
                "LangChain is not installed. Install it with `pip install langchain`."
            )

        self.output_schema = output_schema
        self.instructions = instructions
        self.client = client or ParseratorClient(api_key=api_key, base_url=base_url)

    def parse(self, text: str) -> Dict[str, Any]:  # type: ignore[override]
        """Synchronously parse ``text`` and return structured data."""

        try:
            result = self.client.parse(
                input_data=text,
                output_schema=self.output_schema,
                instructions=self.instructions,
            )
        except ParseratorError as exc:  # pragma: no cover - thin wrapper
            raise OutputParserException(str(exc)) from exc

        if not result.success:
            raise OutputParserException(result.error_message or "Parserator parse failed")

        return result.parsed_data

    def get_format_instructions(self) -> str:  # type: ignore[override]
        return (
            "Provide a detailed answer in natural language. Parserator will transform "
            "the output into the requested schema."
        )

    @property
    def _type(self) -> str:  # pragma: no cover - used by LangChain runtime
        return "parserator"
