"""
LangChain Integration for Parserator
Provides output parser for LangChain agents and chains
"""

import asyncio
import inspect
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field

try:
    from langchain.schema import BaseOutputParser
    from langchain.schema.output_parser import OutputParserException
    LANGCHAIN_AVAILABLE = True
except ImportError:
    LANGCHAIN_AVAILABLE = False
    BaseOutputParser = object
    OutputParserException = Exception

from ..client import ParseratorClient

class ParseratorOutputParser(BaseOutputParser):
    """
    LangChain output parser using Parserator's two-stage parsing engine.
    
    Converts unstructured LLM output into structured data using Parserator's
    Architect-Extractor pattern for high accuracy and token efficiency.
    
    Example:
        ```python
        from parserator.integrations.langchain import ParseratorOutputParser
        
        # Define your desired output structure
        schema = {
            "summary": "string",
            "key_points": "array", 
            "sentiment": "string",
            "action_items": "array"
        }
        
        parser = ParseratorOutputParser(
            api_key="your_api_key",
            output_schema=schema
        )
        
        # Use in LangChain chain
        from langchain.llms import OpenAI
        from langchain.chains import LLMChain
        from langchain.prompts import PromptTemplate
        
        prompt = PromptTemplate(
            input_variables=["text"],
            template="Analyze this text: {text}"
        )
        
        llm = OpenAI()
        chain = LLMChain(
            llm=llm,
            prompt=prompt,
            output_parser=parser
        )
        
        result = chain.run("Your unstructured text here...")
        # Returns structured dict according to your schema
        ```
    """
    
    api_key: str = Field(description="Parserator API key")
    output_schema: Dict[str, Any] = Field(description="Desired output structure")
    instructions: Optional[str] = Field(default=None, description="Additional parsing instructions")
    base_url: Optional[str] = Field(default=None, description="Custom API base URL")
    
    def __init__(
        self,
        api_key: str,
        output_schema: Dict[str, Any],
        instructions: Optional[str] = None,
        base_url: Optional[str] = None,
        **kwargs
    ):
        if not LANGCHAIN_AVAILABLE:
            raise ImportError(
                "LangChain is not installed. Install it with: pip install langchain"
            )
            
        super().__init__(
            api_key=api_key,
            output_schema=output_schema,
            instructions=instructions,
            base_url=base_url,
            **kwargs
        )
        
        self.client = ParseratorClient(
            api_key=api_key,
            base_url=base_url
        )
    
    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse unstructured text into structured data.
        
        Args:
            text: Raw unstructured text to parse
            
        Returns:
            Structured data according to output_schema
            
        Raises:
            OutputParserException: If parsing fails
        """
        try:
            result = self.client.parse(
                input_data=text,
                output_schema=self.output_schema,
                instructions=self.instructions
            )
            if inspect.isawaitable(result):
                try:
                    asyncio.get_running_loop()
                except RuntimeError:
                    result = asyncio.run(result)
                else:  # pragma: no cover - defensive
                    raise RuntimeError(
                        "ParseratorOutputParser.parse cannot be used inside an active event loop; "
                        "await the client.parse coroutine instead."
                    )

            if not result.success:
                raise OutputParserException(
                    f"Parserator parsing failed: {result.error_message}"
                )
                
            return result.parsed_data
            
        except Exception as e:
            raise OutputParserException(f"Failed to parse with Parserator: {str(e)}")
    
    def get_format_instructions(self) -> str:
        """
        Return format instructions for the LLM.
        
        Note: With Parserator, you don't need to instruct the LLM about format.
        Parserator handles any unstructured output and converts it to your schema.
        """
        return (
            "Please provide a comprehensive response. The output will be automatically "
            "parsed and structured using Parserator's intelligent parsing engine."
        )
    
    @property
    def _type(self) -> str:
        """Return the type key."""
        return "parserator"


class ParseratorChainOutputParser(ParseratorOutputParser):
    """
    Enhanced output parser for complex LangChain workflows.
    
    Supports multiple parsing strategies and automatic retry logic.
    """
    
    retry_attempts: int = Field(default=2, description="Number of retry attempts on failure")
    fallback_schema: Optional[Dict[str, Any]] = Field(default=None, description="Fallback schema if primary fails")
    
    def __init__(
        self,
        api_key: str,
        output_schema: Dict[str, Any],
        retry_attempts: int = 2,
        fallback_schema: Optional[Dict[str, Any]] = None,
        **kwargs
    ):
        super().__init__(
            api_key=api_key,
            output_schema=output_schema,
            **kwargs
        )
        self.retry_attempts = retry_attempts
        self.fallback_schema = fallback_schema
    
    def parse(self, text: str) -> Dict[str, Any]:
        """Parse with retry logic and fallback schema."""
        last_error = None
        
        # Try primary schema with retries
        for attempt in range(self.retry_attempts + 1):
            try:
                return super().parse(text)
            except OutputParserException as e:
                last_error = e
                if attempt < self.retry_attempts:
                    continue
                break
        
        # Try fallback schema if available
        if self.fallback_schema:
            try:
                result = self.client.parse(
                    input_data=text,
                    output_schema=self.fallback_schema,
                    instructions=self.instructions
                )
                
                if result.success:
                    return result.parsed_data
                    
            except Exception as fallback_error:
                pass
        
        # All attempts failed
        raise OutputParserException(
            f"All parsing attempts failed. Last error: {last_error}"
        )


class ParseratorListOutputParser(ParseratorOutputParser):
    """
    Specialized parser for extracting lists and arrays from text.
    
    Automatically optimizes schema for list extraction.
    """
    
    item_schema: Dict[str, Any] = Field(description="Schema for individual list items")
    list_key: str = Field(default="items", description="Key name for the extracted list")
    
    def __init__(
        self,
        api_key: str,
        item_schema: Dict[str, Any],
        list_key: str = "items",
        **kwargs
    ):
        # Build optimized schema for list extraction
        output_schema = {
            list_key: "array",
            "total_count": "number"
        }
        
        super().__init__(
            api_key=api_key,
            output_schema=output_schema,
            **kwargs
        )
        
        self.item_schema = item_schema
        self.list_key = list_key
    
    def parse(self, text: str) -> List[Dict[str, Any]]:
        """Parse and return the extracted list directly."""
        result = super().parse(text)
        return result.get(self.list_key, [])


# Helper functions for common use cases
def create_email_parser(api_key: str) -> ParseratorOutputParser:
    """Create a pre-configured parser for email content."""
    schema = {
        "sender": "string",
        "recipient": "string", 
        "subject": "string",
        "date": "string",
        "body_summary": "string",
        "action_items": "array",
        "mentioned_people": "array",
        "important_dates": "array"
    }
    
    return ParseratorOutputParser(
        api_key=api_key,
        output_schema=schema,
        instructions="Extract key information from email content"
    )


def create_document_parser(api_key: str) -> ParseratorOutputParser:
    """Create a pre-configured parser for document analysis."""
    schema = {
        "title": "string",
        "document_type": "string",
        "key_topics": "array",
        "summary": "string", 
        "important_figures": "array",
        "conclusions": "array",
        "next_steps": "array"
    }
    
    return ParseratorOutputParser(
        api_key=api_key,
        output_schema=schema,
        instructions="Analyze document content and extract structured information"
    )


def create_research_parser(api_key: str) -> ParseratorOutputParser:
    """Create a pre-configured parser for research content."""
    schema = {
        "findings": "array",
        "methodology": "string",
        "conclusions": "array",
        "limitations": "array", 
        "references": "array",
        "statistical_data": "array"
    }
    
    return ParseratorOutputParser(
        api_key=api_key,
        output_schema=schema,
        instructions="Extract research findings and methodology information"
    )