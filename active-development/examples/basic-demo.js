#!/usr/bin/env node

/*
 * Minimal Parserator sample.
 *
 * Usage: npm run demo
 */

const path = require('path');

function loadCore() {
  try {
    // Prefer the compiled workspace build so the demo works after `npm run build`.
    const corePath = path.join(__dirname, '..', 'packages', 'core', 'lib');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(corePath);
  } catch (error) {
    console.error('Unable to locate @parserator/core build output. Did you run `npm run build --workspace @parserator/core`?');
    throw error;
  }
}

async function main() {
  const { ParseratorCore } = loadCore();

  const core = new ParseratorCore({
    apiKey: process.env.PARSERATOR_API_KEY || 'demo-key',
    profile: 'lean-agent',
  });

  const sampleDocument = `
  Candidate: Jane Doe
  Title: Director of Operations
  Email: jane.doe@example.com
  Phone: (555) 010-2024
  Notes: Loves clean pipelines and telemetry-first tooling.
  `;

  const response = await core.parse({
    inputData: sampleDocument,
    outputSchema: {
      name: 'string',
      email: 'string',
      phone: 'string',
      title: 'string',
      notes: 'string',
    },
    instructions: 'Extract the candidate record with normalized casing.',
  });

  if (!response.success) {
    console.error('\n❌ Demo parse failed. Diagnostics:');
    console.dir(response.error, { depth: null });
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ Parserator demo complete. Parsed contact:');
  console.table(response.parsedData);

  console.log('\nTelemetry snapshot:');
  console.table({
    Confidence: response.metadata.confidence.toFixed(2),
    'Architect tokens': response.metadata.architectTokens,
    'Extractor tokens': response.metadata.extractorTokens,
    'Processing time (ms)': response.metadata.processingTimeMs,
  });

  if (response.metadata.diagnostics.length) {
    console.log('\nDiagnostics:');
    response.metadata.diagnostics.forEach((diag) => {
      console.log(` - [${diag.stage}] ${diag.severity}: ${diag.message}`);
    });
  }

  console.log('\nNext: wire sessions or batch parsing via @parserator/core when you are ready.');
}

main().catch((error) => {
  console.error('\nUnexpected demo failure:', error);
  process.exitCode = 1;
});
