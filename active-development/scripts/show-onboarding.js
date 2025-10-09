#!/usr/bin/env node

const heading = 'Parserator Agent Onboarding Cheat Sheet';
const tagline = 'Pin this. Share this. #add-this-to-memory';

const sections = [
  {
    title: 'Setup Parserator',
    rows: [
      ['Bootstrap workspace', 'cd active-development && npm install', 'Install repo + workspace dependencies once.'],
      ['Build core locally', 'cd active-development/packages/core && npm run build', 'Emit the @parserator/core JS + types.'],
      ['Verify demo parse', 'cd active-development && npm run demo', 'Runs the sample ParseratorCore workflow.'],
    ],
  },
  {
    title: 'Daily Operations',
    rows: [
      ['Core unit tests', 'cd active-development/packages/core && npm test', 'Validate heuristics, resolvers, sessions.'],
      ['API emulator', 'cd active-development/packages/api && npm run dev', 'Spin Firebase functions + shared core locally.'],
      ['SDK checks', 'cd active-development/packages/sdk-node && npm test', 'Keep published Node surface honest.'],
      ['Batch/session example', 'cd active-development/packages/sdk-node && npm run example:advanced', 'Observe caching + telemetry helpers.'],
    ],
  },
  {
    title: 'Reference Commands',
    rows: [
      ['Build API bundle', 'cd active-development/packages/api && npm run build', 'Transpile Cloud Functions for deploys.'],
      ['Build Node SDK', 'cd active-development/packages/sdk-node && npm run build', 'Emit dist artifacts for publication.'],
      ['Lint the core', 'cd active-development/packages/core && npm run lint', 'Keep the agent-first kernel readable.'],
      ['Cheat sheet refresh', 'npm run onboarding', 'Print this table again whenever context drifts.'],
    ],
  },
];

function renderSection(section) {
  const rows = [['Task', 'Command', 'Why it matters'], ...section.rows];
  const columnWidths = rows[0].map((_, columnIndex) =>
    Math.max(...rows.map((row) => row[columnIndex].length))
  );

  const separator = `+${columnWidths.map((width) => '-'.repeat(width + 2)).join('+')}+`;

  const renderRow = (row) => {
    const cells = row
      .map((cell, index) => ` ${cell.padEnd(columnWidths[index])} `)
      .join('|');
    return `|${cells}|`;
  };

  console.log(section.title);
  console.log(separator);
  console.log(renderRow(rows[0]));
  console.log(separator);
  rows.slice(1).forEach((row) => {
    console.log(renderRow(row));
  });
  console.log(separator + '\n');
}

console.log(`\n${heading}`);
console.log('='.repeat(heading.length));
console.log(`${tagline}\n`);

sections.forEach(renderSection);

console.log('Reminder: drop this into working memory so every agent persona knows the fast path.');
console.log('Need deeper context? Start with AGENTS.md and docs/AGENTIC_RELAUNCH.md.\n');
