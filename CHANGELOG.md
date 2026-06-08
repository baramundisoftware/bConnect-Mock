# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-09

Initial release. Mock server for the baramundi bConnect V2.0 REST API.

- 6 data profiles: minimal/standard/largescale x readonly/readwrite
- 264 endpoints (26R1 mode) / 172 endpoints (25R2 mode)
- Swagger UI at /api-docs
- Pagination, search, sort on all list endpoints
- Full CRUD on readwrite profiles with in-memory state
- Rate limiting, CORS, input validation, HTTP security headers
- Docker support
