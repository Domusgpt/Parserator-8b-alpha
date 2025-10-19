document.addEventListener('DOMContentLoaded', () => {
  ParseratorCommon.initCore();

  const usageConfig = {
    rest: {
      heading: 'Send JSON via REST',
      body:
        'POST transcripts with your schema to receive structured JSON plus telemetry that explains every decision.',
      list: [
        'Single call for schema + raw input',
        'Confidence and token metadata returned',
        '95% accuracy · ~2.2s latency',
      ],
      languageClass: 'language-bash',
      code: `curl -X POST "https://app-5108296280.us-central1.run.app/v1/parse" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer pk_live_your_api_key" \\
  -d '{\n    "inputData": "Acme Co. Contract Signed 3/12/24",\n    "outputSchema": {\n      "company": "string",\n      "event": "string",\n      "date": "date"\n    }\n  }'`,
    },
    node: {
      heading: 'Use the Node SDK',
      body:
        'Install the Node SDK to access the same Architect → Extractor pipeline with retries and telemetry baked in.',
      list: [
        'npm install @parserator/node-sdk',
        'Same pipeline across REST and Node',
        'Confidence + token telemetry bundled',
      ],
      languageClass: 'language-javascript',
      code: `npm install @parserator/node-sdk\n\nimport { ParseratorClient } from '@parserator/node-sdk';\n\nconst client = new ParseratorClient({\n  apiKey: 'pk_live_your_api_key_here'\n});\n\nconst result = await client.parse({\n  inputData: \`John Smith\\nSenior Developer\\njohn@techcorp.com\\n(555) 123-4567\`,\n  outputSchema: {\n    name: 'string',\n    title: 'string',\n    email: 'email',\n    phone: 'phone'\n  }\n});\n\nconsole.log(result.parsedData);`,
    },
  };

  ParseratorCommon.initCodeTabs({
    buttons: document.querySelectorAll('[data-code-toggle]'),
    heading: document.querySelector('[data-copy-heading]'),
    body: document.querySelector('[data-copy-body]'),
    list: document.querySelector('[data-usage-copy]'),
    code: document.querySelector('[data-code-block] code'),
    config: usageConfig,
  });
});
