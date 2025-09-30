"""Smoke tests ensuring the integration modules import successfully."""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

PACKAGE_ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = PACKAGE_ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))


def _import_module(name: str):
    module = importlib.import_module(name)
    return module


def test_langchain_integration_imports():
    module = _import_module("parserator.integrations.langchain")
    assert hasattr(module, "ParseratorOutputParser")


def test_crewai_integration_imports():
    module = _import_module("parserator.integrations.crewai")
    assert hasattr(module, "ParseratorTool")


def test_autogpt_integration_imports():
    module = _import_module("parserator.integrations.autogpt")
    assert hasattr(module, "ParseratorPlugin")
