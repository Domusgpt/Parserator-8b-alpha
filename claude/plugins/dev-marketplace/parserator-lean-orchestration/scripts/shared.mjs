#!/usr/bin/env node

export const DEFAULT_BASE = 'https://app-5108296280.us-central1.run.app';

export function normaliseBaseUrl(base) {
  if (!base) {
    return DEFAULT_BASE;
  }
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function describeQueue(label, pending = 0, inFlight = 0) {
  const total = pending + inFlight;
  if (total === 0) {
    return `${label} queue is idle.`;
  }
  return `${label} queue processing ${total} task${total === 1 ? '' : 's'} (${pending} pending, ${inFlight} in-flight).`;
}

export function buildSummary(snapshot) {
  const notes = [];
  if (snapshot?.planRewriteState) {
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

  if (snapshot?.fieldFallbackState) {
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

  if (Array.isArray(snapshot?.recommendedActions) && snapshot.recommendedActions.length > 0) {
    notes.push('Recommended actions:');
    for (const action of snapshot.recommendedActions) {
      notes.push(`  • ${action}`);
    }
  }

  return notes;
}

export function classifyRecommendedActions(actions = []) {
  const investigate = [];
  const enable = [];
  const monitor = [];
  const other = [];

  for (const action of actions) {
    if (typeof action !== 'string') {
      continue;
    }
    if (action.toLowerCase().startsWith('investigate')) {
      investigate.push(action);
    } else if (action.toLowerCase().startsWith('enable')) {
      enable.push(action);
    } else if (action.toLowerCase().startsWith('monitor')) {
      monitor.push(action);
    } else {
      other.push(action);
    }
  }

  return { investigate, enable, monitor, other };
}

export async function loadSnapshot({ baseUrl, adminKey }) {
  if (!adminKey) {
    throw new Error('Missing required environment variable: PARSERATOR_ADMIN_API_KEY');
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
    const message = error instanceof Error ? error.message : String(error);
    const fetchError = new Error(`Failed to reach snapshot endpoint: ${message}`);
    fetchError.cause = error;
    throw fetchError;
  }

  const rawBody = await response.text();

  let payload;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    const parseError = new Error(`Snapshot response was not valid JSON: ${rawBody}`);
    parseError.cause = error;
    throw parseError;
  }

  if (!response.ok) {
    throw new Error(
      `Snapshot request failed with status ${response.status} ${response.statusText}: ${JSON.stringify(payload)}`
    );
  }

  if (!payload.snapshot) {
    throw new Error('Snapshot payload missing expected `snapshot` field.');
  }

  return { snapshot: payload.snapshot, requestId: payload.requestId };
}
