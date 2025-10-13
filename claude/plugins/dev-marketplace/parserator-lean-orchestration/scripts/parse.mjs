#!/usr/bin/env node

import {
  detectLeanReadiness,
  fetchSnapshot,
  parseCliArgs,
  printErrorAndExit,
  printParseSummary,
  readJsonFile,
  readTextFile,
  requireEnv,
  resolveApiBase
} from './utils.mjs';

async function loadInput(args) {
  if (args['input-file']) {
    return readTextFile(args['input-file'], 'input data');
  }
  if (args.input) {
    return args.input;
  }
  throw new Error('Provide --input <string> or --input-file <path> with the document to parse.');
}

async function loadSchema(args) {
  if (args['schema-file']) {
    return readJsonFile(args['schema-file'], 'output schema');
  }
  if (args.schema) {
    try {
      return JSON.parse(args.schema);
    } catch (error) {
      throw new Error(`Failed to parse schema JSON from --schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error('Provide --schema <json> or --schema-file <path> with the desired output schema.');
}

async function loadInstructions(args) {
  if (args['instructions-file']) {
    return readTextFile(args['instructions-file'], 'instructions');
  }
  return args.instructions;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const apiKey = requireEnv('PARSERATOR_API_KEY');
  const baseUrl = resolveApiBase();
  const includeSnapshot = !args['skip-snapshot'];
  const adminKey = process.env.PARSERATOR_ADMIN_API_KEY;

  const [inputData, outputSchema, instructions] = await Promise.all([
    loadInput(args),
    loadSchema(args),
    loadInstructions(args)
  ]);

  let snapshotInfo;
  if (includeSnapshot && adminKey) {
    snapshotInfo = await fetchSnapshot({ baseUrl, adminKey }).catch(error => {
      if (args['require-snapshot']) {
        throw error;
      }
      console.warn(`⚠️ Snapshot unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    });
  } else if (includeSnapshot && !adminKey) {
    console.warn('⚠️ Skipping snapshot: PARSERATOR_ADMIN_API_KEY is not set.');
  }

  const readiness = snapshotInfo ? detectLeanReadiness(snapshotInfo.snapshot) : undefined;
  const leanNote = readiness
    ? `Lean readiness → plan: ${readiness.planEnabled}, field fallback: ${readiness.fallbackEnabled}, safe: ${readiness.safeToLean}`
    : 'Lean readiness unknown (snapshot skipped).';

  console.log(`Base URL: ${baseUrl}`);
  console.log(leanNote);

  const requestPayload = {
    inputData,
    outputSchema,
    instructions,
    options: {
      includeMetadata: true
    }
  };

  const start = Date.now();
  const response = await fetch(new URL('/v1/parse', baseUrl), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestPayload)
  });

  const bodyText = await response.text();
  let result;
  try {
    result = bodyText ? JSON.parse(bodyText) : undefined;
  } catch (error) {
    throw new Error(`Failed to parse response JSON: ${error instanceof Error ? error.message : String(error)}\n${bodyText}`);
  }

  const durationMs = Date.now() - start;

  if (!response.ok) {
    console.error(`\n❌ Parse request failed with status ${response.status}`);
    console.error(bodyText);
    process.exit(1);
  }

  if (args.json) {
    console.log(JSON.stringify({ snapshotInfo, result }, null, 2));
    return;
  }

  printParseSummary({
    result,
    snapshotInfo,
    response,
    durationMs
  });
}

main().catch(printErrorAndExit);
