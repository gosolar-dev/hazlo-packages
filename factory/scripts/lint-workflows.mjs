#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCandidateRefs,
  ensureDefaultRefsInCandidateSet,
  ensureExecutable,
  fail,
  findNebulaKeys,
  hazloBin,
  info,
  loadManifest,
  parseArgs,
  parseRef,
  readJson,
  refToWorkflowPath,
  repoRoot,
  resolveManifestRelative,
  runHazloDescribe,
  toRelativePosix,
  workflowsDir,
} from './lib/pipeline.mjs';

const args = parseArgs();
if (args.help === true) {
  console.log('usage: node factory/scripts/lint-workflows.mjs --manifest factory/releases/<package>/<version>/release.json');
  process.exit(0);
}
const manifestArg = args.manifest;

if (typeof manifestArg !== 'string' || manifestArg.length === 0) {
  fail('usage: node factory/scripts/lint-workflows.mjs --manifest factory/releases/<package>/<version>/release.json');
}

ensureExecutable(hazloBin);

const { manifest, manifestDir, manifestPath } = loadManifest(manifestArg);
const candidateRefs = buildCandidateRefs(manifest, workflowsDir);
ensureDefaultRefsInCandidateSet(manifest.defaultInstallRefs, candidateRefs);

const candidateSet = new Set(candidateRefs);
for (const smokeTest of manifest.smokeTests) {
  if (!candidateSet.has(smokeTest.ref)) {
    fail(`smoke test ref ${smokeTest.ref} is not part of candidate refs`);
  }

  const inputPath = resolveManifestRelative(manifestDir, smokeTest.input);
  const expectedPath = resolveManifestRelative(manifestDir, smokeTest.expected);
  if (!fs.existsSync(inputPath)) {
    fail(`smoke test input file not found: ${inputPath}`);
  }
  if (!fs.existsSync(expectedPath)) {
    fail(`smoke test expected file not found: ${expectedPath}`);
  }
}

const failures = [];

for (const ref of candidateRefs) {
  const parsed = parseRef(ref);
  const filePath = refToWorkflowPath(ref, workflowsDir);
  if (!fs.existsSync(filePath)) {
    failures.push(`[${ref}] workflow file missing: ${filePath}`);
    continue;
  }

  const relativeWorkflowPath = toRelativePosix(workflowsDir, filePath);
  const expectedRelativePath = `${parsed.provider}/${parsed.workflow}/${parsed.version}/workflow.json`;
  if (relativeWorkflowPath !== expectedRelativePath) {
    failures.push(`[${ref}] path mismatch: expected ${expectedRelativePath}, found ${relativeWorkflowPath}`);
    continue;
  }

  const workflow = readJson(filePath);
  const nebulaHits = findNebulaKeys(workflow);
  if (nebulaHits.length > 0) {
    failures.push(`[${ref}] contains _pbd_nebula_type at ${nebulaHits.slice(0, 5).join(', ')}${nebulaHits.length > 5 ? ' ...' : ''}`);
  }

  if (workflow.meta && typeof workflow.meta === 'object' && workflow.meta.provider !== undefined) {
    if (workflow.meta.provider !== parsed.provider) {
      failures.push(`[${ref}] workflow.meta.provider must equal ${parsed.provider}`);
    }
  }

  try {
    runHazloDescribe(filePath);
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim();
    const stdout = error?.stdout?.toString?.().trim();
    const details = [stderr, stdout].filter(Boolean).join(' | ');
    failures.push(`[${ref}] hazlo describe failed${details ? `: ${details}` : ''}`);
  }
}

if (failures.length > 0) {
  console.error(`\nLint failed for manifest ${manifestPath}`);
  failures.forEach((line) => console.error(`- ${line}`));
  process.exit(1);
}

info(`Lint passed for ${candidateRefs.length} workflow(s) from ${path.relative(repoRoot, manifestPath)}`);
