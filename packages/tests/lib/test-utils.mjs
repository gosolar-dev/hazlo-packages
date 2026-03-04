import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, '../../..');
export const defaultPackagesDir = path.join(repoRoot, 'packages');
export const defaultIndexFile = path.join(defaultPackagesDir, 'index.json');

export function parseArgs(argv = process.argv.slice(2)) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    const value = next && !next.startsWith('--') ? (i += 1, next) : true;

    args[key] = value;
  }

  return args;
}

export function fail(message) {
  throw new Error(message);
}

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`unable to read JSON ${filePath}: ${error.message}`);
  }
}

export function walkFiles(dirPath, predicate = () => true) {
  if (!fs.existsSync(dirPath)) return [];

  const files = [];
  const stack = [dirPath];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
      } else if (entry.isFile() && predicate(absolute)) {
        files.push(absolute);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

export function relativePosix(fromDir, filePath) {
  return toPosixPath(path.relative(fromDir, filePath));
}

export function parseRef(ref) {
  const parts = ref.split('/');
  if (parts.length !== 3) {
    fail(`invalid ref ${ref}`);
  }

  const [provider, workflow, version] = parts;
  const segmentPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  const versionPattern = /^v\d+$/;

  if (!segmentPattern.test(provider) || !segmentPattern.test(workflow) || !versionPattern.test(version)) {
    fail(`invalid ref ${ref}`);
  }

  return { provider, workflow, version };
}

export function compareVersions(a, b) {
  const matchA = /^v(\d+)$/.exec(a);
  const matchB = /^v(\d+)$/.exec(b);

  if (matchA && matchB) {
    return Number(matchA[1]) - Number(matchB[1]);
  }

  return a.localeCompare(b);
}

export function listPackageNames(packagesDir) {
  return fs.readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => !name.startsWith('.') && name !== 'tests')
    .sort((a, b) => a.localeCompare(b));
}

export function listVersionsForPackage(packageDir) {
  return fs.readdirSync(packageDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => /^v\d+$/.test(name))
    .sort(compareVersions);
}

export function computeSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function ensureDefaults(args) {
  return {
    packagesDir: path.resolve(process.cwd(), args['packages-dir'] || defaultPackagesDir),
    indexFile: path.resolve(process.cwd(), args['index-file'] || defaultIndexFile),
  };
}

export function extractSubworkRefs(ruleset) {
  const refs = new Set();

  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    if (node._pbd_hazlo_type === 'subwork') {
      if (typeof node.workflow === 'string' && node.workflow.length > 0) {
        refs.add(node.workflow);
      }
      if (
        node.workflowId
        && typeof node.workflowId === 'object'
        && node.workflowId._pbd_hazlo_type === 'str'
        && typeof node.workflowId.val === 'string'
      ) {
        refs.add(node.workflowId.val);
      }
    }

    Object.values(node).forEach(visit);
  };

  visit(ruleset);
  return [...refs].sort((a, b) => a.localeCompare(b));
}

export function extractEnvKeys(ruleset) {
  const required = new Set();
  const optional = new Set();

  const visit = (node) => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    if (node._pbd_hazlo_type === 'var' && typeof node.keyPath === 'string' && node.keyPath.startsWith('env.')) {
      const key = node.keyPath.slice(4).split('.')[0];
      if (key.length > 0) {
        if (node.optional === false) {
          required.add(key);
        } else {
          optional.add(key);
        }
      }
    }

    Object.values(node).forEach(visit);
  };

  visit(ruleset);

  required.forEach((key) => optional.delete(key));

  return {
    requiredEnvKeys: [...required].sort((a, b) => a.localeCompare(b)),
    optionalEnvKeys: [...optional].sort((a, b) => a.localeCompare(b)),
  };
}
