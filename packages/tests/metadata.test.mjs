import fs from 'node:fs';
import path from 'node:path';
import {
  computeSha256,
  extractEnvKeys,
  extractSubworkRefs,
  fail,
  listPackageNames,
  listVersionsForPackage,
  parseRef,
  readJson,
  relativePosix,
} from './lib/test-utils.mjs';

function assertUnique(values, context) {
  const unique = new Set(values);
  if (unique.size !== values.length) {
    fail(`${context} must be unique`);
  }
}

function equalStringArrays(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function normalizeDescription(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function run({ packagesDir }) {
  const packageNames = listPackageNames(packagesDir);
  let metaCount = 0;

  for (const packageName of packageNames) {
    const packageDir = path.join(packagesDir, packageName);
    const versions = listVersionsForPackage(packageDir);

    for (const version of versions) {
      metaCount += 1;
      const versionDir = path.join(packageDir, version);
      const metaPath = path.join(versionDir, 'meta.json');
      const meta = readJson(metaPath);

      if (meta.schemaVersion !== 'v1') {
        fail(`meta.schemaVersion must be v1: ${relativePosix(packagesDir, metaPath)}`);
      }
      if (meta.name !== packageName) {
        fail(`meta.name mismatch in ${relativePosix(packagesDir, metaPath)}`);
      }
      if (meta.version !== version) {
        fail(`meta.version mismatch in ${relativePosix(packagesDir, metaPath)}`);
      }
      if (!Array.isArray(meta.workflows) || meta.workflows.length === 0) {
        fail(`meta.workflows must be a non-empty array: ${relativePosix(packagesDir, metaPath)}`);
      }
      if (!Array.isArray(meta.defaultInstallRefs)) {
        fail(`meta.defaultInstallRefs must be an array: ${relativePosix(packagesDir, metaPath)}`);
      }
      if (!meta.checksums || typeof meta.checksums !== 'object' || Array.isArray(meta.checksums)) {
        fail(`meta.checksums must be an object: ${relativePosix(packagesDir, metaPath)}`);
      }
      if (!Array.isArray(meta.env)) {
        fail(`meta.env must be an array: ${relativePosix(packagesDir, metaPath)}`);
      }

      const refs = [];

      for (const [index, entry] of meta.workflows.entries()) {
        if (!entry || typeof entry !== 'object') {
          fail(`meta.workflows[${index}] must be an object in ${relativePosix(packagesDir, metaPath)}`);
        }

        parseRef(entry.ref);
        refs.push(entry.ref);

        const { provider, workflow, version: refVersion } = parseRef(entry.ref);
        const expectedPath = `workflows/${provider}/${workflow}/${refVersion}/workflow.json`;
        if (entry.path !== expectedPath) {
          fail(`workflow path mismatch for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}; expected ${expectedPath}, got ${entry.path}`);
        }

        const workflowPath = path.join(versionDir, entry.path);
        if (!fs.existsSync(workflowPath)) {
          fail(`workflow file missing for ${entry.ref}: ${relativePosix(packagesDir, workflowPath)}`);
        }

        const raw = fs.readFileSync(workflowPath, 'utf8');
        if (raw.includes('_pbd_nebula_type')) {
          fail(`legacy _pbd_nebula_type found in ${relativePosix(packagesDir, workflowPath)}`);
        }

        const workflowJson = readJson(workflowPath);
        const metaDescription = normalizeDescription(entry.description || '');
        const workflowDescription = normalizeDescription(workflowJson.description || '');
        if (workflowDescription.length > 0 && metaDescription.length === 0) {
          fail(`description missing for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}`);
        }
        if (workflowDescription.length > 0 && metaDescription.length > 0 && metaDescription !== workflowDescription) {
          fail(`description mismatch for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}`);
        }

        const expectedSubworkRefs = extractSubworkRefs(workflowJson.ruleset);
        const expectedEnvKeys = extractEnvKeys(workflowJson.ruleset);

        const subworkRefs = Array.isArray(entry.subworkRefs) ? [...entry.subworkRefs].sort((a, b) => a.localeCompare(b)) : null;
        const requiredEnvKeys = Array.isArray(entry.requiredEnvKeys) ? [...entry.requiredEnvKeys].sort((a, b) => a.localeCompare(b)) : null;
        const optionalEnvKeys = Array.isArray(entry.optionalEnvKeys) ? [...entry.optionalEnvKeys].sort((a, b) => a.localeCompare(b)) : null;

        if (!subworkRefs || !requiredEnvKeys || !optionalEnvKeys) {
          fail(`workflow env/subwork metadata arrays missing for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}`);
        }

        if (!equalStringArrays(subworkRefs, expectedSubworkRefs)) {
          fail(`subworkRefs mismatch for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}`);
        }

        if (!equalStringArrays(requiredEnvKeys, expectedEnvKeys.requiredEnvKeys)) {
          fail(`requiredEnvKeys mismatch for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}`);
        }

        if (!equalStringArrays(optionalEnvKeys, expectedEnvKeys.optionalEnvKeys)) {
          fail(`optionalEnvKeys mismatch for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}`);
        }

        const checksum = computeSha256(workflowPath);
        if (meta.checksums[entry.ref] !== checksum) {
          fail(`checksum mismatch for ${entry.ref} in ${relativePosix(packagesDir, metaPath)}`);
        }
      }

      assertUnique(refs, `meta.workflows refs in ${relativePosix(packagesDir, metaPath)}`);
      refs.sort((a, b) => a.localeCompare(b));

      const checksumRefs = Object.keys(meta.checksums).sort((a, b) => a.localeCompare(b));
      if (!equalStringArrays(checksumRefs, refs)) {
        fail(`meta.checksums keys do not match workflow refs in ${relativePosix(packagesDir, metaPath)}`);
      }

      const defaultInstallRefs = [...meta.defaultInstallRefs];
      assertUnique(defaultInstallRefs, `defaultInstallRefs in ${relativePosix(packagesDir, metaPath)}`);

      for (const ref of defaultInstallRefs) {
        if (!refs.includes(ref)) {
          fail(`defaultInstallRefs includes unknown ref ${ref} in ${relativePosix(packagesDir, metaPath)}`);
        }
      }

      for (const [index, envEntry] of meta.env.entries()) {
        if (!envEntry || typeof envEntry !== 'object') {
          fail(`env[${index}] must be an object in ${relativePosix(packagesDir, metaPath)}`);
        }
        if (typeof envEntry.key !== 'string' || envEntry.key.length === 0) {
          fail(`env[${index}].key must be a non-empty string in ${relativePosix(packagesDir, metaPath)}`);
        }
        if (typeof envEntry.required !== 'boolean') {
          fail(`env[${index}].required must be boolean in ${relativePosix(packagesDir, metaPath)}`);
        }
        if (typeof envEntry.description !== 'string' || envEntry.description.length === 0) {
          fail(`env[${index}].description must be a non-empty string in ${relativePosix(packagesDir, metaPath)}`);
        }
      }
    }
  }

  console.log(`metadata.test: validated ${metaCount} meta file(s)`);
}
