# AGENTS.md

## Purpose

This repository is a hazlo workflow playground.

It is intentionally lightweight and includes:
- the `hazlo` executable
- workflow schema in `schema/workflow.schema.json`
- local workflows in `hazlo_workflows/**` (including examples)

It does **not** include hazlo runtime/source code, and should not be used for engine development.

## Primary Workflow (OpenAPI First)

Default authoring flow in this repo:

1. Start from OpenAPI documentation (`.yaml` or `.json`)
2. Generate workflows with `hazlo workflows import-openapi`
3. Refine generated `workflow.json` files
4. Validate with `describe` and `eval`

Use this command pattern:

```bash
./bin/hazlo workflows import-openapi \
  --spec ./openapi.yaml \
  --provider acme \
  --host https://api.acme.com \
  --version v1
```

Generated files are expected at:

`hazlo_workflows/<provider>/<operationId>/<version>/workflow.json`

Use `--force` only when you intentionally want to overwrite generated files.

## Repository Scope Rules

- Keep changes focused on:
  - `hazlo_workflows/**`
  - `schema/**`
  - docs (`README.md`, examples)
  - config files (for local workflow execution)
- Do not add hazlo source/runtime implementation code.
- Do not modify the `hazlo` binary.
- Do not commit secrets.

## Workflow Conventions

- Workflow references use `<provider>/<workflow>/<version>`.
- Typed nodes use `_pbd_hazlo_type`.
- Keep JSON valid and cleanly formatted.
- Keep `input` and `inputRequired` aligned with actual runtime needs.
- Keep metadata consistent (`meta.provider`, `meta.operationId`).

## Standard Commands

```bash
# CLI help
./bin/hazlo --help
./bin/hazlo workflows --help

# Discover workflows
./bin/hazlo workflows list
./bin/hazlo workflows list <provider>
./bin/hazlo workflows describe --ref <provider>/<workflow>/<version>

# Evaluate workflows
./bin/hazlo workflows eval --ref <provider>/<workflow>/<version> --input '{}'

# Import from OpenAPI (preferred)
./bin/hazlo workflows import-openapi --spec ./openapi.yaml --provider <provider> --host https://api.example.com --version v1

# Manual scaffold (fallback when no OpenAPI spec exists)
./bin/hazlo workflows new --ref <provider>/<workflow>/v1 --host https://api.example.com --path /resource --method GET
```

## Validation Checklist (Before Merging)

- `./bin/hazlo workflows list` shows expected refs.
- `./bin/hazlo workflows describe --ref ...` works for changed workflows.
- `./bin/hazlo workflows eval --ref ... --input ...` succeeds for representative inputs.
- If shared examples are affected, re-run:
  - `examples/schemaHelper/v1`
  - `examples/schemaAllNodes/v1`

## Secrets and Environment

Use hazlo env store for sensitive values:

```bash
./bin/hazlo workflows env set --key API_TOKEN --value '<token>'
./bin/hazlo workflows env list
```

Runtime injects these as `env.<KEY>`.

Never store tokens in workflow JSON, examples, or docs.

## Local Config

If needed, configure local paths via `.hazlo_config`:

```json
{
  "workflowsDir": "./bin/hazlo_workflows",
  "envFile": "./env.json"
}
```

## Out of Scope

If work requires changing hazlo CLI/runtime behavior, stop and move that task to the main hazlo source repository.
