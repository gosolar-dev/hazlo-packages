import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, '../../..');
export const factoryDir = path.join(repoRoot, 'factory');
export const workflowsDir = path.join(factoryDir, 'hazlo_workflows');
export const hazloBin = path.join(repoRoot, 'bin', 'hazlo');
export const packagesDir = path.join(repoRoot, 'packages');

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

    if (Object.prototype.hasOwnProperty.call(args, key)) {
      if (Array.isArray(args[key])) {
        args[key].push(value);
      } else {
        args[key] = [args[key], value];
      }
    } else {
      args[key] = value;
    }
  }

  return args;
}

export function getMultiArg(args, key) {
  const value = args[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

export function info(message) {
  console.log(message);
}

export function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

export function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`unable to read JSON ${filePath}: ${error.message}`);
  }
}

export function writeJson(filePath, value) {
  const encoded = `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, encoded, 'utf8');
}

export function toPosixPath(filePath) {
  return filePath.split(path.sep).join('/');
}

export function toRelativePosix(fromDir, filePath) {
  return toPosixPath(path.relative(fromDir, filePath));
}

export function parseRef(ref) {
  const parts = ref.split('/');
  if (parts.length !== 3) {
    fail(`invalid workflow ref "${ref}"; expected <provider>/<workflow>/<version>`);
  }

  const [provider, workflow, version] = parts;
  const segmentPattern = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  const versionPattern = /^v\d+$/;

  if (!segmentPattern.test(provider) || !segmentPattern.test(workflow) || !versionPattern.test(version)) {
    fail(`invalid workflow ref "${ref}"; expected <provider>/<workflow>/<version> with version like v1`);
  }

  return { provider, workflow, version };
}

export function compareVersions(a, b) {
  const pattern = /^v(\d+)$/;
  const aMatch = a.match(pattern);
  const bMatch = b.match(pattern);

  if (aMatch && bMatch) {
    return Number(aMatch[1]) - Number(bMatch[1]);
  }

  return a.localeCompare(b);
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort();
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

export function refToWorkflowPath(ref, baseDir = workflowsDir) {
  const { provider, workflow, version } = parseRef(ref);
  return path.join(baseDir, provider, workflow, version, 'workflow.json');
}

export function listWorkflowRefs({ provider, version, baseDir = workflowsDir }) {
  const providerDir = path.join(baseDir, provider);
  if (!fs.existsSync(providerDir)) return [];

  const refs = [];
  const entries = fs.readdirSync(providerDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const workflowEntry of entries) {
    const workflow = workflowEntry.name;
    const filePath = path.join(providerDir, workflow, version, 'workflow.json');
    if (fs.existsSync(filePath)) {
      refs.push(`${provider}/${workflow}/${version}`);
    }
  }

  return refs.sort((a, b) => a.localeCompare(b));
}

function validateSmokeTests(smokeTests, manifestPath) {
  assert(Array.isArray(smokeTests), `${manifestPath}: smokeTests must be an array`);
  smokeTests.forEach((test, index) => {
    assert(test && typeof test === 'object', `${manifestPath}: smokeTests[${index}] must be an object`);
    assert(typeof test.ref === 'string' && test.ref.length > 0, `${manifestPath}: smokeTests[${index}].ref is required`);
    assert(typeof test.input === 'string' && test.input.length > 0, `${manifestPath}: smokeTests[${index}].input is required`);
    assert(typeof test.expected === 'string' && test.expected.length > 0, `${manifestPath}: smokeTests[${index}].expected is required`);
    if (test.name !== undefined) {
      assert(typeof test.name === 'string', `${manifestPath}: smokeTests[${index}].name must be a string when present`);
    }
  });
}

export function loadManifest(manifestArg) {
  assert(typeof manifestArg === 'string' && manifestArg.length > 0, '--manifest is required');
  const manifestPath = path.resolve(process.cwd(), manifestArg);
  const manifestDir = path.dirname(manifestPath);
  assert(fs.existsSync(manifestPath), `manifest not found: ${manifestPath}`);

  const manifest = readJson(manifestPath);

  assert(manifest.schemaVersion === 'v1', `${manifestPath}: schemaVersion must be "v1"`);
  assert(typeof manifest.package === 'string' && manifest.package.length > 0, `${manifestPath}: package is required`);
  assert(typeof manifest.version === 'string' && /^v\d+$/.test(manifest.version), `${manifestPath}: version must match /^v\\d+$/`);
  assert(typeof manifest.provider === 'string' && manifest.provider.length > 0, `${manifestPath}: provider is required`);
  assert(manifest.mode === 'full' || manifest.mode === 'refs', `${manifestPath}: mode must be "full" or "refs"`);
  assert(typeof manifest.description === 'string' && manifest.description.length > 0, `${manifestPath}: description is required`);
  assert(Array.isArray(manifest.defaultInstallRefs), `${manifestPath}: defaultInstallRefs must be an array`);
  assert(Array.isArray(manifest.env), `${manifestPath}: env must be an array`);
  assert(typeof manifest.homepage === 'string' && manifest.homepage.length > 0, `${manifestPath}: homepage is required`);
  assert(typeof manifest.license === 'string' && manifest.license.length > 0, `${manifestPath}: license is required`);
  assert(Array.isArray(manifest.tags), `${manifestPath}: tags must be an array`);

  validateSmokeTests(manifest.smokeTests, manifestPath);

  if (manifest.mode === 'refs') {
    assert(Array.isArray(manifest.refs) && manifest.refs.length > 0, `${manifestPath}: refs is required when mode=refs`);
  }

  for (const ref of manifest.defaultInstallRefs) {
    parseRef(ref);
  }

  if (manifest.refs !== undefined) {
    assert(Array.isArray(manifest.refs), `${manifestPath}: refs must be an array when present`);
    manifest.refs.forEach((ref) => parseRef(ref));
  }

  manifest.smokeTests.forEach((test) => parseRef(test.ref));

  return {
    manifest,
    manifestPath,
    manifestDir,
  };
}

export function resolveManifestRelative(manifestDir, maybeRelativePath) {
  if (path.isAbsolute(maybeRelativePath)) return maybeRelativePath;
  return path.resolve(manifestDir, maybeRelativePath);
}

export function buildCandidateRefs(manifest, baseDir = workflowsDir) {
  let refs = [];
  if (manifest.mode === 'full') {
    refs = listWorkflowRefs({
      provider: manifest.provider,
      version: manifest.version,
      baseDir,
    });
  } else {
    refs = uniqueSorted(manifest.refs);
  }

  assert(refs.length > 0, `no workflow refs resolved for ${manifest.provider}/${manifest.version}`);

  for (const ref of refs) {
    const parsed = parseRef(ref);
    assert(parsed.provider === manifest.provider, `ref ${ref} provider does not match manifest provider ${manifest.provider}`);
    assert(parsed.version === manifest.version, `ref ${ref} version does not match manifest version ${manifest.version}`);
  }

  return refs;
}

export function ensureDefaultRefsInCandidateSet(defaultInstallRefs, candidateRefs) {
  const candidateSet = new Set(candidateRefs);
  const missing = defaultInstallRefs.filter((ref) => !candidateSet.has(ref));
  if (missing.length > 0) {
    fail(`defaultInstallRefs contain refs not in candidate set: ${missing.join(', ')}`);
  }
}

export function findNebulaKeys(value, currentPath = '$') {
  const hits = [];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      hits.push(...findNebulaKeys(item, `${currentPath}[${index}]`));
    });
    return hits;
  }

  if (!value || typeof value !== 'object') {
    return hits;
  }

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${currentPath}.${key}`;
    if (key === '_pbd_nebula_type') {
      hits.push(childPath);
    }
    hits.push(...findNebulaKeys(child, childPath));
  }

  return hits;
}

export function runHazloDescribe(filePath) {
  execFileSync(hazloBin, ['workflows', 'describe', '--file', filePath], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

export function runHazloEvalRef(ref, inputObject) {
  const output = execFileSync(
    hazloBin,
    [
      'workflows',
      'eval',
      '--base-dir', toPosixPath(path.relative(repoRoot, workflowsDir)),
      '--ref', ref,
      '--skip-env-store',
      '--input', JSON.stringify(inputObject),
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    },
  );

  try {
    return JSON.parse(output);
  } catch (error) {
    fail(`hazlo eval output for ${ref} is not JSON: ${error.message}`);
  }
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

export function workflowContainsApiReq(ruleset) {
  let found = false;

  const visit = (node) => {
    if (found) return;

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    if (!node || typeof node !== 'object') {
      return;
    }

    if (node._pbd_hazlo_type === 'api_req') {
      found = true;
      return;
    }

    Object.values(node).forEach(visit);
  };

  visit(ruleset);

  return found;
}

export function computeSha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function ensureExecutable(filePath) {
  assert(fs.existsSync(filePath), `required executable not found: ${filePath}`);
}
