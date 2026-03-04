# github v1

Generated GitHub public REST workflow package for Hazlo.

## Summary

- Provider: `github`
- Focus: unauthenticated/public endpoint access
- Source: OpenAPI import from GitHub REST API v3 with curated public paths

## Included Public API Workflows

- `github/meta_root/v1`
- `github/meta_get/v1`
- `github/rate-limit_get/v1`
- `github/users_get-by-username/v1`
- `github/repos_get/v1`
- `github/repos_get-readme/v1`
- `github/repos_list-commits/v1`
- `github/repos_list-contributors/v1`
- `github/search_repos/v1`

## Deterministic Smoke Helper

- `github/BuildUnauthPublicRequest/v1`

This helper builds a request envelope for public endpoints without issuing HTTP calls.
Smoke tests validate request-shaping for repository lookup and repository search.

## Default Install Refs

- `github/meta_root/v1`
- `github/users_get-by-username/v1`
- `github/repos_get/v1`
- `github/search_repos/v1`
