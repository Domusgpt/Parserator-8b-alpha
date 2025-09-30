"""
AutoGPT Integration for Parserator
Provides plugin for AutoGPT agents to parse unstructured data
"""

import asyncio
import inspect
from typing import Any, Dict, List, Optional, Tuple
import json

try:
    from autogpt.agent import Agent
    from autogpt.command_decorator import command
    from autogpt.config import Config
    AUTOGPT_AVAILABLE = True
except ImportError:
    AUTOGPT_AVAILABLE = False
    command = lambda *args, **kwargs: lambda func: func

from ..client import ParseratorClient

class ParseratorPlugin:
    """
    AutoGPT plugin for parsing unstructured data using Parserator.
    
    This plugin adds data parsing capabilities to AutoGPT agents,
    enabling them to convert any unstructured text into structured JSON.
    
    Installation:
        1. Place this file in your AutoGPT plugins directory
        2. Add "ParseratorPlugin" to your enabled plugins list
        3. Set PARSERATOR_API_KEY in your environment variables
        
    Example usage:
        The agent can now use commands like:
        - parse_text: Parse any unstructured text into JSON
        - parse_email: Extract structured data from emails  
        - parse_document: Analyze documents and extract key information
        - extract_contacts: Find contact information in text
    """
    
    def __init__(self, config: Optional[Any] = None):
        if not AUTOGPT_AVAILABLE:
            raise ImportError(
                "AutoGPT is not available. This plugin requires AutoGPT to be installed."
            )
            
        self.config = config
        self.api_key = self._get_api_key()
        self.client = ParseratorClient(api_key=self.api_key) if self.api_key else None
        
    def _get_api_key(self) -> Optional[str]:
        """Get API key from environment or config."""
        import os
        
        # Try environment variable first
        api_key = os.getenv('PARSERATOR_API_KEY')
        
        # Try config if available
        if not api_key and self.config:
            api_key = getattr(self.config, 'parserator_api_key', None)
            
        return api_key
    
    def can_handle_post_prompt(self) -> bool:
        """Indicate that this plugin can handle post-prompt operations."""
        return True
    
    def can_handle_on_response(self) -> bool:
        """Indicate that this plugin can handle response processing."""
        return True
    
    @command(
        "parse_text",
        "Parse unstructured text into structured JSON data",
        {
            "text": {
                "type": "string",
                "description": "The unstructured text to parse",
                "required": True
            },
            "schema": {
                "type": "object", 
                "description": "The desired JSON structure (as object)",
                "required": True
            },
            "instructions": {
                "type": "string",
                "description": "Additional parsing instructions (optional)",
                "required": False
            }
        }
    )
    def parse_text(self, text: str, schema: Dict[str, Any], instructions: Optional[str] = None) -> str:
        """
        Parse unstructured text into structured JSON data.
        
        Args:
            text: Raw unstructured text to parse
            schema: Desired JSON structure
            instructions: Optional additional parsing instructions
            
        Returns:
            JSON string with parsed data or error message
        """
        if not self.client:
            return json.dumps({
                "error": "Parserator API key not configured. Set PARSERATOR_API_KEY environment variable."
            })
        
        try:
            result = self.client.parse(
                input_data=text,
                output_schema=schema,
                instructions=instructions
            )
            if inspect.isawaitable(result):
                try:
                    asyncio.get_running_loop()
                except RuntimeError:
                    result = asyncio.run(result)
                else:  # pragma: no cover - defensive
                    raise RuntimeError(
                        "ParseratorPlugin.parse_text cannot run inside an active event loop; "
                        "await the client.parse coroutine instead."
                    )

            if result.success:
                metadata = result.metadata
                return json.dumps({
                    "success": True,
                    "parsed_data": result.parsed_data,
                    "confidence": getattr(metadata, "confidence", 0.0),
                    "processing_time_ms": getattr(metadata, "processing_time_ms", 0),
                }, indent=2)
            else:
                return json.dumps({
                    "success": False,
                    "error": result.error_message
                })
                
        except Exception as e:
            return json.dumps({
                "success": False,
                "error": f"Parsing failed: {str(e)}"
            })
    
    @command(
        "parse_email",
        "Extract structured information from email content",
        {
            "email_content": {
                "type": "string",
                "description": "The email content to parse",
                "required": True
            },
            "custom_fields": {
                "type": "array",
                "description": "Additional fields to extract (optional)",
                "required": False
            }
        }
    )
    def parse_email(self, email_content: str, custom_fields: Optional[List[str]] = None) -> str:
        """Extract structured information from email content."""
        schema = {
            "from": "string",
            "to": "string", 
            "subject": "string",
            "date": "string",
            "summary": "string",
            "action_items": "array",
            "mentioned_people": "array",
            "important_dates": "array",
            "priority_level": "string"
        }
        
        # Add custom fields if specified
        if custom_fields:
            for field in custom_fields:
                schema[field] = "string"
        
        return self.parse_text(
            text=email_content,
            schema=schema,
            instructions="Extract key information from email including sender, recipient, action items, and important dates."
        )
    
    @command(
        "parse_document",
        "Analyze document content and extract structured information",
        {
            "document_content": {
                "type": "string",
                "description": "The document content to parse",
                "required": True
            },
            "document_type": {
                "type": "string",
                "description": "Type of document (contract, invoice, report, etc.)",
                "required": False
            }
        }
    )
    def parse_document(self, document_content: str, document_type: str = "general") -> str:
        """Analyze document content and extract structured information."""
        base_schema = {
            "title": "string",
            "document_type": "string",
            "summary": "string",
            "key_topics": "array",
            "main_points": "array",
            "important_dates": "array"
        }
        
        # Add type-specific fields
        if document_type.lower() == "contract":
            base_schema.update({
                "parties_involved": "array",
                "contract_terms": "array",
                "payment_terms": "string",
                "expiration_date": "string"
            })
        elif document_type.lower() == "invoice":
            base_schema.update({
                "invoice_number": "string",
                "total_amount": "number",
                "due_date": "string",
                "line_items": "array",
                "billing_address": "string"
            })
        elif document_type.lower() == "report":
            base_schema.update({
                "key_findings": "array",
                "recommendations": "array",
                "methodology": "string",
                "data_sources": "array"
            })
        
        return self.parse_text(
            text=document_content,
            schema=base_schema,
            instructions=f"Analyze this {document_type} document and extract all relevant information including key points, dates, and document-specific details."
        )
    
    @command(
        "extract_contacts",
        "Extract contact information from unstructured text",
        {
            "text": {
                "type": "string", 
                "description": "Text containing contact information",
                "required": True
            }
        }
    )
    def extract_contacts(self, text: str) -> str:
        """Extract contact information from unstructured text."""
        schema = {
            "contacts": "array",
            "total_contacts_found": "number"
        }
        
        return self.parse_text(
            text=text,
            schema=schema,
            instructions="Extract all contact information including names, emails, phone numbers, addresses, and company details. Format as an array of contact objects."
        )
    
    @command(
        "extract_data_fields",
        "Extract specific data fields from unstructured text",
        {
            "text": {
                "type": "string",
                "description": "Text to extract data from", 
                "required": True
            },
            "fields": {
                "type": "array",
                "description": "List of field names to extract",
                "required": True
            },
            "field_descriptions": {
                "type": "object",
                "description": "Optional descriptions for each field",
                "required": False
            }
        }
    )
    def extract_data_fields(
        self,
        text: str,
        fields: List[str],
        field_descriptions: Optional[Dict[str, str]] = None
    ) -> str:
        """Extract specific data fields from unstructured text."""
        schema = {}
        instructions_parts = ["Extract the following specific information:"]
        
        for field in fields:
            schema[field] = "string"
            if field_descriptions and field in field_descriptions:
                instructions_parts.append(f"- {field}: {field_descriptions[field]}")
            else:
                instructions_parts.append(f"- {field}")
        
        instructions = "\n".join(instructions_parts)
        
        return self.parse_text(
            text=text,
            schema=schema,
            instructions=instructions
        )
    
    @command(
        "validate_parsed_data",
        "Validate and clean previously parsed data",
        {
            "parsed_data": {
                "type": "object",
                "description": "Previously parsed data to validate",
                "required": True
            },
            "validation_rules": {
                "type": "object", 
                "description": "Validation rules to apply",
                "required": False
            }
        }
    )
    def validate_parsed_data(
        self,
        parsed_data: Dict[str, Any],
        validation_rules: Optional[Dict[str, Any]] = None
    ) -> str:
        """Validate and clean previously parsed data."""
        try:
            # Basic validation
            validation_results = {
                "is_valid": True,
                "issues": [],
                "cleaned_data": parsed_data.copy()
            }
            
            # Check for empty required fields
            for key, value in parsed_data.items():
                if value is None or (isinstance(value, str) and value.strip() == ""):
                    validation_results["issues"].append(f"Field '{key}' is empty")
                    validation_results["is_valid"] = False
            
            # Apply custom validation rules if provided
            if validation_rules:
                for field, rules in validation_rules.items():
                    if field in parsed_data:
                        field_value = parsed_data[field]
                        
                        if "required" in rules and rules["required"] and not field_value:
                            validation_results["issues"].append(f"Required field '{field}' is missing")
                            validation_results["is_valid"] = False
                        
                        if "type" in rules:
                            expected_type = rules["type"]
                            if expected_type == "email" and field_value:
                                if "@" not in str(field_value):
                                    validation_results["issues"].append(f"Field '{field}' is not a valid email")
                                    validation_results["is_valid"] = False
                            elif expected_type == "number" and field_value:
                                try:
                                    float(field_value)
                                except (ValueError, TypeError):
                                    validation_results["issues"].append(f"Field '{field}' is not a valid number")
                                    validation_results["is_valid"] = False
            
            return json.dumps(validation_results, indent=2)
            
        except Exception as e:
            return json.dumps({
                "is_valid": False,
                "error": f"Validation failed: {str(e)}"
            })


# Plugin registration for AutoGPT
def register() -> ParseratorPlugin:
    """Register the Parserator plugin with AutoGPT."""
    return ParseratorPlugin()


# Helper functions for plugin usage
def get_parsing_commands() -> List[str]:
    """Get list of available parsing commands."""
    return [
        "parse_text",
        "parse_email", 
        "parse_document",
        "extract_contacts",
        "extract_data_fields",
        "validate_parsed_data"
    ]


def get_command_help(command_name: str) -> str:
    """Get help text for a specific parsing command."""
    help_text = {
        "parse_text": "Parse any unstructured text into structured JSON. Requires text and schema parameters.",
        "parse_email": "Extract structured information from email content including sender, recipient, and action items.",
        "parse_document": "Analyze documents and extract key information. Supports contracts, invoices, reports, and general documents.",
        "extract_contacts": "Find and extract contact information from unstructured text.",
        "extract_data_fields": "Extract specific custom fields from text based on your requirements.",
        "validate_parsed_data": "Validate and clean previously parsed data to ensure quality and consistency."
    }
    
    return help_text.get(command_name, "Command not found. Use get_parsing_commands() to see available commands.")