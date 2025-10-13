#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

export const DEFAULT_API_BASE = 'https://app-5108296280.us-central1.run.app';

export function resolveApiBase() {
  return process.env.PARSERATOR_API_BASE?.trim() || DEFAULT_API_BASE;
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required for this command.`);
  }
  return value;
}

export async function readJsonFile(path, label) {
  try {
    const contents = await readFile(path, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${label} from ${path}: ${reason}`);
  }
}

export async function readTextFile(path, label) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read ${label} from ${path}: ${reason}`);
  }
}

export function summariseQueue(queue) {
  return `pending=${queue.pending}, inFlight=${queue.inFlight}, completed=${queue.completed}, failed=${queue.failed}`;
}

export function logSnapshotSummary(snapshot, { includeRecommendedActions = true } = {}) {
  console.log(`\n# Lean Orchestration Snapshot (${snapshot.generatedAt})`);
  console.log(`Plan rewrite enabled: ${snapshot.planRewriteState.enabled}`);
  console.log(`Plan rewrite queue: ${summariseQueue(snapshot.planRewriteState.queue)}`);
  if (snapshot.planRewriteState.pendingCooldown) {
    console.log('Plan rewrite cooldown: active');
  }
  if (snapshot.planRewriteState.lastError) {
    console.log(`Plan rewrite last error: ${snapshot.planRewriteState.lastError}`);
  }

  console.log(`\nField fallback enabled: ${snapshot.fieldFallbackState.enabled}`);
  console.log(`Field fallback queue: ${summariseQueue(snapshot.fieldFallbackState.queue)}`);
  if (snapshot.fieldFallbackState.lastError) {
    console.log(`Field fallback last error: ${snapshot.fieldFallbackState.lastError}`);
  }

  console.log('\nReadiness notes:');
  snapshot.readinessNotes.forEach(note => console.log(`- ${note}`));

  if (includeRecommendedActions) {
    console.log('\nRecommended actions:');
    snapshot.recommendedActions.forEach(action => console.log(`- ${action}`));
  }
}

export async function fetchSnapshot({ baseUrl, adminKey }) {
  const response = await fetch(new URL('/v1/lean/snapshot', baseUrl), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${adminKey}`,
      'Content-Type': 'application/json'
    }
  });

  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const details = payload ? JSON.stringify(payload, null, 2) : response.statusText;
    throw new Error(`Snapshot request failed with status ${response.status}: ${details}`);
  }

  if (!payload?.success || !payload?.snapshot) {
    throw new Error('Snapshot response missing success flag or snapshot payload.');
  }

  return { snapshot: payload.snapshot, requestId: payload.requestId };
}

export function printErrorAndExit(error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ ${message}`);
  if (error?.stack) {
    console.error(error.stack.split('\n').slice(1).join('\n'));
  }
  process.exit(1);
}

export function detectLeanReadiness(snapshot) {
  const planEnabled = snapshot.planRewriteState.enabled && !snapshot.planRewriteState.pendingCooldown;
  const fallbackEnabled = snapshot.fieldFallbackState.enabled;
  const hasBlockingAction = snapshot.recommendedActions.some(action => /investigate/i.test(action));

  return {
    planEnabled,
    fallbackEnabled,
    safeToLean: planEnabled && fallbackEnabled && !hasBlockingAction
  };
}

export function printParseSummary({ result, snapshotInfo, response, durationMs }) {
  const { snapshot, requestId: snapshotRequestId } = snapshotInfo ?? {};
  console.log('\n# Parserator Parse Result');
  console.log(`HTTP status: ${response.status}`);
  console.log(`Request ID: ${result?.metadata?.requestId ?? 'unknown'}`);
  console.log(`Processing time: ${result?.metadata?.processingTimeMs ?? 'n/a'} ms`);
  console.log(`Lean features enabled (plan/fallback): ${snapshot ? `${snapshot.planRewriteState.enabled}/${snapshot.fieldFallbackState.enabled}` : 'unknown'}`);
  if (snapshotRequestId) {
    console.log(`Snapshot request ID: ${snapshotRequestId}`);
  }
  console.log(`Elapsed client time: ${durationMs} ms`);

  if (result?.success) {
    console.log('\nParsed data:');
    console.log(JSON.stringify(result.parsedData, null, 2));
    console.log('\nConfidence: ', result.metadata.confidence);
  } else if (result?.error) {
    console.log('\nError:');
    console.log(JSON.stringify(result.error, null, 2));
  }
}

export function parseCliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}
