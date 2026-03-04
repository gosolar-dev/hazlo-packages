# AGENTS.md

## Purpose

`factory/` is the workflow factory for this repository.

It is the only area for workflow authoring and release preparation.

`packages/` is publish output and must be produced by pipeline scripts.

## Required Flow

1. Create in `factory/hazlo_workflows/**`
2. Iterate with `hazlo workflows describe` and `hazlo workflows eval`
3. Gate with:
   - `node factory/scripts/lint-workflows.mjs --manifest ...`
   - `node factory/scripts/eval-smoke.mjs --manifest ...`
4. Publish with:
   - `node factory/scripts/promote-package.mjs --manifest ... [--dry-run]`

## OpenAPI Pipeline (Default)

Use an OpenAPI-first creation flow whenever a provider spec is available:

1. Save spec under `factory/openapi/<provider>/...`
2. Generate workflows with:
   - `node factory/scripts/create-workflow.mjs import-openapi --spec factory/openapi/<provider>/openapi.yaml --provider <provider> --host https://api.example.com --version v1`
3. Refine generated files in `factory/hazlo_workflows/<provider>/**`
4. Run strict gates before publish

Manual `new` scaffolding is fallback only when there is no usable OpenAPI spec.

## MCP Requirement

For easier OpenAPI discovery during workflow development, keep the OpenAPI Directory MCP server enabled in your local tooling:

- [`openapi-directory-mcp`](https://github.com/rawveg/openapi-directory-mcp)

## Script Entry Points

- `factory/scripts/create-workflow.mjs`
- `factory/scripts/lint-workflows.mjs`
- `factory/scripts/eval-smoke.mjs`
- `factory/scripts/promote-package.mjs`
- `factory/scripts/migrate-node-key.mjs`

## Structural Rules

- Workflow ref format: `<provider>/<workflow>/<version>`
- Source path format: `factory/hazlo_workflows/<provider>/<workflow>/<version>/workflow.json`
- Typed node key must be `_pbd_hazlo_type`
- `_pbd_nebula_type` is disallowed

## Release Manifest Rules

- Use `factory/releases/<package>/<version>/release.json`
- Version must be explicit (`vN`)
- Use `mode: full` or `mode: refs`
- `defaultInstallRefs` must exist in the candidate set
- Smoke tests must reference deterministic fixtures

## Safety and Scope

- Do not modify `bin/hazlo`
- Do not add runtime/engine implementation code
- Do not commit secrets
- Use `.hazlo` env store for local secrets

## Validation Before Merge

Run:

```bash
node factory/scripts/lint-workflows.mjs --manifest <manifest>
node factory/scripts/eval-smoke.mjs --manifest <manifest>
node packages/tests/run.mjs
```
