import fs from 'node:fs';
import path from 'node:path';
import {
  fail,
  listPackageNames,
  listVersionsForPackage,
  readJson,
  relativePosix,
  walkFiles,
} from './lib/test-utils.mjs';

export async function run({ packagesDir }) {
  if (!fs.existsSync(packagesDir)) {
    fail(`packages directory not found: ${packagesDir}`);
  }

  const packageNames = listPackageNames(packagesDir);
  if (packageNames.length === 0) {
    fail('no packages found under packages directory');
  }

  let workflowFileCount = 0;

  for (const packageName of packageNames) {
    const packageDir = path.join(packagesDir, packageName);
    const versions = listVersionsForPackage(packageDir);
    if (versions.length === 0) {
      fail(`package ${packageName} has no version directories`);
    }

    for (const version of versions) {
      if (!/^v\d+$/.test(version)) {
        fail(`package ${packageName} has invalid version folder: ${version}`);
      }

      const versionDir = path.join(packageDir, version);
      const readmePath = path.join(versionDir, 'README.md');
      const metaPath = path.join(versionDir, 'meta.json');
      const workflowsRoot = path.join(versionDir, 'workflows');

      if (!fs.existsSync(readmePath)) {
        fail(`missing README for ${packageName}/${version}`);
      }
      if (!fs.existsSync(metaPath)) {
        fail(`missing meta.json for ${packageName}/${version}`);
      }
      if (!fs.existsSync(workflowsRoot)) {
        fail(`missing workflows/ for ${packageName}/${version}`);
      }

      const workflowFiles = walkFiles(workflowsRoot, (filePath) => filePath.endsWith('workflow.json'));
      if (workflowFiles.length === 0) {
        fail(`no workflow files found in ${relativePosix(packagesDir, workflowsRoot)}`);
      }

      for (const workflowFile of workflowFiles) {
        workflowFileCount += 1;

        const relative = relativePosix(versionDir, workflowFile);
        const match = relative.match(/^workflows\/([^/]+)\/([^/]+)\/(v\d+)\/workflow\.json$/);
        if (!match) {
          fail(`workflow path does not match install structure: ${relative}`);
        }

        const [, provider, workflow, innerVersion] = match;
        if (innerVersion !== version) {
          fail(`workflow path version mismatch for ${provider}/${workflow}: folder=${version} path=${innerVersion}`);
        }

        const raw = fs.readFileSync(workflowFile, 'utf8');
        if (raw.includes('_pbd_nebula_type')) {
          fail(`legacy _pbd_nebula_type found in ${relativePosix(packagesDir, workflowFile)}`);
        }

        const parsed = readJson(workflowFile);
        if (!parsed || typeof parsed !== 'object' || !parsed.ruleset) {
          fail(`workflow file missing ruleset: ${relativePosix(packagesDir, workflowFile)}`);
        }
      }
    }
  }

  console.log(`structure.test: validated ${packageNames.length} package(s), ${workflowFileCount} workflow file(s)`);
}
