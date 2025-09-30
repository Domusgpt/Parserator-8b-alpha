"""CrewAI tool wrappers that delegate to the lightweight Parserator client."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

try:  # pragma: no cover - optional dependency
    from crewai_tools import BaseTool
except ImportError:  # pragma: no cover - optional dependency
    BaseTool = object  # type: ignore[misc, assignment]
    CREWAI_AVAILABLE = False
else:  # pragma: no cover - imported only when CrewAI is installed
    CREWAI_AVAILABLE = True

from ..client import ParseratorClient, ParseratorError

__all__ = ["ParseratorTool", "EmailParserTool", "DocumentParserTool"]


class ParseratorTool(BaseTool):  # type: ignore[misc]
    """Simple CrewAI tool that proxies to :class:`ParseratorClient`."""

    def __init__(
        self,
        api_key: str,
        name: str = "parserator",
        description: str = "Parse unstructured text into structured JSON data",
        base_url: Optional[str] = None,
        *,
        client: Optional[ParseratorClient] = None,
    ) -> None:
        if not CREWAI_AVAILABLE:
            raise ImportError(
                "crewai-tools is not installed. Install it with `pip install crewai-tools`."
            )

        super().__init__(name=name, description=description)
        self.instructions: Optional[str] = None
        self.output_schema: Dict[str, Any] = {}
        self.client = client or ParseratorClient(api_key=api_key, base_url=base_url)

    def _run(  # type: ignore[override]
        self,
        input_data: str,
        output_schema: Dict[str, Any],
        instructions: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            result = self.client.parse(
                input_data=input_data,
                output_schema=output_schema,
                instructions=instructions,
            )
        except ParseratorError as exc:  # pragma: no cover - optional dependency
            return {"error": True, "message": str(exc), "parsed_data": None}

        return {
            "error": not result.success,
            "message": result.error_message,
            "parsed_data": result.parsed_data if result.success else None,
        }


class EmailParserTool(ParseratorTool):
    """Preconfigured Parserator tool aimed at email parsing tasks."""

    def _run(  # type: ignore[override]
        self, email_content: str, custom_fields: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        schema = {
            "from": "string",
            "to": "string",
            "subject": "string",
            "date": "string",
            "summary": "string",
            "action_items": "array",
            "mentioned_people": "array",
            "important_dates": "array",
            "priority": "string",
        }

        if custom_fields:
            for field in custom_fields:
                schema[field] = "string"

        return super()._run(
            input_data=email_content,
            output_schema=schema,
            instructions="Extract the key details from the email including any action items or important dates.",
        )


class DocumentParserTool(ParseratorTool):
    """Preconfigured Parserator tool aimed at generic document parsing."""

    def _run(  # type: ignore[override]
        self, document_content: str, document_type: str = "general"
    ) -> Dict[str, Any]:
        schema: Dict[str, Any] = {
            "title": "string",
            "document_type": "string",
            "summary": "string",
            "key_topics": "array",
            "main_points": "array",
        }

        if document_type.lower() == "contract":
            schema.update({
                "parties": "array",
                "effective_date": "string",
                "term": "string",
            })
        elif document_type.lower() == "invoice":
            schema.update({
                "vendor": "string",
                "amount_due": "string",
                "due_date": "string",
            })

        return super()._run(
            input_data=document_content,
            output_schema=schema,
            instructions=f"Summarise the {document_type} and highlight the most important fields.",
        )
