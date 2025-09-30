"""Utility helpers used across the Parserator SDK."""
from __future__ import annotations

from typing import Any, Iterable, Sequence

try:  # pragma: no cover - optional dependency
    import pandas as _pd
except ImportError:  # pragma: no cover - optional dependency
    _pd = None

try:  # pragma: no cover - optional dependency
    import polars as _pl
except ImportError:  # pragma: no cover - optional dependency
    _pl = None

try:  # pragma: no cover - optional dependency
    import numpy as _np
except ImportError:  # pragma: no cover - optional dependency
    _np = None


DataFrame = _pd.DataFrame if _pd else Any  # type: ignore[assignment]
Series = _pd.Series if _pd else Any  # type: ignore[assignment]


def validate_api_key(api_key: str) -> None:
    """Basic sanity checking for Parserator API keys."""

    if not isinstance(api_key, str) or not api_key.strip():
        raise ValueError("A non-empty Parserator API key is required.")
    if not api_key.startswith("pk_"):
        raise ValueError("Parserator API keys must start with 'pk_'.")


def validate_schema(schema: Any) -> None:
    """Ensure the provided schema is a dictionary-like structure."""

    if not isinstance(schema, dict):
        raise ValueError("Output schema must be a dictionary of field definitions.")


def validate_input_data(input_data: Any) -> None:
    """Ensure the provided input data is a string."""

    if not isinstance(input_data, str) or not input_data.strip():
        raise ValueError("Input data must be a non-empty string.")


def to_pandas(rows: Sequence[dict]) -> Any:
    """Convert an iterable of dictionaries into a pandas DataFrame."""

    if _pd is None:  # pragma: no cover - environment dependent
        raise RuntimeError("pandas is required for to_pandas but is not installed.")
    return _pd.DataFrame(rows)


def to_polars(rows: Sequence[dict]) -> Any:
    """Convert an iterable of dictionaries into a polars DataFrame."""

    if _pl is None:  # pragma: no cover - environment dependent
        raise RuntimeError("polars is required for to_polars but is not installed.")
    return _pl.DataFrame(rows)


def to_numpy(values: Iterable[Any]) -> Any:
    """Convert an iterable into a numpy array."""

    if _np is None:  # pragma: no cover - environment dependent
        raise RuntimeError("numpy is required for to_numpy but is not installed.")
    return _np.asarray(list(values))


def from_pandas(frame: Any) -> Sequence[dict]:
    """Convert a pandas DataFrame into a list of dictionaries."""

    if _pd is None or not isinstance(frame, _pd.DataFrame):  # pragma: no cover - env dependent
        raise RuntimeError("from_pandas requires a pandas DataFrame instance.")
    return frame.to_dict(orient="records")


def from_polars(frame: Any) -> Sequence[dict]:
    """Convert a polars DataFrame into a list of dictionaries."""

    if _pl is None or not isinstance(frame, _pl.DataFrame):  # pragma: no cover - env dependent
        raise RuntimeError("from_polars requires a polars DataFrame instance.")
    return frame.to_dicts()


__all__ = [
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
]
