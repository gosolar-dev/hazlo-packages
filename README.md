# hazlo-packages

Monorepo for community-installable Hazlo workflow packages.

`factory/` is the authoring and release pipeline area.
`packages/` is published output consumed by `hazlo workflows install` and `hazlo workflows ls --source remote`.

## Repository Layout

- `factory/hazlo_workflows/<provider>/<workflow>/<version>/workflow.json`: source workflows
- `factory/releases/<package>/<version>/release.json`: publish manifest contract
- `factory/scripts/*.mjs`: create, lint, smoke-eval, migration, and promotion scripts
- `factory/schema/release-manifest.schema.json`: manifest schema
- `factory/fixtures/*`: deterministic smoke test fixtures
- `packages/index.json`: package catalog
- `packages/<package>/<version>/...`: published package files (`README.md`, `meta.json`, `workflows/...`)
- `packages/tests/*`: central package contract test suite

## Pipeline Commands

```bash
# 1) create
node factory/scripts/create-workflow.mjs new --ref acme/getStatus/v1 --host https://api.example.com --path /status --method GET
node factory/scripts/create-workflow.mjs import-openapi --spec factory/openapi/acme/openapi.yaml --provider acme --host https://api.example.com --version v1

# 2) evaluate gates
node factory/scripts/lint-workflows.mjs --manifest factory/releases/examples/v1/release.json
node factory/scripts/eval-smoke.mjs --manifest factory/releases/examples/v1/release.json

# 3) publish (strict gate + staged package tests)
node factory/scripts/promote-package.mjs --manifest factory/releases/examples/v1/release.json --dry-run
node factory/scripts/promote-package.mjs --manifest factory/releases/examples/v1/release.json

# package contract tests
node packages/tests/run.mjs

# one-time key migration helper
node factory/scripts/migrate-node-key.mjs --root factory/hazlo_workflows --root packages
```

## Rules

- Author only in `factory/`.
- Do not hand-edit `packages/` workflow payloads.
- Canonical typed node key is `_pbd_hazlo_type`.
- Never commit secrets; use `.hazlo/env.json` and local env store commands.
