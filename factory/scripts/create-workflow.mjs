#!/usr/bin/env node
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ensureExecutable,
  fail,
  hazloBin,
  parseArgs,
  parseRef,
  repoRoot,
  toPosixPath,
  workflowsDir,
} from './lib/pipeline.mjs';

const args = parseArgs();
if (args.help === true) {
  console.log('usage: node factory/scripts/create-workflow.mjs <new|import-openapi> [...hazlo args]');
  process.exit(0);
}
const command = args._[0];

if (command !== 'new' && command !== 'import-openapi') {
  fail('usage: node factory/scripts/create-workflow.mjs <new|import-openapi> [...hazlo args]');
}

if (args['base-dir'] !== undefined) {
  fail('--base-dir is managed by this script and cannot be provided');
}

if (command === 'new') {
  const ref = args.ref;
  if (typeof ref !== 'string' || ref.length === 0) {
    fail('new mode requires --ref <provider>/<workflow>/<version>');
  }
  parseRef(ref);
}

if (command === 'import-openapi') {
  if (typeof args.provider !== 'string' || args.provider.length === 0) {
    fail('import-openapi mode requires --provider <provider>');
  }
  if (typeof args.spec !== 'string' || args.spec.length === 0) {
    fail('import-openapi mode requires --spec <path-to-openapi-file>');
  }
}

ensureExecutable(hazloBin);

const passthroughArgs = process.argv.slice(3);
const relativeBaseDir = toPosixPath(path.relative(repoRoot, workflowsDir));
const hazloArgs = ['workflows', command, ...passthroughArgs, '--base-dir', relativeBaseDir];

const result = spawnSync(hazloBin, hazloArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (typeof result.status === 'number' && result.status !== 0) {
  process.exit(result.status);
}

if (result.error) {
  fail(`failed to run hazlo: ${result.error.message}`);
}
