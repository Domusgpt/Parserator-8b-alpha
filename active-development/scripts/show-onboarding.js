#!/usr/bin/env node

const heading = 'Parserator Agent Onboarding Cheat Sheet';
const tagline = 'Pin this. Share this. #add-this-to-memory';
const intro = [
  'These are the day-one moves: bootstrap the workspace, run your first parse, and know where to extend.',
  'Memorise the flow so you can brief other agents without opening a doc.'
];

const sections = [
  {
    title: 'Bootstrap the workspace',
    rows: [
      ['Task', 'Command', 'Notes'],
      ['Clone repo', 'git clone <repo> Parserator-8b-alpha', 'Then `cd Parserator-8b-alpha/active-development` for all workspace commands.'],
      ['Install dependencies', 'npm install', 'Installs shared toolchain plus workspace package deps (Node ≥ 18, npm ≥ 9).'],
      ['Verify toolchain', 'npm run build --workspace @parserator/core', 'Compiles the core kernel to ensure TS + workspace wiring is good.']
    ]
  },
  {
    title: 'Run Parserator from the CLI',
    rows: [
      ['Task', 'Command', 'Notes'],
      ['Export API key', 'export PARSERATOR_API_KEY="<your-key>"', 'Grab a key from https://app.parserator.com before running examples.'],
      ['Build Node SDK', 'npm run build --workspace @parserator/sdk-node', 'Produces `dist/` so examples and local automations can import the client.'],
      ['Quick parse demo', 'npm run example:basic --workspace @parserator/sdk-node', 'CLI walk-through: connection test, quickParse helper, presets.'],
      ['Batch parse demo', 'npm run example:batch --workspace @parserator/sdk-node', 'Shows plan reuse + telemetry for multi-document flows.']
    ]
  },
  {
    title: 'Stay productive',
    rows: [
      ['Task', 'Command', 'Notes'],
      ['Serve Firebase API locally', 'npm run dev --workspace @parserator/api', 'Emulators wired to the same core pipeline you use in tests.'],
      ['Watch core builds', 'npm run dev --workspace @parserator/core', 'Hot rebuilds core when you tweak heuristics/resolvers.'],
      ['Show this cheat sheet', 'npm run onboarding', 'Blast this table any time a new agent arrives—no docs diving required.']
    ]
  }
];

function renderSection(section) {
  const columnWidths = section.rows[0].map((_, index) =>
    Math.max(...section.rows.map((row) => row[index].length))
  );

  const separator = `+${columnWidths.map((width) => '-'.repeat(width + 2)).join('+')}+`;

  console.log(`\n${section.title}`);
  console.log('-'.repeat(section.title.length));
  console.log(separator);
  console.log(renderRow(section.rows[0], columnWidths));
  console.log(separator);
  section.rows.slice(1).forEach((row) => {
    console.log(renderRow(row, columnWidths));
  });
  console.log(separator);
}

function renderRow(row, columnWidths) {
  const cells = row
    .map((cell, index) => ` ${cell.padEnd(columnWidths[index])} `)
    .join('|');
  return `|${cells}|`;
}

console.log(`\n${heading}`);
console.log('='.repeat(heading.length));
console.log(`${tagline}\n`);
intro.forEach((line) => console.log(`${line}`));
console.log('');
sections.forEach(renderSection);
console.log('\nReminder: add these steps to memory so you can brief teammates without reopening docs.\n');
