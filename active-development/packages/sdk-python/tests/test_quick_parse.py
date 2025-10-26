import asyncio

from parserator import ParseResponse, ValidationType, quick_parse


def test_quick_parse_background_thread(monkeypatch):
    """The ``quick_parse`` helper should proxy calls through the real client."""

    captured = {}

    def fake_init(self, api_key: str, **kwargs):
        captured["api_key"] = api_key
        captured["init_kwargs"] = kwargs

    def fake_parse(self, *, input_data, output_schema, instructions=None, options=None):
        captured["input_data"] = input_data
        captured["output_schema"] = output_schema
        captured["instructions"] = instructions
        captured["options"] = options
        return ParseResponse(success=True, parsed_data={"foo": "bar"})

    monkeypatch.setattr("parserator.ParseratorClient.__init__", fake_init)
    monkeypatch.setattr("parserator.ParseratorClient.parse", fake_parse)

    result = asyncio.run(
        quick_parse(
            "pk_test_123",
            "Sample text",
            {"foo": "string"},
            instructions="Do the thing",
            validation=ValidationType.LENIENT,
        )
    )

    assert result.parsed_data == {"foo": "bar"}
    assert captured["api_key"] == "pk_test_123"
    assert captured["input_data"] == "Sample text"
    assert captured["output_schema"] == {"foo": "string"}
    assert captured["instructions"] == "Do the thing"
    assert captured["options"].validation is ValidationType.LENIENT
