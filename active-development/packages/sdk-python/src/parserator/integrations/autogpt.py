"""AutoGPT plugin hooks backed by the lightweight Parserator client."""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

try:  # pragma: no cover - optional dependency
    from autogpt.command_decorator import command
except ImportError:  # pragma: no cover - optional dependency
    command = lambda *args, **kwargs: (  # type: ignore[assignment]
        lambda func: func
    )

from ..client import ParseratorClient, ParseratorError

__all__ = ["ParseratorPlugin"]


class ParseratorPlugin:
    """Very small AutoGPT plugin exposing Parserator parsing helpers."""

    def __init__(self, config: Optional[Any] = None) -> None:
        self.config = config
        self.api_key = self._get_api_key()
        self.client = ParseratorClient(api_key=self.api_key) if self.api_key else None

    def _get_api_key(self) -> Optional[str]:
        import os

        api_key = os.getenv("PARSERATOR_API_KEY")
        if not api_key and self.config is not None:
            api_key = getattr(self.config, "parserator_api_key", None)
        return api_key

    def can_handle_post_prompt(self) -> bool:
        return True

    def can_handle_on_response(self) -> bool:
        return True

    @command(
        "parse_text",
        "Parse unstructured text into structured JSON data",
        {
            "text": {"type": "string", "description": "The unstructured text to parse", "required": True},
            "schema": {
                "type": "object",
                "description": "The desired JSON schema",
                "required": True,
            },
            "instructions": {
                "type": "string",
                "description": "Additional parsing instructions",
                "required": False,
            },
        },
    )
    def parse_text(
        self, text: str, schema: Dict[str, Any], instructions: Optional[str] = None
    ) -> str:
        if not self.client:
            return json.dumps(
                {
                    "success": False,
                    "error": "Parserator API key not configured. Set PARSERATOR_API_KEY environment variable.",
                }
            )

        try:
            result = self.client.parse(
                input_data=text,
                output_schema=schema,
                instructions=instructions,
            )
        except ParseratorError as exc:  # pragma: no cover - optional dependency
            return json.dumps({"success": False, "error": str(exc)})

        if result.success:
            return json.dumps({"success": True, "parsed_data": result.parsed_data})

        return json.dumps({"success": False, "error": result.error_message})

    @command(
        "parse_email",
        "Extract structured information from email content",
        {
            "email_content": {
                "type": "string",
                "description": "The email content to parse",
                "required": True,
            },
            "custom_fields": {
                "type": "array",
                "description": "Additional fields to extract",
                "required": False,
            },
        },
    )
    def parse_email(self, email_content: str, custom_fields: Optional[List[str]] = None) -> str:
        schema = {
            "from": "string",
            "to": "string",
            "subject": "string",
            "date": "string",
            "summary": "string",
            "action_items": "array",
            "mentioned_people": "array",
            "important_dates": "array",
            "priority_level": "string",
        }

        if custom_fields:
            for field in custom_fields:
                schema[field] = "string"

        return self.parse_text(
            text=email_content,
            schema=schema,
            instructions="Extract the essential details from the email including any action items and deadlines.",
        )

    @command(
        "parse_document",
        "Analyze document content and extract structured information",
        {
            "document_content": {
                "type": "string",
                "description": "The document content to parse",
                "required": True,
            },
            "document_type": {
                "type": "string",
                "description": "Type of document (contract, invoice, report, etc.)",
                "required": False,
            },
        },
    )
    def parse_document(self, document_content: str, document_type: str = "general") -> str:
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

        return self.parse_text(
            text=document_content,
            schema=schema,
            instructions=f"Provide a structured summary of the {document_type} including its most important attributes.",
        )

    @command(
        "extract_contacts",
        "Extract contact information from free-form text",
        {
            "text": {
                "type": "string",
                "description": "The text to analyse",
                "required": True,
            }
        },
    )
    def extract_contacts(self, text: str) -> str:
        schema = {
            "contacts": [
                {
                    "name": "string",
                    "email": "email",
                    "phone": "phone",
                    "company": "string",
                }
            ]
        }

        return self.parse_text(
            text=text,
            schema=schema,
            instructions="Identify all contacts mentioned in the text and return their details as structured data.",
        )
