"""Predefined parsing presets for the Parserator SDK."""

from __future__ import annotations

from typing import Dict, List, Optional

from .types import ParseOptions, ParsePreset, PresetExample


def _preset(
    name: str,
    description: str,
    output_schema: Dict[str, object],
    instructions: str,
    examples: List[Dict[str, object]],
    options: Dict[str, object],
) -> ParsePreset:
    parsed_examples = [PresetExample(**example) for example in examples]
    return ParsePreset(
        name=name,
        description=description,
        output_schema=output_schema,
        instructions=instructions,
        examples=parsed_examples,
        options=ParseOptions(**options),
    )


EMAIL_PARSER = _preset(
    name="Email Parser",
    description=(
        "Extract structured data from email content including sender, subject, "
        "dates, and key information"
    ),
    output_schema={
        "sender": {
            "type": "object",
            "required": True,
            "description": "Sender information",
        },
        "subject": "string",
        "date": "iso_date",
        "recipients": "string_array",
        "body": "string",
        "attachments": "string_array",
        "action_items": "string_array",
        "mentioned_dates": "string_array",
        "priority": {
            "type": "string",
            "required": False,
            "description": "Urgency level: low, medium, high, urgent",
        },
    },
    instructions=(
        "Parse email content focusing on extracting actionable information, "
        "dates, and contacts. Identify urgency and action items."
    ),
    examples=[
        {
            "input": (
                "From: john@example.com\nTo: team@company.com\nSubject: Urgent: "
                "Project deadline moved to Friday\n\nHi team,\n\nThe client "
                "meeting has been moved to this Friday at 2pm. Please prepare "
                "the presentation by Thursday."
            ),
            "expected_output": {
                "sender": {"email": "john@example.com", "name": "john"},
                "subject": "Urgent: Project deadline moved to Friday",
                "recipients": ["team@company.com"],
                "action_items": ["prepare the presentation by Thursday"],
                "mentioned_dates": ["Friday at 2pm", "Thursday"],
                "priority": "urgent",
            },
        }
    ],
    options={
        "timeout": 30000,
        "validate_output": True,
        "confidence_threshold": 0.85,
    },
)


INVOICE_PARSER = _preset(
    name="Invoice Parser",
    description=(
        "Extract financial data from invoices including amounts, dates, vendor information"
    ),
    output_schema={
        "invoice_number": "string",
        "date": "iso_date",
        "due_date": "iso_date",
        "vendor": {
            "type": "object",
            "required": True,
            "description": "Vendor/supplier information",
        },
        "customer": {
            "type": "object",
            "required": True,
            "description": "Customer/buyer information",
        },
        "line_items": {
            "type": "object",
            "required": True,
            "description": "Array of invoice line items",
        },
        "subtotal": "number",
        "tax_amount": "number",
        "total_amount": "number",
        "currency": "string",
        "payment_terms": "string",
    },
    instructions=(
        "Extract all financial and business information from invoices. Focus on "
        "accurate number parsing and date extraction."
    ),
    examples=[
        {
            "input": (
                "INVOICE #INV-2024-001\nDate: Jan 15, 2024\nDue: Feb 15, 2024"
                "\n\nBill To: Acme Corp\n123 Main St\n\nQty | Description | "
                "Price\n2   | Widgets     | $50.00\n1   | Service     | "
                "$100.00\n\nSubtotal: $200.00\nTax: $20.00\nTotal: $220.00"
            ),
            "expected_output": {
                "invoice_number": "INV-2024-001",
                "date": "2024-01-15",
                "due_date": "2024-02-15",
                "customer": {"name": "Acme Corp", "address": "123 Main St"},
                "line_items": [
                    {"qty": 2, "description": "Widgets", "price": 50.0},
                    {"qty": 1, "description": "Service", "price": 100.0},
                ],
                "subtotal": 200.0,
                "tax_amount": 20.0,
                "total_amount": 220.0,
                "currency": "USD",
            },
        }
    ],
    options={
        "timeout": 45000,
        "validate_output": True,
        "confidence_threshold": 0.9,
    },
)


CONTACT_PARSER = _preset(
    name="Contact Parser",
    description="Extract contact information from various text formats",
    output_schema={
        "name": "string",
        "email": "email",
        "phone": "phone",
        "company": "string",
        "title": "string",
        "address": {
            "type": "object",
            "required": False,
            "description": "Physical address information",
        },
        "social_media": {
            "type": "object",
            "required": False,
            "description": "Social media profiles",
        },
        "notes": "string",
    },
    instructions=(
        "Extract comprehensive contact information. Handle various formats like "
        "business cards, email signatures, and directory listings."
    ),
    examples=[
        {
            "input": (
                "John Smith\nSenior Developer\nTech Solutions Inc.\n"
                "john.smith@techsolutions.com\n(555) 123-4567\n123 Business "
                "Ave, Suite 100\nSan Francisco, CA 94105\nLinkedIn: "
                "linkedin.com/in/johnsmith"
            ),
            "expected_output": {
                "name": "John Smith",
                "title": "Senior Developer",
                "company": "Tech Solutions Inc.",
                "email": "john.smith@techsolutions.com",
                "phone": "(555) 123-4567",
                "address": {
                    "street": "123 Business Ave, Suite 100",
                    "city": "San Francisco",
                    "state": "CA",
                    "zip": "94105",
                },
                "social_media": {"linkedin": "linkedin.com/in/johnsmith"},
            },
        }
    ],
    options={
        "timeout": 20000,
        "validate_output": True,
        "confidence_threshold": 0.8,
    },
)


CSV_PARSER = _preset(
    name="CSV Parser",
    description="Parse CSV data into structured JSON with automatic header detection",
    output_schema={
        "headers": "string_array",
        "rows": {
            "type": "object",
            "required": True,
            "description": "Array of data rows as objects",
        },
        "metadata": {
            "type": "object",
            "required": True,
            "description": "CSV parsing metadata",
        },
    },
    instructions=(
        "Parse CSV data with intelligent type detection. Handle various "
        "delimiters and quote characters. Detect column types automatically."
    ),
    examples=[
        {
            "input": (
                "Name,Age,Email,Salary\nJohn Doe,30,john@example.com,50000"
                "\nJane Smith,25,jane@example.com,55000"
            ),
            "expected_output": {
                "headers": ["Name", "Age", "Email", "Salary"],
                "rows": [
                    {
                        "Name": "John Doe",
                        "Age": 30,
                        "Email": "john@example.com",
                        "Salary": 50000,
                    },
                    {
                        "Name": "Jane Smith",
                        "Age": 25,
                        "Email": "jane@example.com",
                        "Salary": 55000,
                    },
                ],
                "metadata": {
                    "row_count": 2,
                    "column_count": 4,
                    "delimiter": ",",
                    "column_types": {
                        "Name": "string",
                        "Age": "number",
                        "Email": "email",
                        "Salary": "number",
                    },
                },
            },
        }
    ],
    options={
        "timeout": 30000,
        "validate_output": True,
        "confidence_threshold": 0.9,
    },
)


LOG_PARSER = _preset(
    name="Log Parser",
    description="Parse application logs and extract structured information",
    output_schema={
        "entries": {
            "type": "object",
            "required": True,
            "description": "Array of parsed log entries",
        },
        "summary": {
            "type": "object",
            "required": True,
            "description": "Log analysis summary",
        },
    },
    instructions=(
        "Parse log files extracting timestamps, levels, messages, and "
        "structured data. Identify patterns and anomalies."
    ),
    examples=[
        {
            "input": (
                "2024-01-15 10:30:15 INFO [UserService] User login successful: "
                "user_id=123\n2024-01-15 10:30:45 ERROR [PaymentService] "
                "Payment failed: order_id=456, error=CARD_DECLINED"
            ),
            "expected_output": {
                "entries": [
                    {
                        "timestamp": "2024-01-15T10:30:15",
                        "level": "INFO",
                        "service": "UserService",
                        "message": "User login successful",
                        "data": {"user_id": "123"},
                    },
                    {
                        "timestamp": "2024-01-15T10:30:45",
                        "level": "ERROR",
                        "service": "PaymentService",
                        "message": "Payment failed",
                        "data": {
                            "order_id": "456",
                            "error": "CARD_DECLINED",
                        },
                    },
                ],
                "summary": {
                    "total_entries": 2,
                    "error_count": 1,
                    "warning_count": 0,
                    "info_count": 1,
                    "time_range": {
                        "start": "2024-01-15T10:30:15",
                        "end": "2024-01-15T10:30:45",
                    },
                },
            },
        }
    ],
    options={
        "timeout": 40000,
        "validate_output": True,
        "confidence_threshold": 0.85,
    },
)


DOCUMENT_PARSER = _preset(
    name="Document Parser",
    description=(
        "Extract structured information from documents like contracts, reports, and forms"
    ),
    output_schema={
        "title": "string",
        "document_type": "string",
        "date": "iso_date",
        "parties": "string_array",
        "key_terms": {
            "type": "object",
            "required": False,
            "description": "Important terms and values",
        },
        "dates": {
            "type": "object",
            "required": False,
            "description": "Important dates mentioned",
        },
        "amounts": {
            "type": "object",
            "required": False,
            "description": "Financial amounts mentioned",
        },
        "summary": "string",
    },
    instructions=(
        "Extract key information from business documents. Focus on parties, "
        "dates, amounts, and important terms. Provide a concise summary."
    ),
    examples=[],
    options={
        "timeout": 60000,
        "validate_output": True,
        "confidence_threshold": 0.8,
    },
)


ALL_PRESETS: Dict[str, ParsePreset] = {
    "EMAIL_PARSER": EMAIL_PARSER,
    "INVOICE_PARSER": INVOICE_PARSER,
    "CONTACT_PARSER": CONTACT_PARSER,
    "CSV_PARSER": CSV_PARSER,
    "LOG_PARSER": LOG_PARSER,
    "DOCUMENT_PARSER": DOCUMENT_PARSER,
}


def get_preset_by_name(name: str) -> Optional[ParsePreset]:
    """Return a preset by its human readable name."""

    for preset in ALL_PRESETS.values():
        if preset.name == name:
            return preset
    return None


def list_available_presets() -> List[str]:
    """List all available preset display names."""

    return [preset.name for preset in ALL_PRESETS.values()]


__all__ = [
    "ALL_PRESETS",
    "CONTACT_PARSER",
    "CSV_PARSER",
    "DOCUMENT_PARSER",
    "EMAIL_PARSER",
    "INVOICE_PARSER",
    "LOG_PARSER",
    "get_preset_by_name",
    "list_available_presets",
]
