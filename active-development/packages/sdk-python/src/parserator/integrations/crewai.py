"""CrewAI tool that wraps :class:`ParseratorClient`."""
from __future__ import annotations

from typing import Any, Dict, Optional

from ..client import ParseratorClient

try:  # pragma: no cover - optional dependency
    from crewai_tools import BaseTool
except ImportError:  # pragma: no cover - optional dependency
    class BaseTool:  # type: ignore[override]
        """Fallback base class used when CrewAI is not installed."""

        description: str = ""
        name: str = "parserator"

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            raise ImportError(
                "ParseratorTool requires CrewAI. Install it with `pip install crewai-tools`."
            )


class ParseratorTool(BaseTool):
    """Minimal CrewAI tool that delegates parsing to :class:`ParseratorClient`."""

    def __init__(
        self,
        api_key: str,
        *,
        output_schema: Dict[str, Any],
        instructions: Optional[str] = None,
        name: str = "parserator",
        description: str = "Parse text with Parserator",
        base_url: Optional[str] = None,
        client: Optional[ParseratorClient] = None,
    ) -> None:
        super().__init__()
        self.name = name
        self.description = description
        self._schema = output_schema
        self._instructions = instructions
        self._client = client or ParseratorClient(api_key=api_key, base_url=base_url)

    def _run(self, text: str) -> Dict[str, Any]:  # pragma: no cover - exercised externally
        result = self._client.parse(
            input_data=text,
            output_schema=self._schema,
            instructions=self._instructions,
        )
        if not result.success:
            message = result.error_message or "Parserator request failed."
            raise RuntimeError(message)
        return result.parsed_data or {}

    async def _arun(self, text: str) -> Dict[str, Any]:  # pragma: no cover - exercised externally
        return self._run(text)


__all__ = ["ParseratorTool"]
