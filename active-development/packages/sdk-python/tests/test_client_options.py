"""Tests covering ParseOptions merging behaviour inside ParseratorClient."""
from __future__ import annotations

import sys
import types
from pathlib import Path
from typing import Optional

import pytest

SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from parserator import (
    LeanLLMRuntimeOptions,
    ParseOptions,
    ParseratorClient,
    ValidationType,
)


def make_client(default: Optional[ParseOptions] = None) -> ParseratorClient:
    client = ParseratorClient("pk_test_123", default_options=default)
    client._request = types.MethodType(  # type: ignore[assignment]
        lambda self, method, path, payload: (200, b"{}", {}),
        client,
    )
    return client


def test_default_options_used_when_override_not_explicit() -> None:
    default = ParseOptions(validation=ValidationType.LENIENT, timezone="UTC")
    client = make_client(default)

    resolved = client._merge_options(ParseOptions(locale="fr-FR"))

    assert resolved is not None
    assert resolved.validation is ValidationType.LENIENT
    assert resolved.locale == "fr-FR"
    assert resolved.timezone == "UTC"


def test_override_can_force_validation_back_to_strict() -> None:
    default = ParseOptions(validation=ValidationType.LENIENT)
    client = make_client(default)

    override = ParseOptions(validation=ValidationType.STRICT)
    resolved = client._merge_options(override)

    assert resolved is not None
    assert resolved.validation is ValidationType.STRICT


def test_override_without_defaults_returns_original_object() -> None:
    client = make_client(None)
    override = ParseOptions(locale="en-US", max_retries=5)

    resolved = client._merge_options(override)

    assert resolved is override


def test_explicit_fields_recorded() -> None:
    opts = ParseOptions(locale="es-ES", max_retries=4)
    assert opts.explicit_fields == frozenset({"locale", "max_retries"})


def test_invalid_validation_string_raises_value_error() -> None:
    with pytest.raises(ValueError):
        ParseOptions(validation="unknown-mode")


def test_negative_max_retries_raises_value_error() -> None:
    with pytest.raises(ValueError):
        ParseOptions(max_retries=-1)


def test_resolve_options_includes_lean_runtime_payload() -> None:
    client = make_client()
    options = ParseOptions(
        lean_llm=LeanLLMRuntimeOptions(disabled=True, max_invocations_per_parse=2),
        validation=ValidationType.STRICT,
    )

    payload = client._resolve_options(options)

    assert payload["leanLLM"]["disabled"] is True
    assert payload["leanLLM"]["maxInvocationsPerParse"] == 2


def test_merge_options_preserves_default_lean_overrides() -> None:
    default = ParseOptions(
        lean_llm=LeanLLMRuntimeOptions(max_tokens_per_parse=150, default_confidence=0.65)
    )
    override = ParseOptions(lean_llm=LeanLLMRuntimeOptions(disabled=True))

    client = make_client(default)
    merged = client._merge_options(override)

    assert merged is not None
    assert merged.lean_llm is not None
    assert merged.lean_llm.disabled is True
    assert merged.lean_llm.max_tokens_per_parse == 150
    assert merged.lean_llm.default_confidence == pytest.approx(0.65)


def test_parse_options_accepts_lean_llm_dict() -> None:
    options = ParseOptions(lean_llm={"planConfidenceGate": 0.4, "allowOptionalFields": True})

    assert options.lean_llm is not None
    assert options.lean_llm.plan_confidence_gate == pytest.approx(0.4)
    assert options.lean_llm.allow_optional_fields is True
