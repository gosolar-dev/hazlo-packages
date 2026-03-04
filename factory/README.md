# hazlo Playground

hazlo Playground is a lightweight starter repository for building hazlo workflows without carrying hazlo source code.

## What’s Included
- `hazlo` executable
- `schema/workflow.schema.json`
- `hazlo_workflows/examples/*`
- this `README.md`

## Quick Start

1. Verify the CLI:
   ```bash
   chmod +x ./bin/hazlo
   ./bin/hazlo --help
   ```
2. List local workflows:
```bash
./bin/hazlo workflows list
./bin/hazlo workflows list examples
```

3. Run sample workflows:
```bash
./bin/hazlo workflows eval --ref examples/schemaHelper/v1 --input '{"name":"Ada"}'
./bin/hazlo workflows eval --ref examples/schemaAllNodes/v1 --input '{"name":"Ada","numbers":[1,2,3],"needle":"sunlight"}'
```
4. Inspect workflow metadata:
```bash
./bin/hazlo workflows describe --ref examples/schemaAllNodes/v1
```

## Create a new workflow
```bash
./bin/hazlo workflows new \
  --ref acme/getStatus/v1 \
  --host https://api.example.com \
  --path /status \
  --method GET
```
Then iterate with
```bash
./bin/hazlo workflows describe --ref acme/getStatus/v1
./bin/hazlo workflows eval --ref acme/getStatus/v1 --input '{}'
```
## Workflow Conventions

- Reference format: `<provider>/<workflow>/<version>`
- File location: `hazlo_workflows/<provider>/<workflow>/<version>/workflow.json`
- Schema authority: `schema/workflow.schema.json`
- Typed nodes use `_pbd_hazlo_type`

## Environment Values (Secrets)

Use hazlo’s local env store instead of committing secrets:
```bash
./bin/hazlo workflows env set --key API_TOKEN --value '<token>'
./bin/hazlo workflows env list
```
Values are injected under env.<KEY> during evaluation.

## Optional Local Config

Create .hazlo_config to pin directories:
```json
{
  "workflowsDir": "./bin/hazlo_workflows",
  "envFile": "./env.json"
}
```