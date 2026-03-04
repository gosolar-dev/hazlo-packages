#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  fail,
  getMultiArg,
  info,
  parseArgs,
  walkFiles,
} from './lib/pipeline.mjs';

const args = parseArgs();
if (args.help === true) {
  console.log('usage: node factory/scripts/migrate-node-key.mjs --root <path> [--root <path> ...] [--dry-run]');
  process.exit(0);
}
const roots = getMultiArg(args, 'root');
const dryRun = Boolean(args['dry-run']);

if (roots.length === 0) {
  fail('usage: node factory/scripts/migrate-node-key.mjs --root <path> [--root <path> ...] [--dry-run]');
}

function migrateValue(value) {
  if (Array.isArray(value)) {
    return value.map(migrateValue);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    const mappedKey = key === '_pbd_nebula_type' ? '_pbd_hazlo_type' : key;
    if (mappedKey === '_pbd_hazlo_type' && key === '_pbd_nebula_type' && Object.prototype.hasOwnProperty.call(next, '_pbd_hazlo_type')) {
      fail('encountered object with both _pbd_nebula_type and _pbd_hazlo_type; cannot migrate safely');
    }
    next[mappedKey] = migrateValue(child);
  }
  return next;
}

let scanned = 0;
let updated = 0;

for (const rootArg of roots) {
  const rootPath = path.resolve(process.cwd(), rootArg);
  if (!fs.existsSync(rootPath)) {
    fail(`root does not exist: ${rootPath}`);
  }

  const jsonFiles = walkFiles(rootPath, (filePath) => filePath.endsWith('.json'));
  for (const filePath of jsonFiles) {
    scanned += 1;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.includes('_pbd_nebula_type')) {
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      fail(`invalid JSON while migrating ${filePath}: ${error.message}`);
    }

    const migrated = migrateValue(parsed);
    const encoded = `${JSON.stringify(migrated, null, 2)}\n`;

    if (encoded !== raw) {
      updated += 1;
      if (!dryRun) {
        fs.writeFileSync(filePath, encoded, 'utf8');
      }
    }
  }
}

info(`${dryRun ? 'Dry-run migration summary' : 'Migration summary'}: scanned ${scanned} JSON file(s), ${updated} file(s) ${dryRun ? 'would be updated' : 'updated'}`);
