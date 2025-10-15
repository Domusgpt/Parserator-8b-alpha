#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  buildSummary,
  classifyRecommendedActions,
  loadSnapshot,
  normaliseBaseUrl
} from './shared.mjs';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

async function readFileIfSet(flag) {
  const filePath = getArg(flag);
  if (!filePath) {
    return undefined;
  }

  const absolutePath = path.resolve(process.cwd(), filePath);
  return fs.readFile(absolutePath, 'utf8');
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function maybeLoadSnapshot(baseUrl) {
  const adminKey = process.env.PARSERATOR_ADMIN_API_KEY;
  if (!adminKey) {
    console.warn('No PARSERATOR_ADMIN_API_KEY set — skipping readiness snapshot.');
    return undefined;
  }

  try {
    return await loadSnapshot({ baseUrl, adminKey });
  } catch (error) {
    console.warn('Failed to load lean snapshot before parse. Use --force to continue.', error instanceof Error ? error.message : error);
    return undefined;
  }
}

function assertSafeToParse(snapshot) {
  if (!snapshot) {
    return { proceed: true, reason: 'Snapshot unavailable, proceeding without readiness guard.' };
  }

  const actions = classifyRecommendedActions(snapshot.recommendedActions);
  if (actions.investigate.length > 0) {
    return {
      proceed: false,
      reason: `Snapshot recommends investigation before parsing: ${actions.investigate.join(' | ')}`
    };
  }

  return { proceed: true, reason: 'Snapshot ready — no investigative blockers detected.' };
}

function logSnapshotContext(snapshotPayload) {
  if (!snapshotPayload) {
    return;
  }

  const { snapshot, requestId } = snapshotPayload;
  console.log(`Snapshot requestId: ${requestId ?? 'unknown'}`);
  console.log(`Plan rewrite enabled: ${snapshot.planRewriteState?.enabled ?? false}`);
  console.log(`Field fallback enabled: ${snapshot.fieldFallbackState?.enabled ?? false}`);

  const summary = buildSummary(snapshot);
  if (summary.length > 0) {
    console.log('Snapshot summary:');
    for (const line of summary) {
      console.log(`- ${line}`);
    }
  }
}

async function main() {
  const baseUrl = normaliseBaseUrl(process.env.PARSERATOR_API_BASE);
  const apiKey = process.env.PARSERATOR_API_KEY;

  if (!apiKey) {
    console.error('Missing required environment variable: PARSERATOR_API_KEY');
    process.exitCode = 1;
    return;
  }

  const inputPath = getArg('--input');
  const schemaPath = getArg('--schema');

  if (!inputPath || !schemaPath) {
    console.error('Usage: parserator-parse.mjs --input <input.json> --schema <schema.json> [--instructions <text>|--instructions-file <file>] [--force]');
    process.exitCode = 1;
    return;
  }

  const inputData = await fs.readFile(path.resolve(process.cwd(), inputPath), 'utf8');
  let outputSchemaRaw;
  try {
    outputSchemaRaw = await fs.readFile(path.resolve(process.cwd(), schemaPath), 'utf8');
  } catch (error) {
    console.error('Failed to read schema file:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  let outputSchema;
  try {
    outputSchema = JSON.parse(outputSchemaRaw);
  } catch (error) {
    console.error('Schema file must contain valid JSON.');
    process.exitCode = 1;
    return;
  }

  let instructions = getArg('--instructions');
  if (!instructions) {
    const instructionsFile = await readFileIfSet('--instructions-file');
    instructions = instructionsFile ? instructionsFile.trim() : undefined;
  }

  const snapshotPayload = await maybeLoadSnapshot(baseUrl);
  const guard = assertSafeToParse(snapshotPayload?.snapshot);
  if (!guard.proceed && !hasFlag('--force')) {
    console.error(guard.reason);
    console.error('Re-run with --force to ignore readiness guidance (not recommended).');
    process.exitCode = 1;
    return;
  }

  if (snapshotPayload) {
    console.log(guard.reason);
    logSnapshotContext(snapshotPayload);
  }

  const payload = {
    inputData,
    outputSchema,
    instructions,
    options: { includeMetadata: true }
  };

  const parseUrl = `${baseUrl}/v1/parse`;

  let response;
  try {
    response = await fetch(parseUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'parserator-lean-plugin/0.1'
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Failed to reach parse endpoint:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  const rawBody = await response.text();

  let payloadJson;
  try {
    payloadJson = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.error('Parse response was not valid JSON:', rawBody);
    process.exitCode = 1;
    return;
  }

  if (!response.ok) {
    console.error('Parse request failed.', {
      status: response.status,
      statusText: response.statusText,
      body: payloadJson
    });
    process.exitCode = 1;
    return;
  }

  console.log('Parse succeeded.');
  if (payloadJson.metadata) {
    console.log(`Request ID: ${payloadJson.metadata.requestId ?? 'unknown'}`);
    console.log(`Confidence: ${payloadJson.metadata.confidence ?? 'n/a'}`);
    console.log(`Processing time: ${payloadJson.metadata.processingTimeMs ?? 'n/a'}ms`);
  }

  if (snapshotPayload?.snapshot) {
    console.log('Lean features at parse time:');
    console.log(`- Plan rewrite enabled: ${snapshotPayload.snapshot.planRewriteState?.enabled ?? false}`);
    console.log(`- Field fallback enabled: ${snapshotPayload.snapshot.fieldFallbackState?.enabled ?? false}`);
  }

  console.log('\nParsed data:');
  console.log(JSON.stringify(payloadJson.parsedData ?? {}, null, 2));

  if (payloadJson.metadata?.diagnostics?.length) {
    console.log('\nDiagnostics:');
    for (const diagnostic of payloadJson.metadata.diagnostics) {
      console.log(`- [${diagnostic.severity}] ${diagnostic.field}: ${diagnostic.message}`);
    }
  }
}

await main();
