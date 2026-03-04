import fs from 'node:fs';
import path from 'node:path';
import {
  compareVersions,
  fail,
  listPackageNames,
  listVersionsForPackage,
  readJson,
  relativePosix,
} from './lib/test-utils.mjs';

export async function run({ packagesDir, indexFile }) {
  if (!fs.existsSync(indexFile)) {
    fail(`index file not found: ${indexFile}`);
  }

  const index = readJson(indexFile);

  if (index.schemaVersion !== 'v1') {
    fail(`${relativePosix(packagesDir, indexFile)} schemaVersion must be v1`);
  }
  if (!Array.isArray(index.packages)) {
    fail(`${relativePosix(packagesDir, indexFile)} packages must be an array`);
  }

  const packageNamesFromFs = listPackageNames(packagesDir);
  const packageNamesFromIndex = index.packages.map((entry) => entry.name);

  const sortedNames = [...packageNamesFromIndex].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(sortedNames) !== JSON.stringify(packageNamesFromIndex)) {
    fail('index packages must be sorted by name');
  }

  const fsSet = new Set(packageNamesFromFs);
  const indexSet = new Set(packageNamesFromIndex);

  for (const packageName of packageNamesFromFs) {
    if (!indexSet.has(packageName)) {
      fail(`index is missing package ${packageName}`);
    }
  }

  for (const entry of index.packages) {
    if (!entry || typeof entry !== 'object') {
      fail('index packages entries must be objects');
    }

    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      fail('index package entry missing valid name');
    }
    if (typeof entry.latestVersion !== 'string' || !/^v\d+$/.test(entry.latestVersion)) {
      fail(`index package ${entry.name} has invalid latestVersion`);
    }
    if (!Array.isArray(entry.versions) || entry.versions.length === 0) {
      fail(`index package ${entry.name} must have non-empty versions`);
    }
    if (typeof entry.description !== 'string' || entry.description.length === 0) {
      fail(`index package ${entry.name} must include description`);
    }

    const expectedPath = `packages/${entry.name}`;
    if (entry.path !== expectedPath) {
      fail(`index package ${entry.name} path must be ${expectedPath}`);
    }

    const packageDir = path.join(packagesDir, entry.name);
    if (!fs.existsSync(packageDir)) {
      fail(`index package ${entry.name} directory missing: ${packageDir}`);
    }

    const fsVersions = listVersionsForPackage(packageDir);
    const sortedVersions = [...entry.versions].sort(compareVersions);

    if (JSON.stringify(sortedVersions) !== JSON.stringify(entry.versions)) {
      fail(`index package ${entry.name} versions must be sorted`);
    }

    const uniqueVersions = [...new Set(entry.versions)];
    if (uniqueVersions.length !== entry.versions.length) {
      fail(`index package ${entry.name} versions must be unique`);
    }

    if (JSON.stringify(fsVersions) !== JSON.stringify(entry.versions)) {
      fail(`index package ${entry.name} versions do not match filesystem`);
    }

    const maxVersion = sortedVersions[sortedVersions.length - 1];
    if (entry.latestVersion !== maxVersion) {
      fail(`index package ${entry.name} latestVersion must equal max version (${maxVersion})`);
    }
  }

  console.log(`registry-index.test: validated ${index.packages.length} package index entries`);
}
