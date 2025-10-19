from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import pytest

SRC_PATH = Path(__file__).resolve().parents[1] / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))

from parserator.cli import main as cli_main  # noqa: E402
from parserator.types import ParseMetadata, ParseResponse  # noqa: E402


class DummyClient:
    calls = []

    def __init__(self, api_key: str, **kwargs):
        self.api_key = api_key
        self.kwargs = kwargs

    def parse(self, *, input_data, output_schema, instructions=None, options=None):
        self.__class__.calls.append(
            {
                "api_key": self.api_key,
                "input_data": input_data,
                "output_schema": output_schema,
                "instructions": instructions,
                "options": options,
            }
        )
        return ParseResponse(
            success=True,
            parsed_data={"name": "Alice"},
            metadata=ParseMetadata(raw={"requestId": "req_123"}),
        )

    @classmethod
    def from_env(cls, *, env_var: str = "PARSERATOR_API_KEY", **kwargs):
        api_key = os.getenv(env_var)
        if not api_key:
            raise ValueError(
                f"Environment variable '{env_var}' must be set to a Parserator API key."
            )
        return cls(api_key, **kwargs)


@pytest.fixture(autouse=True)
def _reset_dummy_client():
    DummyClient.calls.clear()
    yield
    DummyClient.calls.clear()


def test_cli_parses_input(monkeypatch, tmp_path, capsys):
    monkeypatch.setenv("PARSERATOR_API_KEY", "pk_test_cli")
    schema_file = tmp_path / "schema.json"
    schema_file.write_text(json.dumps({"name": "string"}), encoding="utf-8")

    monkeypatch.setattr("parserator.cli.ParseratorClient", DummyClient)

    exit_code = cli_main(["--schema", str(schema_file), "Alice from Wonderland"])

    captured = capsys.readouterr()

    assert exit_code == 0
    payload = json.loads(captured.out)
    assert payload["data"] == {"name": "Alice"}
    assert DummyClient.calls[0]["input_data"] == "Alice from Wonderland"


def test_cli_errors_without_api_key(monkeypatch, tmp_path, capsys):
    monkeypatch.delenv("PARSERATOR_API_KEY", raising=False)
    schema_file = tmp_path / "schema.json"
    schema_file.write_text(json.dumps({"name": "string"}), encoding="utf-8")

    monkeypatch.setattr("parserator.cli.ParseratorClient", DummyClient)

    exit_code = cli_main(["--schema", str(schema_file), "Sample text"])

    captured = capsys.readouterr()

    assert exit_code == 1
    assert "error:" in captured.err
    assert DummyClient.calls == []
