# hazlo-packages

A monorepo for testing out the npm-esque idea of including workflows that have been authored elsewhere

## Layout

- `packages/index.json`: package catalog used by `hazlo workflows ls --source remote`
- `packages/<package>/<version>/meta.json`: machine-readable package metadata
- `packages/<package>/<version>/README.md`: human docs for the package
- `packages/<package>/<version>/workflows/...`: versioned workflow definitions

Presenttly includes one package:

- `stripe-core@v1`
