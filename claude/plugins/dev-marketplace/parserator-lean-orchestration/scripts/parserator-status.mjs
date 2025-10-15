#!/usr/bin/env node

import process from 'node:process';

const DEFAULT_BASE = 'https://app-5108296280.us-central1.run.app';

function normaliseBaseUrl(base) {
  if (!base) {
    return DEFAULT_BASE;
  }

  return base.endsWith('/') ? base.slice(0, -1) : base;
}

async function main() {
  const baseUrl = normaliseBaseUrl(process.env.PARSERATOR_API_BASE);
  const adminKey = process.env.PARSERATOR_ADMIN_API_KEY;

  if (!adminKey) {
    console.error('Missing required environment variable: PARSERATOR_ADMIN_API_KEY');
    process.exitCode = 1;
    return;
  }

  const snapshotUrl = `${baseUrl}/v1/lean/snapshot`;

  let response;
  try {
    response = await fetch(snapshotUrl, {
      headers: {
        Authorization: `Bearer ${adminKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'parserator-lean-plugin/0.1'
      }
    });
  } catch (error) {
    console.error('Failed to reach snapshot endpoint:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
    return;
  }

  const rawBody = await response.text();

  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    console.error('Snapshot response was not valid JSON:', rawBody);
    process.exitCode = 1;
    return;
  }

  if (!response.ok) {
    console.error('Snapshot request failed.', {
      status: response.status,
      statusText: response.statusText,
      body: payload
    });
    process.exitCode = 1;
    return;
  }

  const { snapshot, requestId } = payload;
  if (!snapshot) {
    console.error('Snapshot payload missing expected `snapshot` field:', payload);
    process.exitCode = 1;
    return;
  }

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

function buildSummary(snapshot) {
  const notes = [];
  if (snapshot.planRewriteState) {
    notes.push(
      describeQueue(
        'Plan rewrite',
        snapshot.planRewriteState.queue?.pending ?? 0,
        snapshot.planRewriteState.queue?.inFlight ?? 0
      )
    );
    if (snapshot.planRewriteState.pendingCooldown) {
      notes.push('Plan rewrite cooldown active — new rewrite requests will queue until cooldown clears.');
    }
    if (snapshot.planRewriteState.lastError) {
      notes.push(`Last plan rewrite error: ${snapshot.planRewriteState.lastError}`);
    }
  }

  if (snapshot.fieldFallbackState) {
    notes.push(
      describeQueue(
        'Field fallback',
        snapshot.fieldFallbackState.queue?.pending ?? 0,
        snapshot.fieldFallbackState.queue?.inFlight ?? 0
      )
    );
    if (snapshot.fieldFallbackState.lastError) {
      notes.push(`Last field fallback error: ${snapshot.fieldFallbackState.lastError}`);
    }
  }

  if (Array.isArray(snapshot.recommendedActions) && snapshot.recommendedActions.length > 0) {
    notes.push('Recommended actions:');
    for (const action of snapshot.recommendedActions) {
      notes.push(`  • ${action}`);
    }
  }

  return notes;
}

function describeQueue(label, pending, inFlight) {
  const total = pending + inFlight;
  if (total === 0) {
    return `${label} queue is idle.`;
  }
  return `${label} queue processing ${total} task${total === 1 ? '' : 's'} (${pending} pending, ${inFlight} in-flight).`;
}

await main();
