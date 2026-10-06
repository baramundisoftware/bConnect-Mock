# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed
- The request log and `/metrics` missed every response sent before the logging middleware ran: module-routing 404/405 (#49), rate-limit 429 and auth 401. Both are now registered first, and the log shows the path as requested, with its module prefix (`/bconnect/compliance/v2.0/Rules`), instead of the stripped `/v2.0/Rules`

## [0.4.0] - 2026-10-06

### Changed
- **Breaking:** routes now answer only under the module prefix that owns them in the bConnect spec of the selected bMS version, as on a real bMS. A path without a module (`/v2.0/...`, `/bconnect/v2.0/...`), with an unknown module, or with a module that doesn't own the route gets 404; a route the spec doesn't declare gets 404, and an undeclared method on a declared path gets 405 with `Allow`. Set `BCONNECT_MODULE_ROUTING=lenient` to restore the previous behaviour. The route table is generated from the specs (`npm run generate-module-routes`) (#49)

### Fixed
- README and TROUBLESHOOTING named the profile variable `BCONNECT_MOCK_PROFILE` (default `minimal-readonly`), which the server ignores; it is `BCONNECT_PROFILE` (default `standard-readonly`) (#56)

### Upgrading from 0.3.x
- Use module-prefixed paths, e.g. `/bconnect/endpoints/v2.0/WindowsEndpoints` instead of `/v2.0/WindowsEndpoints`; each route's module is the spec file that declares it (`npm run generate-module-routes` lists them in `src/generated/moduleRoutes.ts`)
- Or set `BCONNECT_MODULE_ROUTING=lenient` to keep the 0.3.x behaviour

## [0.3.3] - 2026-10-06

### Security
- Resolved all 13 `npm audit` advisories, including critical `proxy-addr` IP spoofing (GHSA-jqcg-44mw-7w3h) and moderate `qs` / low `body-parser` DoS in runtime dependencies; dev-only fixes for `brace-expansion`, `postcss`, `js-yaml`, `nanoid`, `source-map-js`, `@redocly/openapi-core`, `@humanfs/node` and vitest (4.1.10 → 4.1.11) (#51)

### Fixed
- `POST /v2.0/LogicalGroups` now requires `name` as in the spec's `LogicalGroupForCreation` (25R2 + 26R1), instead of `displayName`; a body without `name` gets 400 naming `name`. Created groups also get `displayName` mirrored from `name`, so they read back like fixture groups. LogicalGroups search also matches the spec fields `name` and `comment` (#48)
- The OpenAPI document declares 403 (not 501) for writes on read-only profiles, matching the runtime (#33)

### Added
- `scripts/publish-image.sh` builds and publishes the multi-arch image locally, without GitHub Actions (#32)

### Changed
- The GHCR image `ghcr.io/baramundisoftware/bconnect-mock` is public; `docker pull` needs no login (#47)
- README and SECURITY.md state that this is not an official baramundi product, without baramundi support or SLA; security response times are best-effort (#52)
- Bumped dev dependencies: eslint 10.6.0 → 10.12.0 (#40), @typescript-eslint/parser 8.64.0 → 8.71.0 (#41), @typescript-eslint/eslint-plugin 8.62.1 → 8.64.0 (#21), vitest 4.1.1 → 4.1.10 (#22), prettier 3.8.1 → 3.9.5 (#24), tsx 4.23.0 → 4.23.1 (#37), @rolldown/binding-linux-arm64-gnu 1.0.3 → 1.1.5 (#23)
- Bumped CI actions: actions/setup-node 6 → 7 (#36), docker/setup-buildx-action → 4.4.1 (#30, #46), docker/build-push-action 7.3.0 → 7.4.0 (#45), docker/login-action → 4.6.0 (#30, #43), actions/download-artifact → 8 (#30)
- Corrected factual and command errors in the docs (#31, #33)

## [0.3.2] - 2026-07-10

### Security
- Resolved high/moderate `npm audit` advisories: form-data CRLF injection (GHSA-hmw2-7cc7-3qxx) and js-yaml quadratic-complexity DoS (#16)

### Changed
- Bumped runtime dependencies: zod 4.3.6 → 4.4.3 (#14), dotenv 17.3.1 → 17.4.2 (#11)
- Bumped dev dependencies: eslint 10.1.0 → 10.6.0 (#13), @typescript-eslint/eslint-plugin 8.57.2 → 8.62.1 (#12), tsx 4.21.0 → 4.23.0 (#10)
- Bumped CI actions: actions/checkout 4 → 7 (#15), actions/setup-node 4 → 6 (#9), docker/metadata-action 5 → 6 (#8), docker/build-push-action 5 → 7 (#7); clears the Node.js 20 deprecation warnings
- SBOM is now generated on demand; stopped committing `sbom.json` to the repository

### Fixed
- Removed forbidden non-null assertions in `WindowsUpdatesGenerator` and `updateManagement` route; lint is clean with 0 warnings (#17)
- Updated contact email to bernd.wiedemann@baramundi.de

## [0.3.1] - 2026-06-09

### Fixed
- Updated copyright from "baramundi software AG" to "baramundi software GmbH" across all files
- Removed premature `npm install -g` option from README (not yet published to npm)

### Added
- CI badge to README
- `.editorconfig` for contributor consistency

## [0.3.0] - 2026-06-09

Initial release. Mock server for the baramundi bConnect V2.0 REST API.

- 6 data profiles: minimal/standard/largescale x readonly/readwrite
- 264 endpoints (26R1 mode) / 228 endpoints (25R2 mode)
- Swagger UI at /api-docs
- Pagination, search, sort on all list endpoints
- Full CRUD on readwrite profiles with in-memory state
- Rate limiting, CORS, input validation, HTTP security headers
- Docker support
