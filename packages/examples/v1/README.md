# examples v1

Factory-native example workflows for validating the workflow authoring and publish pipeline.

## Included Workflows

- `examples/schemaHelper/v1`
- `examples/schemaAllNodes/v1`

## Usage

```bash
./bin/hazlo workflows describe --ref examples/schemaHelper/v1
./bin/hazlo workflows eval --ref examples/schemaHelper/v1 --input '{"name":"Ada"}'
```
