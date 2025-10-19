"""Utility helpers for the Parserator Python SDK."""

from __future__ import annotations

from typing import Any, Iterable, List, Mapping, MutableMapping, Sequence

from .errors import ValidationError
from .types import SchemaValidationError, SchemaValidationResult

try:  # pragma: no cover - optional dependency
    import pandas as pd
except Exception:  # pragma: no cover - optional dependency
    pd = None  # type: ignore[assignment]

try:  # pragma: no cover - optional dependency
    import polars as pl
except Exception:  # pragma: no cover - optional dependency
    pl = None  # type: ignore[assignment]

try:  # pragma: no cover - optional dependency
    import numpy as np
except Exception:  # pragma: no cover - optional dependency
    np = None  # type: ignore[assignment]


if pd is not None:  # pragma: no cover - optional dependency
    DataFrame = pd.DataFrame
    Series = pd.Series
else:  # pragma: no cover - optional dependency
    DataFrame = Any  # type: ignore[assignment]
    Series = Any  # type: ignore[assignment]


def validate_api_key(api_key: str) -> str:
    """Ensure an API key looks valid before sending it to the API."""

    if not isinstance(api_key, str) or not api_key.strip():
        raise ValidationError("API key must be a non-empty string")
    return api_key.strip()


def validate_input_data(input_data: str) -> str:
    """Validate raw unstructured data before submitting a parse request."""

    if not isinstance(input_data, str) or not input_data.strip():
        raise ValidationError("Input data must be a non-empty string")
    return input_data


def validate_schema(schema: Mapping[str, Any]) -> SchemaValidationResult:
    """Perform lightweight local validation of an output schema."""

    errors: List[SchemaValidationError] = []
    suggestions: List[str] = []

    if not isinstance(schema, Mapping):
        errors.append(
            SchemaValidationError(
                path="",
                message="Schema must be a mapping of field names to definitions",
                severity="error",
            )
        )
        return SchemaValidationResult(valid=False, errors=errors, suggestions=["Provide a dictionary schema"])

    if not schema:
        errors.append(
            SchemaValidationError(
                path="",
                message="Schema cannot be empty",
                severity="error",
            )
        )

    for key, value in schema.items():
        if not isinstance(key, str) or not key.strip():
            errors.append(
                SchemaValidationError(
                    path=str(key),
                    message="Schema keys must be non-empty strings",
                    severity="error",
                )
            )
        if value is None:
            errors.append(
                SchemaValidationError(
                    path=key,
                    message="Schema values cannot be null",
                    severity="error",
                )
            )

    if errors:
        suggestions.append("Review schema keys and values for correctness")

    return SchemaValidationResult(valid=not errors, errors=errors, suggestions=suggestions)


def to_pandas(rows: Sequence[Mapping[str, Any]]):
    """Convert a sequence of dictionaries into a :mod:`pandas` DataFrame."""

    if pd is None:  # pragma: no cover - optional dependency
        raise ImportError("pandas is not installed; install parserator-sdk[data-science]")
    return pd.DataFrame(list(rows))


def from_pandas(frame) -> List[MutableMapping[str, Any]]:
    """Convert a DataFrame into a list of dictionaries."""

    if pd is None:  # pragma: no cover - optional dependency
        raise ImportError("pandas is not installed; install parserator-sdk[data-science]")
    return frame.to_dict(orient="records")


def to_polars(rows: Sequence[Mapping[str, Any]]):
    """Convert a sequence of dictionaries to a :mod:`polars` DataFrame."""

    if pl is None:  # pragma: no cover - optional dependency
        raise ImportError("polars is not installed; install parserator-sdk[data-science]")
    return pl.DataFrame(list(rows))


def from_polars(frame) -> List[MutableMapping[str, Any]]:
    """Convert a Polars DataFrame to a list of dictionaries."""

    if pl is None:  # pragma: no cover - optional dependency
        raise ImportError("polars is not installed; install parserator-sdk[data-science]")
    return frame.to_dicts()


def to_numpy(rows: Sequence[Mapping[str, Any]]):
    """Convert rows to a :mod:`numpy` array."""

    if np is None:  # pragma: no cover - optional dependency
        raise ImportError("numpy is not installed; install parserator-sdk[data-science]")
    return np.array(list(rows))


__all__ = [
    "DataFrame",
    "Series",
    "from_pandas",
    "from_polars",
    "to_numpy",
    "to_pandas",
    "to_polars",
    "validate_api_key",
    "validate_input_data",
    "validate_schema",
]
