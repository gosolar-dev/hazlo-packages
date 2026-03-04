#!/usr/bin/env node
import { ensureDefaults, parseArgs } from './lib/test-utils.mjs';
import { run as runStructure } from './structure.test.mjs';
import { run as runMetadata } from './metadata.test.mjs';
import { run as runRegistryIndex } from './registry-index.test.mjs';

const args = parseArgs();
if (args.help === true) {
  console.log('usage: node packages/tests/run.mjs [--packages-dir <path>] [--index-file <path>]');
  process.exit(0);
}
const context = ensureDefaults(args);

async function main() {
  const tests = [
    ['structure', runStructure],
    ['metadata', runMetadata],
    ['registry-index', runRegistryIndex],
  ];

  for (const [name, fn] of tests) {
    await fn(context);
    console.log(`PASS ${name}`);
  }

  console.log('packages/tests: all checks passed');
}

main().catch((error) => {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
});
