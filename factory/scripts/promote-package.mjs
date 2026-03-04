#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  buildCandidateRefs,
  compareVersions,
  computeSha256,
  ensureDefaultRefsInCandidateSet,
  ensureExecutable,
  extractEnvKeys,
  extractSubworkRefs,
  fail,
  factoryDir,
  hazloBin,
  info,
  loadManifest,
  packagesDir,
  parseArgs,
  parseRef,
  readJson,
  refToWorkflowPath,
  repoRoot,
  toRelativePosix,
  uniqueSorted,
  workflowsDir,
  writeJson,
} from './lib/pipeline.mjs';

const args = parseArgs();
if (args.help === true) {
  console.log('usage: node factory/scripts/promote-package.mjs --manifest factory/releases/<package>/<version>/release.json [--dry-run]');
  process.exit(0);
}
const manifestArg = args.manifest;
const dryRun = Boolean(args['dry-run']);

if (typeof manifestArg !== 'string' || manifestArg.length === 0) {
  fail('usage: node factory/scripts/promote-package.mjs --manifest factory/releases/<package>/<version>/release.json [--dry-run]');
}

ensureExecutable(hazloBin);

const { manifest, manifestDir, manifestPath } = loadManifest(manifestArg);
const candidateRefs = buildCandidateRefs(manifest, workflowsDir);
ensureDefaultRefsInCandidateSet(manifest.defaultInstallRefs, candidateRefs);

const lintScript = path.join(factoryDir, 'scripts', 'lint-workflows.mjs');
const smokeScript = path.join(factoryDir, 'scripts', 'eval-smoke.mjs');

function runNodeScript(scriptPath, scriptArgs) {
  const result = spawnSync(process.execPath, [scriptPath, ...scriptArgs], {
    cwd: repoRoot,
    stdio: 'inherit',
  });

  if (result.error) {
    fail(`failed to run ${scriptPath}: ${result.error.message}`);
  }

  if (typeof result.status === 'number' && result.status !== 0) {
    process.exit(result.status);
  }
}

info(`Running strict gate checks for ${manifest.package}@${manifest.version}`);
runNodeScript(lintScript, ['--manifest', manifestArg]);
runNodeScript(smokeScript, ['--manifest', manifestArg]);

const destinationVersionDir = path.join(packagesDir, manifest.package, manifest.version);
if (fs.existsSync(destinationVersionDir)) {
  fail(`destination already exists: ${destinationVersionDir}`);
}

const releaseReadmePath = path.join(manifestDir, 'README.md');
if (!fs.existsSync(releaseReadmePath)) {
  fail(`release README not found: ${releaseReadmePath}`);
}

const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hazlo-promote-'));
const stagedPackagesDir = path.join(stageRoot, 'packages');

try {
  fs.cpSync(packagesDir, stagedPackagesDir, { recursive: true });

  const stagedVersionDir = path.join(stagedPackagesDir, manifest.package, manifest.version);
  if (fs.existsSync(stagedVersionDir)) {
    fail(`staging target already exists: ${stagedVersionDir}`);
  }

  fs.mkdirSync(stagedVersionDir, { recursive: true });

  const workflowEntries = [];
  const checksums = {};

  for (const ref of candidateRefs.sort((a, b) => a.localeCompare(b))) {
    const { provider, workflow, version } = parseRef(ref);
    const sourceWorkflowPath = refToWorkflowPath(ref, workflowsDir);
    if (!fs.existsSync(sourceWorkflowPath)) {
      fail(`source workflow file not found for ${ref}: ${sourceWorkflowPath}`);
    }

    const destinationWorkflowPath = path.join(
      stagedVersionDir,
      'workflows',
      provider,
      workflow,
      version,
      'workflow.json',
    );

    fs.mkdirSync(path.dirname(destinationWorkflowPath), { recursive: true });
    fs.copyFileSync(sourceWorkflowPath, destinationWorkflowPath);

    const workflowJson = readJson(sourceWorkflowPath);
    const subworkRefs = extractSubworkRefs(workflowJson.ruleset);
    const { requiredEnvKeys, optionalEnvKeys } = extractEnvKeys(workflowJson.ruleset);

    workflowEntries.push({
      ref,
      path: toRelativePosix(stagedVersionDir, destinationWorkflowPath),
      description: typeof workflowJson.description === 'string' ? workflowJson.description : '',
      subworkRefs,
      requiredEnvKeys,
      optionalEnvKeys,
    });

    checksums[ref] = computeSha256(destinationWorkflowPath);
  }

  workflowEntries.sort((a, b) => a.ref.localeCompare(b.ref));

  const meta = {
    schemaVersion: 'v1',
    name: manifest.package,
    version: manifest.version,
    description: manifest.description,
    workflows: workflowEntries,
    defaultInstallRefs: uniqueSorted(manifest.defaultInstallRefs),
    env: manifest.env,
    checksums,
    homepage: manifest.homepage,
    license: manifest.license,
    tags: manifest.tags,
  };

  const stagedMetaPath = path.join(stagedVersionDir, 'meta.json');
  writeJson(stagedMetaPath, meta);
  fs.copyFileSync(releaseReadmePath, path.join(stagedVersionDir, 'README.md'));

  const stagedIndexPath = path.join(stagedPackagesDir, 'index.json');
  const index = fs.existsSync(stagedIndexPath)
    ? readJson(stagedIndexPath)
    : { schemaVersion: 'v1', generatedAt: new Date().toISOString(), packages: [] };

  if (index.schemaVersion !== 'v1') {
    fail(`unsupported index schemaVersion in ${stagedIndexPath}: ${index.schemaVersion}`);
  }
  if (!Array.isArray(index.packages)) {
    fail(`${stagedIndexPath} must contain a packages array`);
  }

  const existing = index.packages.find((entry) => entry.name === manifest.package);
  const versions = uniqueSorted([...(existing?.versions || []), manifest.version]).sort(compareVersions);
  const latestVersion = versions[versions.length - 1];

  const nextEntry = {
    name: manifest.package,
    latestVersion,
    versions,
    description: manifest.description,
    path: `packages/${manifest.package}`,
  };

  index.packages = index.packages
    .filter((entry) => entry.name !== manifest.package)
    .concat(nextEntry)
    .sort((a, b) => a.name.localeCompare(b.name));

  index.generatedAt = new Date().toISOString();
  writeJson(stagedIndexPath, index);

  const testRunnerPath = path.join(packagesDir, 'tests', 'run.mjs');
  if (!fs.existsSync(testRunnerPath)) {
    fail(`package test runner not found: ${testRunnerPath}`);
  }

  info('Running package tests against staged output');
  runNodeScript(testRunnerPath, ['--packages-dir', stagedPackagesDir, '--index-file', stagedIndexPath]);

  if (dryRun) {
    info(`Dry run complete. Staged output: ${stageRoot}`);
    process.exit(0);
  }

  const packageDir = path.join(packagesDir, manifest.package);
  fs.mkdirSync(packageDir, { recursive: true });

  const finalVersionDir = path.join(packageDir, manifest.version);
  const tempVersionDir = path.join(packageDir, `.tmp-${manifest.version}-${Date.now()}-${process.pid}`);

  fs.cpSync(path.join(stagedPackagesDir, manifest.package, manifest.version), tempVersionDir, { recursive: true });
  fs.renameSync(tempVersionDir, finalVersionDir);

  const tempIndexPath = path.join(packagesDir, `.index.tmp-${Date.now()}-${process.pid}.json`);
  fs.copyFileSync(stagedIndexPath, tempIndexPath);
  fs.renameSync(tempIndexPath, path.join(packagesDir, 'index.json'));

  info(`Published ${manifest.package}@${manifest.version} (${workflowEntries.length} workflow(s))`);
} finally {
  if (!dryRun) {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}
