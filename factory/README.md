# Hazlo Factory

Factory is the source-of-truth workspace for creating, iterating, evaluating, and promoting workflows into `packages/`.

## Directory Contract

- `hazlo_workflows/`: authoring source files
- `scripts/`: pipeline automation
- `releases/<package>/<version>/release.json`: promotion config
- `fixtures/inputs` and `fixtures/expected`: deterministic smoke test fixtures
- `schema/release-manifest.schema.json`: release manifest schema
- `openapi/`: OpenAPI specs used for imports
- `reports/`: generated smoke mismatch artifacts

## 1) Create

```bash
node factory/scripts/create-workflow.mjs new \
  --ref acme/getStatus/v1 \
  --host https://api.example.com \
  --path /status \
  --method GET

node factory/scripts/create-workflow.mjs import-openapi \
  --spec factory/openapi/acme/openapi.yaml \
  --provider acme \
  --host https://api.example.com \
  --version v1
```

Both commands enforce `factory/hazlo_workflows` as the base directory.

### OpenAPI-First Pipeline

Prefer OpenAPI import when a provider spec exists:

```bash
node factory/scripts/create-workflow.mjs import-openapi \
  --spec factory/openapi/<provider>/openapi.yaml \
  --provider <provider> \
  --host https://api.example.com \
  --version v1
```

Then refine generated workflows and run lint/smoke gates before publish.

### MCP for OpenAPI Discovery

For faster API workflow development, keep this MCP server enabled in your local environment:

- [`openapi-directory-mcp`](https://github.com/rawveg/openapi-directory-mcp)

## 2) Iterate

```bash
./bin/hazlo workflows describe --ref examples/schemaHelper/v1
./bin/hazlo workflows eval --ref examples/schemaHelper/v1 --input '{"name":"Ada"}'
```

## 3) Evaluate (strict)

```bash
node factory/scripts/lint-workflows.mjs --manifest factory/releases/examples/v1/release.json
node factory/scripts/eval-smoke.mjs --manifest factory/releases/examples/v1/release.json
```

`lint-workflows` enforces:
- no `_pbd_nebula_type`
- valid path/ref/version shape
- `hazlo workflows describe` success for all candidate refs
- `defaultInstallRefs` membership

`eval-smoke` enforces:
- deterministic manifest-defined smoke cases
- expected JSON snapshot match
- no `api_req` workflows in smoke set

## 4) Publish (Factory -> Packages)

```bash
node factory/scripts/promote-package.mjs --manifest factory/releases/examples/v1/release.json --dry-run
node factory/scripts/promote-package.mjs --manifest factory/releases/examples/v1/release.json
```

Promotion behavior:
- supports `mode: full` and `mode: refs`
- refuses overwrite when `packages/<package>/<version>` already exists
- stages output in temp directory
- generates `meta.json` (workflows, subwork refs, env keys, checksums)
- updates `packages/index.json`
- runs `packages/tests/run.mjs` against staged output before writing

## Manifest Fields

Each `release.json` includes:
- `schemaVersion`, `package`, `version`, `provider`, `mode`
- `refs` (required for `mode: refs`)
- `description`, `defaultInstallRefs`, `env`
- `homepage`, `license`, `tags`
- `smokeTests` (`ref`, `input`, `expected`)

See `schema/release-manifest.schema.json`.

## Canonical Node Key

All typed nodes must use `_pbd_hazlo_type`.

Use migration helper when needed:

```bash
node factory/scripts/migrate-node-key.mjs --root factory/hazlo_workflows --root packages
```
