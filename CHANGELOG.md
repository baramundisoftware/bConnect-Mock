# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
