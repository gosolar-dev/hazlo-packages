# netlify v1

Generated Netlify API workflow package for Hazlo.

## Summary

- Provider: `netlify`
- Scope: full Netlify REST surface imported from OpenAPI
- Coverage: sites, deploys, builds, DNS, forms, snippets, hooks, accounts, and team workflows

## Default Install Refs

- `netlify/getCurrentUser/v1`
- `netlify/listSites/v1`
- `netlify/getSite/v1`
- `netlify/listSiteDeploys/v1`
- `netlify/createSiteDeploy/v1`
- `netlify/listSiteBuilds/v1`

## Auth Input

Most Netlify endpoints require bearer authentication.
Generated workflows include optional input key `authBearerAuth`.
Pass your Netlify personal access token and the workflow will send `Authorization: Bearer <token>`.

## Smoke Coverage

Deterministic smoke tests use `netlify/BuildApiRequest/v1` with fixtures under `factory/fixtures`.
