"""Parserator Python SDK - Intelligent data parsing using the Architect-Extractor pattern.

Transform any unstructured data into clean, structured JSON with AI-powered precision.
The Parserator SDK implements a sophisticated two-stage LLM approach that maximizes
accuracy while minimizing token costs.

Example:
    Basic usage:

    >>> from parserator import ParseratorClient
    >>> client = ParseratorClient(api_key="pk_live_...")
    >>> result = await client.parse(
    ...     input_data="John Smith, john@example.com, (555) 123-4567",
    ...     output_schema={"name": "string", "email": "email", "phone": "phone"}
    ... )
    >>> print(result.parsed_data)
    {'name': 'John Smith', 'email': 'john@example.com', 'phone': '(555) 123-4567'}

    Quick parse helper:

    >>> from parserator import quick_parse
    >>> result = await quick_parse(
    ...     "pk_live_...",
    ...     "Contact info: Jane Doe, jane@company.com",
    ...     {"name": "string", "email": "email"}
    ... )
"""

from __future__ import annotations

import inspect

from .client import ParseratorClient
from .types import (
    ParseRequest,
    ParseResponse,
    ParseOptions,
    ParseMetadata,
    ParseratorConfig,
    BatchParseRequest,
    BatchParseResponse,
    BatchOptions,
    SearchStep,
    SearchPlan,
    ValidationType,
    ParseError,
    ErrorCode,
    SchemaValidationResult,
    ParsePreset,
)
from .errors import (
    ParseratorError,
    ValidationError,
    AuthenticationError,
    RateLimitError,
    QuotaExceededError,
    NetworkError,
    TimeoutError,
    ParseFailedError,
    ServiceUnavailableError,
)
from .presets import (
    EMAIL_PARSER,
    INVOICE_PARSER,
    CONTACT_PARSER,
    CSV_PARSER,
    LOG_PARSER,
    DOCUMENT_PARSER,
    ALL_PRESETS,
    get_preset_by_name,
    list_available_presets,
)
from .utils import (
    validate_api_key,
    validate_schema,
    validate_input_data,
    DataFrame,
    Series,
    to_pandas,
    to_polars,
    to_numpy,
    from_pandas,
    from_polars,
)

__version__ = "1.0.0"
__author__ = "Paul Phillips"
__email__ = "phillips.paul.email@gmail.com"
__license__ = "PROPRIETARY"

# Re-export main client as default
__all__ = [
    # Core client
    "ParseratorClient",
    
    # Types
    "ParseRequest",
    "ParseResponse", 
    "ParseOptions",
    "ParseMetadata",
    "ParseratorConfig",
    "BatchParseRequest",
    "BatchParseResponse",
    "BatchOptions",
    "SearchStep",
    "SearchPlan",
    "ValidationType",
    "ParseError",
    "ErrorCode",
    "SchemaValidationResult",
    "ParsePreset",
    
    # Errors
    "ParseratorError",
    "ValidationError",
    "AuthenticationError",
    "RateLimitError",
    "QuotaExceededError",
    "NetworkError",
    "TimeoutError",
    "ParseFailedError",
    "ServiceUnavailableError",
    
    # Presets
    "EMAIL_PARSER",
    "INVOICE_PARSER",
    "CONTACT_PARSER",
    "CSV_PARSER",
    "LOG_PARSER",
    "DOCUMENT_PARSER",
    "ALL_PRESETS",
    "get_preset_by_name",
    "list_available_presets",
    
    # Utilities
    "validate_api_key",
    "validate_schema",
    "validate_input_data",
    "DataFrame",
    "Series",
    "to_pandas",
    "to_polars",
    "to_numpy",
    "from_pandas",
    "from_polars",
    
    # Quick helpers
    "quick_parse",
    "create_client",
]


def create_client(api_key: str, **kwargs) -> ParseratorClient:
    """Create a new Parserator client instance.
    
    Args:
        api_key: Your Parserator API key
        **kwargs: Additional configuration options
        
    Returns:
        Configured ParseratorClient instance
        
    Example:
        >>> client = create_client("pk_live_...")
        >>> result = await client.parse(...)
    """
    return ParseratorClient(api_key=api_key, **kwargs)


async def quick_parse(
    api_key: str,
    input_data: str,
    output_schema: dict,
    instructions: str = None,
    **options
) -> ParseResponse:
    """Quick parse function for simple use cases.
    
    Args:
        api_key: Your Parserator API key
        input_data: The unstructured data to parse
        output_schema: Desired JSON structure
        instructions: Optional additional context
        **options: Additional parse options
        
    Returns:
        ParseResponse with parsed data and metadata
        
    Example:
        >>> result = await quick_parse(
        ...     "pk_live_...",
        ...     "John Smith, Software Engineer, john@example.com",
        ...     {"name": "string", "title": "string", "email": "email"}
        ... )
        >>> print(result.parsed_data)
    """
    client = ParseratorClient(api_key=api_key)
    result = client.parse(
        input_data=input_data,
        output_schema=output_schema,
        instructions=instructions,
        options=ParseOptions(**options) if options else None,
    )
    if inspect.isawaitable(result):
        return await result
    return result


# Convenience imports for common data science workflows
try:
    import pandas as pd
    import numpy as np
    
    async def parse_dataframe(
        api_key: str,
        df: "pd.DataFrame",
        text_column: str,
        output_schema: dict,
        **kwargs
    ) -> "pd.DataFrame":
        """Parse text data from a pandas DataFrame column.
        
        Args:
            api_key: Your Parserator API key
            df: Source DataFrame
            text_column: Column containing text to parse
            output_schema: Desired structure for parsed data
            **kwargs: Additional options
            
        Returns:
            DataFrame with parsed data as new columns
            
        Example:
            >>> df = pd.DataFrame({'text': ['John Smith, john@example.com']})
            >>> result_df = await parse_dataframe(
            ...     "pk_live_...",
            ...     df,
            ...     'text',
            ...     {'name': 'string', 'email': 'email'}
            ... )
        """
        client = ParseratorClient(api_key=api_key)
        
        # Create batch request from DataFrame
        batch_items = [
            ParseRequest(
                input_data=str(row[text_column]),
                output_schema=output_schema,
                **kwargs
            )
            for _, row in df.iterrows()
        ]
        
        # Process batch
        batch_result = await client.batch_parse(
            BatchParseRequest(items=batch_items)
        )
        
        # Convert results back to DataFrame
        parsed_data = []
        for i, result in enumerate(batch_result.results):
            if hasattr(result, 'parsed_data'):
                parsed_data.append(result.parsed_data)
            else:
                parsed_data.append({})
        
        # Create new DataFrame with parsed columns
        result_df = df.copy()
        parsed_df = pd.DataFrame(parsed_data)
        
        # Add parsed columns with prefix
        for col in parsed_df.columns:
            result_df[f'parsed_{col}'] = parsed_df[col]
            
        return result_df
    
    __all__.append("parse_dataframe")
    
except ImportError:
    # pandas/numpy not available
    pass
