#!/usr/bin/env node

import {
  detectLeanReadiness,
  fetchSnapshot,
  logSnapshotSummary,
  parseCliArgs,
  printErrorAndExit,
  requireEnv,
  resolveApiBase
} from './utils.mjs';

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const adminKey = requireEnv('PARSERATOR_ADMIN_API_KEY');
  const baseUrl = resolveApiBase();

  const { snapshot, requestId } = await fetchSnapshot({ baseUrl, adminKey });

  if (args.json) {
    console.log(JSON.stringify({ requestId, snapshot }, null, 2));
    return;
  }

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Snapshot request ID: ${requestId}`);

  logSnapshotSummary(snapshot);

  const readiness = detectLeanReadiness(snapshot);
  console.log('\nLean readiness assessment:');
  console.log(`- Plan rewrite ready: ${readiness.planEnabled}`);
  console.log(`- Field fallback ready: ${readiness.fallbackEnabled}`);
  console.log(`- Safe to enable lean features: ${readiness.safeToLean}`);
}

main().catch(printErrorAndExit);
