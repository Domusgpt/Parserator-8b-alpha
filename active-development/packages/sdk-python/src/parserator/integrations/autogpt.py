"""AutoGPT plugin that surfaces Parserator parsing as an action.""" 
from __future__ import annotations

from typing import Any, Dict, Optional

from ..client import ParseratorClient


class ParseratorPlugin:
    """Simple AutoGPT-compatible plugin wrapper."""

    name = "Parserator"
    description = "Parse free-form text into structured data using Parserator"

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        output_schema: Optional[Dict[str, Any]] = None,
        instructions: Optional[str] = None,
        base_url: Optional[str] = None,
        client: Optional[ParseratorClient] = None,
    ) -> None:
        if api_key is None and client is None:
            raise ValueError("ParseratorPlugin requires an API key or a pre-configured client.")

        self._schema = output_schema or {}
        self._instructions = instructions
        self._client = client or ParseratorClient(api_key=api_key or "", base_url=base_url)

    def can_handle_post_prompt(self) -> bool:  # pragma: no cover - interface hook
        return True

    def post_prompt(self, prompt: str) -> str:  # pragma: no cover - interface hook
        return prompt

    def parse_text(self, text: str, *, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        payload_schema = schema or self._schema
        if not payload_schema:
            raise ValueError("ParseratorPlugin.parse_text requires a schema to map the response.")

        result = self._client.parse(
            input_data=text,
            output_schema=payload_schema,
            instructions=self._instructions,
        )
        if not result.success:
            message = result.error_message or "Parserator request failed."
            raise RuntimeError(message)
        return result.parsed_data or {}


def register(**kwargs: Any) -> ParseratorPlugin:
    """Entry point used by AutoGPT to instantiate the plugin."""

    return ParseratorPlugin(**kwargs)


__all__ = ["ParseratorPlugin", "register"]
