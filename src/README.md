# Source Directory Structure

## Overview

This directory contains the bConnect Mock V2.0 source code. The mock is a
version-aware (25R2 / 26R1) Express server that serves generated data and, on
readwrite profiles, maintains in-memory CRUD state.

## Directory Layout

```
src/
├── app.ts             # Express app assembly (security, middleware, route registration)
├── index.ts           # Server startup (reads PORT / BCONNECT_* env vars)
├── cli.ts             # CLI entry point (bin: bconnect-mock)
├── openapi.ts         # OpenAPI/Swagger spec, served at /api-docs
├── validateFixtureIntegrity.ts   # Startup fixture validation
├── routes/            # Express route handlers, one file per API domain
│   ├── endpoints.ts, jobs.ts, software.ts, groups.ts, compliance.ts, …
│   ├── factories/     # Reusable route factories (CRUD, sub-resource lists)
│   └── index.ts       # Version-aware route registration
├── generators/        # Lazy, deterministic data generators
│   ├── BaseGenerator.ts, IDataGenerator.ts, index.ts
│   └── <Entity>Generator.ts   # WindowsEndpoint, Android, iOS, Industrial, AD, …
├── profiles/          # ProfileManager — profile selection & data resolution
├── state/             # StateManager — in-memory CRUD state (readwrite profiles)
├── middleware/        # Express middleware (apiKeyGuard, validateBody)
└── generated/         # OpenAPI-generated TypeScript types (committed to the repo)
    ├── 25r2/ , 26r1/  # Version-specific generated types
    └── *.types.ts     # Shared domain types
```

> JSON fixtures live in the repository-root `fixtures/` directory, not under `src/`.

## Request Flow

Routes are registered in `routes/index.ts` (version-aware for 25R2 / 26R1) and
wired up in `app.ts`. A request flows:

```
middleware (security headers, apiKeyGuard, validateBody)
  → route handler (src/routes/<domain>.ts)
    → data source:
        • list / readonly data  → generators/ (lazy, deterministic) + fixtures/
        • readwrite CRUD state   → state/StateManager.ts
```

## Key Design Patterns

1. **Version-aware routing:** `routes/index.ts` registers only the routes valid
   for the selected `BCONNECT_BMS_VERSION` (25R2 or 26R1).

2. **Profile strategy:** `ProfileManager` selects the active data profile.
   Readonly profiles reject write methods with **HTTP 403**; readwrite profiles
   mutate in-memory state via `StateManager`.

3. **Lazy, deterministic generation:** large-scale profiles generate data
   on-demand, pagination-aware (only the requested page), so the same query
   always yields the same result.

4. **Route factories:** common CRUD and sub-resource-list behaviour is produced
   by factories in `routes/factories/` rather than duplicated per domain.

## Development Guidelines

- Follow TypeScript strict mode.
- Use the OpenAPI-generated types in `generated/` (regenerate via
  `npm run generate-types`).
- Write unit tests under `tests/unit/`.
- Document public APIs with TSDoc comments.
