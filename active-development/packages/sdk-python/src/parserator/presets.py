"""Built-in parsing presets shipped with the Parserator SDK."""
from __future__ import annotations

from typing import Dict, List

from .types import ParsePreset


EMAIL_PARSER = ParsePreset(
    name="email_parser",
    description="Extracts key fields from unstructured email content.",
    schema={
        "from": "string",
        "to": "string",
        "subject": "string",
        "date": "string",
        "summary": "string",
        "action_items": "array",
    },
)

INVOICE_PARSER = ParsePreset(
    name="invoice_parser",
    description="Extracts totals, vendor, and line items from invoices.",
    schema={
        "vendor": "string",
        "invoice_number": "string",
        "total": "currency",
        "due_date": "date",
        "line_items": "array",
    },
)

CONTACT_PARSER = ParsePreset(
    name="contact_parser",
    description="Extracts contact information such as name, email, and phone numbers.",
    schema={
        "name": "string",
        "email": "email",
        "phone": "phone",
        "company": "string",
    },
)

CSV_PARSER = ParsePreset(
    name="csv_parser",
    description="Normalises semi-structured CSV like text into a tabular schema.",
    schema={"rows": "array", "columns": "array"},
)

LOG_PARSER = ParsePreset(
    name="log_parser",
    description="Transforms log snippets into structured records.",
    schema={"entries": "array"},
)

DOCUMENT_PARSER = ParsePreset(
    name="document_parser",
    description="Extracts headings, summaries, and action items from generic documents.",
    schema={
        "title": "string",
        "summary": "string",
        "action_items": "array",
    },
)

ALL_PRESETS: List[ParsePreset] = [
    EMAIL_PARSER,
    INVOICE_PARSER,
    CONTACT_PARSER,
    CSV_PARSER,
    LOG_PARSER,
    DOCUMENT_PARSER,
]


_PRESET_LOOKUP: Dict[str, ParsePreset] = {preset.name: preset for preset in ALL_PRESETS}


def get_preset_by_name(name: str) -> ParsePreset:
    """Return a preset by its identifier."""

    return _PRESET_LOOKUP[name]


def get_presets_by_tag(tag: str) -> List[ParsePreset]:
    """Compatibility helper for the Node SDK API surface."""

    # The Python SDK does not yet expose tagged presets; return all for now.
    return list(ALL_PRESETS)


def list_available_presets() -> List[ParsePreset]:
    """Return all presets bundled with the SDK."""

    return list(ALL_PRESETS)


__all__ = [
    "EMAIL_PARSER",
    "INVOICE_PARSER",
    "CONTACT_PARSER",
    "CSV_PARSER",
    "LOG_PARSER",
    "DOCUMENT_PARSER",
    "ALL_PRESETS",
    "get_preset_by_name",
    "get_presets_by_tag",
    "list_available_presets",
]
