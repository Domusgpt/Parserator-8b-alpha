"""Command line interface for the Parserator Python SDK."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import ParseratorClient
from .errors import ParseratorError
from .types import ParseOptions, ParseResponse, ValidationType
from .utils import validate_schema


class CLIError(Exception):
    """Error raised for invalid user input to the CLI."""


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="parserator",
        description="Interact with the Parserator API from the command line.",
    )
    parser.add_argument(
        "input_text",
        nargs="?",
        help="Text to parse. If omitted, --input-file or stdin must be provided.",
    )
    parser.add_argument(
        "--schema",
        required=True,
        help="Path to a JSON file describing the desired output schema.",
    )
    parser.add_argument(
        "--input-file",
        help="Path to a file containing text to parse.",
    )
    parser.add_argument(
        "--instructions",
        help="Optional additional instructions forwarded to the Parserator API.",
    )
    parser.add_argument(
        "--api-key",
        help="Parserator API key. Falls back to the environment variable if omitted.",
    )
    parser.add_argument(
        "--env-var",
        default="PARSERATOR_API_KEY",
        help="Environment variable that stores the API key when --api-key is not supplied.",
    )
    parser.add_argument(
        "--validation",
        choices=[choice.value for choice in ValidationType],
        help="Validation strategy for parsing results.",
    )
    parser.add_argument("--locale", help="Locale hint forwarded to the API.")
    parser.add_argument("--timezone", help="Timezone hint forwarded to the API.")
    parser.add_argument(
        "--max-retries",
        type=int,
        help="Maximum number of automatic retries performed by the API.",
    )
    parser.add_argument(
        "--include-metadata",
        action="store_true",
        help="Include response metadata in the printed JSON output.",
    )
    return parser


def _load_input_text(args: argparse.Namespace) -> str:
    if args.input_file:
        path = Path(args.input_file)
        if not path.is_file():
            raise CLIError(f"Input file '{path}' does not exist.")
        return path.read_text(encoding="utf-8")

    if args.input_text is not None:
        return args.input_text

    if not sys.stdin.isatty():
        streamed = sys.stdin.read()
        if streamed:
            return streamed

    raise CLIError(
        "No input text provided. Supply text as an argument, use --input-file, or pipe via stdin."
    )


def _load_schema(path_str: str) -> Dict[str, Any]:
    path = Path(path_str)
    if not path.is_file():
        raise CLIError(f"Schema file '{path}' does not exist.")

    try:
        schema_payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:  # pragma: no cover - defensive
        raise CLIError(f"Failed to decode JSON schema: {exc}") from exc

    if not isinstance(schema_payload, dict):
        raise CLIError("Schema file must contain a JSON object describing the schema.")

    validate_schema(schema_payload)
    return schema_payload


def _build_options(args: argparse.Namespace) -> Optional[ParseOptions]:
    option_kwargs: Dict[str, Any] = {}
    if args.validation:
        option_kwargs["validation"] = args.validation
    if args.locale:
        option_kwargs["locale"] = args.locale
    if args.timezone:
        option_kwargs["timezone"] = args.timezone
    if args.max_retries is not None:
        option_kwargs["max_retries"] = args.max_retries

    if not option_kwargs:
        return None
    return ParseOptions(**option_kwargs)


def _create_client(args: argparse.Namespace) -> ParseratorClient:
    if args.api_key:
        return ParseratorClient(api_key=args.api_key)
    try:
        return ParseratorClient.from_env(env_var=args.env_var)
    except ValueError as exc:  # pragma: no cover - defensive
        raise CLIError(str(exc)) from exc


def _format_output(response: ParseResponse, include_metadata: bool) -> str:
    payload: Dict[str, Any] = {"data": response.parsed_data or {}}
    if include_metadata:
        payload["metadata"] = response.metadata.raw or {}
    return json.dumps(payload, indent=2, sort_keys=True)


def run(args: argparse.Namespace) -> int:
    input_text = _load_input_text(args)
    schema = _load_schema(args.schema)
    options = _build_options(args)
    client = _create_client(args)

    response = client.parse(
        input_data=input_text,
        output_schema=schema,
        instructions=args.instructions,
        options=options,
    )

    if not response.success:
        message = response.error_message or "Parserator request failed."
        raise CLIError(message)

    print(_format_output(response, args.include_metadata))
    return 0


def main(argv: Optional[List[str]] = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    try:
        return run(args)
    except CLIError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    except ParseratorError as exc:
        print(f"Parserator API error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:  # pragma: no cover - interactive safeguard
        print("Aborted by user.", file=sys.stderr)
        return 130


if __name__ == "__main__":  # pragma: no cover - manual execution
    raise SystemExit(main())
