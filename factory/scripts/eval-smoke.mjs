#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import {
  buildCandidateRefs,
  fail,
  info,
  loadManifest,
  parseArgs,
  readJson,
  refToWorkflowPath,
  resolveManifestRelative,
  runHazloEvalRef,
  workflowContainsApiReq,
  workflowsDir,
  writeJson,
  factoryDir,
} from './lib/pipeline.mjs';

const args = parseArgs();
if (args.help === true) {
  console.log('usage: node factory/scripts/eval-smoke.mjs --manifest factory/releases/<package>/<version>/release.json');
  process.exit(0);
}
const manifestArg = args.manifest;

if (typeof manifestArg !== 'string' || manifestArg.length === 0) {
  fail('usage: node factory/scripts/eval-smoke.mjs --manifest factory/releases/<package>/<version>/release.json');
}

const { manifest, manifestDir, manifestPath } = loadManifest(manifestArg);
const candidateRefs = buildCandidateRefs(manifest, workflowsDir);
const candidateSet = new Set(candidateRefs);

if (!Array.isArray(manifest.smokeTests) || manifest.smokeTests.length === 0) {
  info(`Smoke eval skipped: no smokeTests configured in ${manifestPath}`);
  process.exit(0);
}

const failures = [];
const reportDir = path.join(factoryDir, 'reports');
fs.mkdirSync(reportDir, { recursive: true });

function normalizeEvalOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return output;
  }

  const copy = { ...output };
  delete copy.evaluatedAt;
  return copy;
}

for (const smokeTest of manifest.smokeTests) {
  if (!candidateSet.has(smokeTest.ref)) {
    failures.push(`[${smokeTest.ref}] ref is not part of manifest candidate set`);
    continue;
  }

  const workflowPath = refToWorkflowPath(smokeTest.ref, workflowsDir);
  const workflow = readJson(workflowPath);
  if (workflowContainsApiReq(workflow.ruleset)) {
    failures.push(`[${smokeTest.ref}] uses api_req and cannot be part of deterministic smoke tests`);
    continue;
  }

  const inputPath = resolveManifestRelative(manifestDir, smokeTest.input);
  const expectedPath = resolveManifestRelative(manifestDir, smokeTest.expected);

  if (!fs.existsSync(inputPath)) {
    failures.push(`[${smokeTest.ref}] missing smoke input file: ${inputPath}`);
    continue;
  }
  if (!fs.existsSync(expectedPath)) {
    failures.push(`[${smokeTest.ref}] missing smoke expected file: ${expectedPath}`);
    continue;
  }

  const input = readJson(inputPath);
  const expected = normalizeEvalOutput(readJson(expectedPath));

  let actual;
  try {
    actual = normalizeEvalOutput(runHazloEvalRef(smokeTest.ref, input));
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    const stdout = error?.stdout?.toString?.().trim();
    const details = [stderr, stdout].filter(Boolean).join(' | ');
    failures.push(`[${smokeTest.ref}] hazlo eval failed${details ? `: ${details}` : ''}`);
    continue;
  }

  if (!isDeepStrictEqual(actual, expected)) {
    const reportName = `${smokeTest.ref.replaceAll('/', '__')}.actual.json`;
    const reportPath = path.join(reportDir, reportName);
    writeJson(reportPath, actual);
    failures.push(`[${smokeTest.ref}] output mismatch; wrote actual output to ${reportPath}`);
    continue;
  }

  info(`Smoke eval passed: ${smokeTest.name || smokeTest.ref}`);
}

if (failures.length > 0) {
  console.error(`\nSmoke eval failed for manifest ${manifestPath}`);
  failures.forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}

info(`Smoke eval passed for ${manifest.smokeTests.length} test(s)`);
