#!/usr/bin/env node

const heading = 'Parserator Agent Onboarding Cheat Sheet';
const tagline = 'Pin this. Share this. #add-this-to-memory';

const prerequisites = [
  'Node.js ≥ 18 and npm ≥ 9 (matches the workspace engines).',
  'Clone the repo, then cd into `active-development/` before running commands.',
  'Export `PARSERATOR_API_KEY` (or create a `.env`) so CLI demos can talk to the hosted API.'
];

const rows = [
  ['Step', 'Where', 'Command', 'What it does'],
  ['Install workspace deps', 'active-development', 'npm install', 'Installs all dependencies and links workspaces.'],
  ['Build parser core', 'active-development', 'npm run build -w @parserator/core', 'Compiles the agent-first kernel for local runs.'],
  ['Build Node SDK', 'active-development', 'npm run build -w @parserator/sdk-node', 'Emits CLI-ready artifacts in `packages/sdk-node/dist`.'],
  ['Set API key (bash/zsh)', 'shell', 'export PARSERATOR_API_KEY="pk_live_or_test"', 'Authenticates CLI + SDK calls against the cloud API.'],
  ['Set API key (PowerShell)', 'shell', '$env:PARSERATOR_API_KEY="pk_live_or_test"', 'Windows-friendly environment variable setup.'],
  ['Run CLI parse demo', 'active-development', 'npm run example:basic -w @parserator/sdk-node', 'Executes the SDK CLI demo against sample transcripts.'],
  ['Batch CLI example', 'active-development', 'npm run example:batch -w @parserator/sdk-node', 'Demonstrates cached-plan batching from the CLI.'],
  ['Serve API locally', 'active-development', 'npm run dev -w @parserator/api', 'Boots Firebase emulators wired to the shared core.'],
  ['Run core tests', 'active-development', 'npm run test -w @parserator/core', 'Validates heuristics, resolvers, and post-processors.'],
  ['Run onboarding again', 'repo root', 'npm run onboarding', 'Prints this cheat sheet whenever you need a refresher.']
];

const columnWidths = rows[0].map((_, columnIndex) =>
  Math.max(...rows.map((row) => row[columnIndex].length))
);

function renderSeparator() {
  const separator = columnWidths
    .map((width) => '-'.repeat(width + 2))
    .join('+');
  return `+${separator}+`;
}

function renderRow(row) {
  const cells = row
    .map((cell, index) => ` ${cell.padEnd(columnWidths[index])} `)
    .join('|');
  return `|${cells}|`;
}

console.log('\n' + heading);
console.log('='.repeat(heading.length));
console.log(tagline + '\n');

console.log('Pre-flight');
console.log('----------');
prerequisites.forEach((item) => {
  console.log(`• ${item}`);
});
console.log('');

console.log(renderSeparator());
console.log(renderRow(rows[0]));
console.log(renderSeparator());
rows.slice(1).forEach((row) => {
  console.log(renderRow(row));
});
console.log(renderSeparator());

console.log('\nReminder: drop this into your working memory so your agent persona always knows the fast path.\n');
