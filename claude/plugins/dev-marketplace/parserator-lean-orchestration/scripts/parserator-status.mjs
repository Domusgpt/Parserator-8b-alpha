#!/usr/bin/env node

import process from 'node:process';

import {
  buildSummary,
  loadSnapshot,
  normaliseBaseUrl
} from './shared.mjs';

async function main() {
  const baseUrl = normaliseBaseUrl(process.env.PARSERATOR_API_BASE);
  const adminKey = process.env.PARSERATOR_ADMIN_API_KEY;

  if (!adminKey) {
    console.error('Missing required environment variable: PARSERATOR_ADMIN_API_KEY');
    process.exitCode = 1;
    return;
  }

  let snapshotPayload;
  try {
    snapshotPayload = await loadSnapshot({ baseUrl, adminKey });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  const { snapshot, requestId } = snapshotPayload;

  console.log(`Lean orchestration snapshot (requestId: ${requestId ?? 'unknown'})`);
  console.log(JSON.stringify(snapshot, null, 2));

  const summary = buildSummary(snapshot);
  if (summary.length > 0) {
    console.log('\nSummary');
    for (const line of summary) {
      console.log(`- ${line}`);
    }
  }
}

await main();
