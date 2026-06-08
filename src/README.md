# Source Directory Structure

## Overview

This directory contains the bConnect Mock V2.0 source code, organized by architectural layers.

## Directory Layout

```
src/
├── modules/           # API domain modules (Endpoints, Software, Jobs, etc.)
│   ├── endpoints/     # Endpoints module (Windows, Android, Linux, Mac)
│   ├── software/      # Software module
│   ├── jobs/          # Jobs module
│   ├── assets/        # Assets module
│   └── ...            # Other modules
├── profiles/          # Data profile managers
│   ├── ProfileManager.ts          # Profile loading and selection
│   ├── MinimalProfile.ts          # Minimal profile (readonly/readwrite)
│   ├── StandardProfile.ts         # Standard profile (readonly/readwrite)
│   └── LargeScaleProfile.ts       # Large-scale profile (readonly/readwrite)
├── fixtures/          # Test data fixtures (JSON files)
│   ├── minimal/       # Minimal profile fixtures
│   ├── standard/      # Standard profile fixtures
│   └── largescale/    # Large-scale profile generators
├── middleware/        # Express middleware
│   ├── readOnlyGuard.ts          # Block write methods for readonly profiles
│   ├── validation.ts              # Request validation (zod schemas)
│   ├── errorHandler.ts            # Global error handling
│   └── logging.ts                 # Request logging
├── utils/             # Utility functions
│   ├── dataGenerator.ts           # Lazy data generation
│   ├── pagination.ts              # Pagination logic
│   ├── filtering.ts               # SearchQuery filtering
│   └── sorting.ts                 # OrderBy sorting
├── generated/         # OpenAPI-generated TypeScript types (gitignored)
│   └── types.ts       # Generated from OpenAPI specs
└── index.ts           # Main entry point (server startup)
```

## Module Architecture

Each API module follows this structure:

```
modules/endpoints/
├── endpoints.controller.ts       # HTTP request handlers
├── endpoints.service.ts          # Business logic
├── endpoints.types.ts            # TypeScript types
└── endpoints.fixtures.ts         # Fixture data
```

## Key Design Patterns

1. **Layered Architecture:**
   - Controller → Service → Data (fixtures/generators)
   - Clear separation of concerns

2. **Profile Strategy Pattern:**
   - ProfileManager selects appropriate profile
   - Each profile implements IProfile interface
   - Readonly profiles return HTTP 501 for write methods

3. **Lazy Loading:**
   - Large-scale profiles generate data on-demand
   - Pagination-aware (only generate requested page)
   - Deterministic (same query = same result)

4. **Middleware Pipeline:**
   - Validation → ReadOnly Guard → Controller → Error Handler

## Development Guidelines

- Follow TypeScript strict mode
- Use OpenAPI-generated types from `generated/`
- Write unit tests in `tests/unit/` (mirror src/ structure)
- Document public APIs with TSDoc comments
- Use dependency injection where possible
