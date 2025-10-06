"""CrewAI integration helpers built on the async Parserator SDK."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import Field

try:
    from crewai_tools import BaseTool
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False
    BaseTool = object

from ..client import ParseratorClient
from ..types import ParseResponse
from ._async_utils import run_async


class ParseratorTool(BaseTool):
    """
    CrewAI tool for parsing unstructured data using Parserator.
    
    This tool enables CrewAI agents to convert any unstructured text into
    structured JSON data using Parserator's two-stage parsing engine.
    
    Example:
        ```python
        from parserator.integrations.crewai import ParseratorTool
        from crewai import Agent, Task, Crew
        
        # Create Parserator tool
        parser_tool = ParseratorTool(
            api_key="your_api_key",
            name="data_parser",
            description="Parse unstructured data into JSON"
        )
        
        # Create agent with parsing capability
        data_analyst = Agent(
            role='Data Analyst',
            goal='Extract structured information from documents',
            backstory='Expert at analyzing unstructured data',
            tools=[parser_tool]
        )
        
        # Create task
        task = Task(
            description='Parse the email content and extract key information',
            agent=data_analyst
        )
        
        crew = Crew(
            agents=[data_analyst],
            tasks=[task]
        )
        
        result = crew.kickoff()
        ```
    """
    
    name: str = "parserator"
    description: str = "Parse unstructured text into structured JSON data using Parserator's AI engine"
    api_key: str = Field(description="Parserator API key")
    base_url: Optional[str] = Field(default=None, description="Custom API base URL")
    
    def __init__(
        self,
        api_key: str,
        name: str = "parserator",
        description: str = "Parse unstructured text into structured JSON data",
        base_url: Optional[str] = None,
        **kwargs,
    ):
        if not CREWAI_AVAILABLE:
            raise ImportError(
                "CrewAI tools are not installed. Install with: pip install crewai-tools"
            )
            
        super().__init__(
            name=name,
            description=description,
            api_key=api_key,
            base_url=base_url,
            **kwargs
        )
        
        self.client = ParseratorClient(api_key=api_key, base_url=base_url)
    
    def _run(
        self,
        input_data: str,
        output_schema: Dict[str, Any],
        instructions: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute the parsing operation.
        
        Args:
            input_data: Raw unstructured text to parse
            output_schema: Desired JSON structure
            instructions: Optional additional parsing instructions
            
        Returns:
            Structured data according to output_schema
        """
        try:
            response: ParseResponse = run_async(
                self.client.parse(
                    input_data=input_data,
                    output_schema=output_schema,
                    instructions=instructions,
                )
            )

            if not response.success:
                return {
                    "error": True,
                    "message": response.error_message,
                    "parsed_data": None,
                }

            return {
                "error": False,
                "parsed_data": response.parsed_data,
                "confidence": response.metadata.get("confidence", 0.0),
                "processing_time": response.metadata.get("processingTimeMs", 0),
            }

        except Exception as e:
            return {
                "error": True,
                "message": f"Parsing failed: {str(e)}",
                "parsed_data": None
            }


class EmailParserTool(ParseratorTool):
    """Specialized CrewAI tool for parsing email content."""
    
    name: str = "email_parser"
    description: str = "Extract structured information from email content"
    
    def _run(self, email_content: str, custom_fields: Optional[List[str]] = None) -> Dict[str, Any]:
        """Parse email content with predefined schema."""
        schema = {
            "from": "string",
            "to": "string",
            "subject": "string", 
            "date": "string",
            "summary": "string",
            "action_items": "array",
            "mentioned_people": "array",
            "important_dates": "array",
            "priority": "string"
        }
        
        # Add custom fields if specified
        if custom_fields:
            for field in custom_fields:
                schema[field] = "string"
        
        return super()._run(
            input_data=email_content,
            output_schema=schema,
            instructions="Extract key information from email content, including sender, recipient, subject, and any action items or important dates mentioned."
        )


class DocumentParserTool(ParseratorTool):
    """Specialized CrewAI tool for parsing document content."""
    
    name: str = "document_parser" 
    description: str = "Extract structured information from documents"
    
    def _run(self, document_content: str, document_type: str = "general") -> Dict[str, Any]:
        """Parse document content with type-specific schema."""
        base_schema = {
            "title": "string",
            "document_type": "string",
            "summary": "string",
            "key_topics": "array",
            "main_points": "array"
        }
        
        # Add type-specific fields
        if document_type.lower() == "contract":
            base_schema.update({
                "parties": "array",
                "terms": "array", 
                "dates": "array",
                "obligations": "array"
            })
        elif document_type.lower() == "invoice":
            base_schema.update({
                "invoice_number": "string",
                "amount": "number",
                "due_date": "string",
                "items": "array"
            })
        elif document_type.lower() == "report":
            base_schema.update({
                "findings": "array",
                "recommendations": "array",
                "data_points": "array"
            })
        
        return super()._run(
            input_data=document_content,
            output_schema=base_schema,
            instructions=f"Analyze this {document_type} document and extract all relevant structured information."
        )


class ContactParserTool(ParseratorTool):
    """Specialized CrewAI tool for parsing contact information."""
    
    name: str = "contact_parser"
    description: str = "Extract contact information from unstructured text"
    
    def _run(self, text_content: str) -> Dict[str, Any]:
        """Parse text to extract contact information."""
        schema = {
            "name": "string",
            "email": "string",
            "phone": "string", 
            "company": "string",
            "title": "string",
            "address": "string",
            "social_media": "array",
            "notes": "string"
        }
        
        return super()._run(
            input_data=text_content,
            output_schema=schema,
            instructions="Extract all contact information including names, emails, phone numbers, addresses, and company details."
        )


class DataExtractionTool(ParseratorTool):
    """Flexible CrewAI tool for custom data extraction."""
    
    name: str = "data_extractor"
    description: str = "Extract custom data fields from unstructured text"
    
    def _run(
        self,
        text_content: str,
        extraction_fields: List[str],
        field_descriptions: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Extract custom fields from text."""
        schema = {}
        instructions_parts = ["Extract the following information:"]
        
        for field in extraction_fields:
            schema[field] = "string"
            if field_descriptions and field in field_descriptions:
                instructions_parts.append(f"- {field}: {field_descriptions[field]}")
            else:
                instructions_parts.append(f"- {field}")
        
        instructions = "\n".join(instructions_parts)
        
        return super()._run(
            input_data=text_content,
            output_schema=schema,
            instructions=instructions
        )


# Helper functions for CrewAI integration
def create_parsing_agent(api_key: str, tools: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Create a CrewAI agent configuration with Parserator tools.
    
    Args:
        api_key: Parserator API key
        tools: List of tool types to include ('email', 'document', 'contact', 'general')
        
    Returns:
        Dictionary with agent configuration
    """
    if tools is None:
        tools = ['general']
    
    agent_tools = []
    
    for tool_type in tools:
        if tool_type == 'email':
            agent_tools.append(EmailParserTool(api_key=api_key))
        elif tool_type == 'document':
            agent_tools.append(DocumentParserTool(api_key=api_key))
        elif tool_type == 'contact':
            agent_tools.append(ContactParserTool(api_key=api_key))
        elif tool_type == 'general':
            agent_tools.append(ParseratorTool(api_key=api_key))
        elif tool_type == 'extractor':
            agent_tools.append(DataExtractionTool(api_key=api_key))
    
    return {
        "role": "Data Parser Agent",
        "goal": "Parse and structure unstructured data accurately",
        "backstory": "Expert at converting messy, unstructured text into clean, structured data using advanced AI parsing techniques.",
        "tools": agent_tools,
        "verbose": True
    }


def create_parsing_task(description: str, expected_output: str) -> Dict[str, Any]:
    """
    Create a CrewAI task configuration for data parsing.
    
    Args:
        description: Task description
        expected_output: Description of expected output format
        
    Returns:
        Dictionary with task configuration
    """
    return {
        "description": description,
        "expected_output": expected_output,
        "tools_to_use": ["parserator", "email_parser", "document_parser", "contact_parser"]
    }