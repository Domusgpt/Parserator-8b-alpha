"""Parserator Python SDK - Intelligent data parsing using the Architect-Extractor pattern.

Transform any unstructured data into clean, structured JSON with AI-powered precision.
The Parserator SDK implements a sophisticated two-stage LLM approach that maximizes
accuracy while minimizing token costs.

Example:
    Basic usage:

    >>> from parserator import ParseratorClient
    >>> client = ParseratorClient(api_key="pk_live_...")
    >>> result = client.parse(
    ...     input_data="John Smith, john@example.com, (555) 123-4567",
    ...     output_schema={"name": "string", "email": "email", "phone": "phone"}
    ... )
    >>> print(result.parsed_data)
    {'name': 'John Smith', 'email': 'john@example.com', 'phone': '(555) 123-4567'}

    Quick parse helper (runs the blocking client call in a background thread):

    >>> from parserator import quick_parse
    >>> result = await quick_parse(
    ...     "pk_live_...",
    ...     "Contact info: Jane Doe, jane@company.com",
    ...     {"name": "string", "email": "email"}
    ... )
"""

from __future__ import annotations

import asyncio
from dataclasses import replace

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


def _merge_parse_options(
    base: ParseOptions | None, overrides: dict[str, object]
) -> ParseOptions | None:
    """Merge keyword overrides into a :class:`ParseOptions` instance."""

    if not overrides:
        return base

    valid_keys = {"validation", "locale", "timezone", "max_retries"}
    filtered = {k: v for k, v in overrides.items() if k in valid_keys}
    if not filtered:
        return base
    if base is None:
        return ParseOptions(**filtered)
    return replace(base, **filtered)


async def quick_parse(
    api_key: str,
    input_data: str,
    output_schema: dict,
    instructions: str | None = None,
    *,
    client: ParseratorClient | None = None,
    options: ParseOptions | None = None,
    **option_overrides,
) -> ParseResponse:
    """Quick parse helper that executes in a background thread.

    Args:
        api_key: Your Parserator API key
        input_data: The unstructured data to parse
        output_schema: Desired JSON structure
        instructions: Optional additional context
        client: Optional pre-configured :class:`ParseratorClient`
        options: Base :class:`ParseOptions` instance to use
        **option_overrides: Keyword overrides applied to ``options``

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

    parse_options = _merge_parse_options(options, option_overrides)
    parser_client = client or ParseratorClient(api_key=api_key)

    return await asyncio.to_thread(
        parser_client.parse,
        input_data=input_data,
        output_schema=output_schema,
        instructions=instructions,
        options=parse_options,
    )


# Convenience imports for common data science workflows
try:
    import pandas as pd

    async def parse_dataframe(
        api_key: str,
        df: "pd.DataFrame",
        text_column: str,
        output_schema: dict,
        *,
        instructions: str | None = None,
        options: ParseOptions | None = None,
        batch_options: BatchOptions | None = None,
        client: ParseratorClient | None = None,
    ) -> "pd.DataFrame":
        """Parse text data from a pandas DataFrame column.

        Args:
            api_key: Your Parserator API key
            df: Source DataFrame
            text_column: Column containing text to parse
            output_schema: Desired structure for parsed data
            instructions: Optional shared instructions for each request
            options: Optional :class:`ParseOptions` applied to each request
            batch_options: Optional :class:`BatchOptions` forwarded to ``batch_parse``
            client: Optional pre-configured :class:`ParseratorClient`

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

        parser_client = client or ParseratorClient(api_key=api_key)
        text_series = df[text_column]

        requests = [
            ParseRequest(
                input_data=str(value),
                output_schema=output_schema,
                instructions=instructions,
                options=options,
            )
            for value in text_series
        ]

        batch_kwargs: dict[str, BatchOptions] = {}
        if batch_options is not None:
            batch_kwargs["options"] = batch_options

        batch_response = await asyncio.to_thread(
            parser_client.batch_parse,
            requests,
            **batch_kwargs,
        )

        parsed_rows = [
            response.parsed_data or {}
            for response in batch_response.results
        ]

        result_df = df.copy()
        parsed_df = pd.DataFrame(parsed_rows)

        for column in parsed_df.columns:
            result_df[f"parsed_{column}"] = parsed_df[column]

        return result_df
    
    __all__.append("parse_dataframe")
    
except ImportError:
    # pandas/numpy not available
    pass
