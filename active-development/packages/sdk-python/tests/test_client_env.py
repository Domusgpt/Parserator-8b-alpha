from __future__ import annotations

import sys
from pathlib import Path

import pytest

SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from parserator import ParseratorClient  # noqa: E402


def test_from_env_reads_api_key(monkeypatch):
    monkeypatch.setenv("PARSERATOR_API_KEY", "pk_test_env123")

    client = ParseratorClient.from_env()

    assert client.config.api_key == "pk_test_env123"


def test_from_env_missing_raises(monkeypatch):
    monkeypatch.delenv("PARSERATOR_API_KEY", raising=False)

    with pytest.raises(ValueError):
        ParseratorClient.from_env()


def test_from_env_custom_variable(monkeypatch):
    monkeypatch.setenv("CUSTOM_KEY", "pk_test_custom")

    client = ParseratorClient.from_env(env_var="CUSTOM_KEY", timeout=5)

    assert client.config.api_key == "pk_test_custom"
    assert client.config.timeout == 5
