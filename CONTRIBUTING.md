# Contributing to bConnect V2.0 Mock API

Thank you for your interest in contributing to the bConnect V2.0 Mock API! This document provides guidelines and workflows for developers contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Test-Driven Development (TDD)](#test-driven-development-tdd)
- [Code Quality Standards](#code-quality-standards)
- [Testing Guidelines](#testing-guidelines)
- [Git Workflow](#git-workflow)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Common Tasks](#common-tasks)

---

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback in code reviews
- Follow the project's technical standards
- Ask questions when unclear

---

## Getting Started

### Prerequisites

- **Node.js:** >= 20.0.0
- **npm:** >= 9.0.0
- **Git:** Latest stable version

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/baramundisoftware/bConnect-Mock.git
cd bConnect-Mock

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify setup
npm test
```

### Verify Your Environment

```bash
# Check TypeScript compilation
npm run type-check

# Check code style
npm run lint

# Run all tests with coverage
npm run test:coverage
```

Expected results:
- ✅ Build completes without errors
- ✅ All tests pass
- ✅ Coverage >= 80%
- ✅ Zero ESLint warnings

---

## Development Workflow

We follow **Test-Driven Development (TDD)** for all feature development and bug fixes.

### The TDD Cycle: Red-Green-Refactor

```
┌─────────────────────────────────────┐
│  1. RED: Write failing test         │ ← Start here
│     (Define expected behavior)       │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  2. GREEN: Make test pass            │
│     (Write minimal code)             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  3. REFACTOR: Improve code           │
│     (Clean up, optimize)             │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│  4. REPEAT: Next test                │
│     (Add more test cases)            │
└─────────────────────────────────────┘
```

### Why TDD?

- **Better Design:** Writing tests first encourages testable, modular code
- **Fewer Bugs:** Bugs caught during development, not after release
- **Refactoring Confidence:** Tests provide a safety net for changes
- **Living Documentation:** Tests document expected behavior
- **Higher Coverage:** Ensures all code is tested (80%+ target)

---

## Test-Driven Development (TDD)

### Step-by-Step TDD Example

Let's implement a new feature: **Filtering Windows endpoints by OS version**

#### Step 1: RED - Write Failing Test

Create or update `tests/unit/filters/osVersionFilter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { filterByOSVersion } from '@/utils/filters';
import type { components } from '@/generated/endpoints.types';

type WindowsEndpoint = components['schemas']['WindowsEndpoint'];

describe('filterByOSVersion', () => {
  it('should filter endpoints by OS version', () => {
    const endpoints: WindowsEndpoint[] = [
      { id: '1', displayName: 'PC-001', operatingSystem: 'Windows 11 Pro' },
      { id: '2', displayName: 'PC-002', operatingSystem: 'Windows 10 Enterprise' },
      { id: '3', displayName: 'PC-003', operatingSystem: 'Windows 11 Pro' },
    ];

    const result = filterByOSVersion(endpoints, 'Windows 11');

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('3');
  });
});
```

Run the test (it will fail):
```bash
npm run test:watch

# Output:
# ❌ filterByOSVersion is not defined
```

#### Step 2: GREEN - Make Test Pass

Create `src/utils/filters.ts`:

```typescript
import type { components } from '@/generated/endpoints.types';

type WindowsEndpoint = components['schemas']['WindowsEndpoint'];

export function filterByOSVersion(
  endpoints: WindowsEndpoint[],
  osVersion: string
): WindowsEndpoint[] {
  return endpoints.filter((endpoint) =>
    endpoint.operatingSystem?.includes(osVersion)
  );
}
```

Run the test again:
```bash
npm run test:watch

# Output:
# ✅ should filter endpoints by OS version
```

#### Step 3: REFACTOR - Improve Code

Add error handling and null safety:

```typescript
export function filterByOSVersion(
  endpoints: WindowsEndpoint[],
  osVersion: string
): WindowsEndpoint[] {
  if (!osVersion || osVersion.trim() === '') {
    return endpoints; // Return all if no filter
  }

  return endpoints.filter((endpoint) => {
    const os = endpoint.operatingSystem?.toLowerCase() || '';
    return os.includes(osVersion.toLowerCase());
  });
}
```

Add test for edge cases:

```typescript
describe('filterByOSVersion', () => {
  // ... previous test ...

  it('should return all endpoints when filter is empty', () => {
    const endpoints: WindowsEndpoint[] = [
      { id: '1', displayName: 'PC-001', operatingSystem: 'Windows 11 Pro' },
    ];

    const result = filterByOSVersion(endpoints, '');

    expect(result).toHaveLength(1);
  });

  it('should handle case-insensitive matching', () => {
    const endpoints: WindowsEndpoint[] = [
      { id: '1', displayName: 'PC-001', operatingSystem: 'Windows 11 Pro' },
    ];

    const result = filterByOSVersion(endpoints, 'WINDOWS 11');

    expect(result).toHaveLength(1);
  });
});
```

Run tests again:
```bash
npm run test:watch

# Output:
# ✅ should filter endpoints by OS version
# ✅ should return all endpoints when filter is empty
# ✅ should handle case-insensitive matching
```

#### Step 4: REPEAT - Add More Tests

Continue adding tests for:
- Multiple OS versions (Windows 10 OR Windows 11)
- Invalid input handling
- Performance with large datasets

---

## Code Quality Standards

### TypeScript

- **Strict Mode:** Enabled (`tsconfig.json`)
- **Type Safety:** No `any` types (use `unknown` and type guards)
- **Type Generation:** Use `openapi-typescript` for API types
- **Documentation:** TSDoc comments for public APIs

Example:
```typescript
/**
 * Filters Windows endpoints by operating system version.
 *
 * @param endpoints - Array of Windows endpoints to filter
 * @param osVersion - OS version string to match (case-insensitive)
 * @returns Filtered array of endpoints
 *
 * @example
 * ```typescript
 * const filtered = filterByOSVersion(endpoints, 'Windows 11');
 * ```
 */
export function filterByOSVersion(
  endpoints: WindowsEndpoint[],
  osVersion: string
): WindowsEndpoint[] {
  // ...
}
```

### ESLint

Run linting before committing:
```bash
npm run lint

# Auto-fix issues:
npm run lint:fix
```

Common rules:
- No unused variables
- Consistent naming (camelCase for variables, PascalCase for types)
- No console.log (use logger instead)
- Explicit return types for functions

### Code Formatting

We use Prettier for consistent formatting:

```bash
# Check formatting
npm run format:check

# Auto-format all files
npm run format
```

---

## Testing Guidelines

### Test Types

We follow the **Test Pyramid** approach:

```
         /\
        /E2E\          10% (full server, real HTTP)
       /------\
      /  INT   \       20% (module integration)
     /----------\
    /    UNIT    \     70% (function-level, fast)
   /--------------\
```

### Unit Tests (70% of tests)

**When:** Testing individual functions, classes, utilities
**Speed:** < 1 second for all unit tests
**Isolation:** Mock all external dependencies

Example:
```typescript
// tests/unit/utils/pagination.test.ts
import { describe, it, expect } from 'vitest';
import { paginate } from '@/utils/pagination';

describe('paginate', () => {
  it('should return first page with PageSize=2', () => {
    const items = [1, 2, 3, 4, 5];
    const result = paginate(items, { page: 0, pageSize: 2 });

    expect(result.data).toEqual([1, 2]);
    expect(result.totalCount).toBe(5);
    expect(result.page).toBe(0);
    expect(result.pageSize).toBe(2);
  });
});
```

### Integration Tests (20% of tests)

**When:** Testing HTTP endpoints, module interactions
**Speed:** < 5 seconds for all integration tests
**Isolation:** In-memory fixtures, no external services

Example:
```typescript
// tests/integration/endpoints/windowsEndpoints.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '@/app';
import { ProfileMode } from '@/profiles/ProfileManager';

describe('GET /v2.0/WindowsEndpoints', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.MINIMAL_READONLY);
  });

  it('should return 200 and endpoint array', async () => {
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('should support pagination', async () => {
    const response = await request(app)
      .get('/v2.0/WindowsEndpoints')
      .query({ PageSize: 1, Page: 0 })
      .expect(200);

    expect(response.body).toHaveLength(1);
  });
});
```

### End-to-End Tests (10% of tests)

**When:** Testing full workflows, consumer project integration
**Speed:** < 30 seconds for all E2E tests
**Isolation:** Real server, real fixtures, real HTTP requests

Example:
```typescript
// tests/e2e/fullCRUD.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer, stopServer } from '@/server';

describe('Full CRUD Lifecycle', () => {
  beforeAll(async () => {
    await startServer({ profile: 'minimal-readwrite', port: 3001 });
  });

  afterAll(async () => {
    await stopServer();
  });

  it('should complete full CRUD lifecycle', async () => {
    const baseUrl = 'http://localhost:3001';

    // CREATE
    const createResponse = await request(baseUrl)
      .post('/v2.0/WindowsEndpoints')
      .send({ displayName: 'TEST-PC', operatingSystem: 'Windows 11' })
      .expect(201);

    const id = createResponse.body.id;

    // READ
    const readResponse = await request(baseUrl)
      .get(`/v2.0/WindowsEndpoints/${id}`)
      .expect(200);

    expect(readResponse.body.displayName).toBe('TEST-PC');

    // UPDATE
    await request(baseUrl)
      .put(`/v2.0/WindowsEndpoints/${id}`)
      .send({ displayName: 'TEST-PC-UPDATED' })
      .expect(200);

    // DELETE
    await request(baseUrl)
      .delete(`/v2.0/WindowsEndpoints/${id}`)
      .expect(204);

    // VERIFY DELETED
    await request(baseUrl)
      .get(`/v2.0/WindowsEndpoints/${id}`)
      .expect(404);
  });
});
```

### Coverage Requirements

| Phase | Coverage Target | Enforcement |
|-------|----------------|-------------|
| Phase 0 | 70%+ | Advisory |
| Phase 1+ | 80%+ | **Strict (CI fails)** |
| Phase 5+ | 90%+ | **Strict (CI fails)** |

Check coverage:
```bash
npm run test:coverage

# View HTML report
open coverage/index.html
```

### Test Naming Conventions

Use descriptive test names that explain the expected behavior:

```typescript
// ❌ Bad
it('test endpoint', () => { ... });

// ✅ Good
it('should return 200 and array of endpoints for minimal-readonly profile', () => { ... });

// ✅ Good (Given-When-Then)
it('should return 404 when endpoint ID does not exist', () => { ... });
```

### Test Organization

```
tests/
├── unit/                   # Fast, isolated tests (70%)
│   ├── profiles/
│   ├── utils/
│   └── generators/
├── integration/            # HTTP endpoint tests (20%)
│   ├── endpoints/
│   ├── middleware/
│   └── profiles/
└── e2e/                    # Full workflow tests (10%)
    ├── bConnect-MCP.test.ts
    └── fullCRUD.test.ts
```

---

## Git Workflow

### Branching Strategy

We use **GitHub Flow** (simplified):

```
main (protected)
  └── feature/add-os-filter
  └── fix/pagination-bug
  └── docs/update-readme
```

### Branch Naming

- **Features:** `feature/<short-description>`
- **Fixes:** `fix/<issue-number>-<description>`
- **Docs:** `docs/<description>`
- **Refactoring:** `refactor/<description>`

Examples:
- `feature/add-os-version-filter`
- `fix/123-pagination-off-by-one`
- `docs/update-contributing-guide`

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `chore:` Build/tooling changes

**Examples:**

```bash
# Good commit messages
git commit -m "feat(endpoints): add OS version filtering to WindowsEndpoints"
git commit -m "fix(pagination): correct off-by-one error in page calculation"
git commit -m "test(filters): add unit tests for filterByOSVersion function"
git commit -m "docs(readme): update quick start guide with profile examples"

# With body
git commit -m "feat(endpoints): add OS version filtering

Implements filterByOSVersion utility function that supports:
- Case-insensitive matching
- Partial string matching (Windows 11 matches 'Windows 11 Pro')
- Empty filter returns all endpoints

Closes #42"
```

---

## Pull Request Process

### Before Creating a PR

1. **Run all checks locally:**
   ```bash
   npm run lint           # ESLint passes
   npm run type-check     # TypeScript compiles
   npm test               # All tests pass
   npm run test:coverage  # Coverage >= 80%
   ```

2. **Update documentation:**
   - Update README.md if user-facing changes
   - Update API docs if endpoint changes
   - Add/update JSDoc comments

3. **Commit all changes:**
   ```bash
   git add .
   git commit -m "feat(endpoints): add OS version filtering"
   ```

### Creating a PR

1. **Push your branch:**
   ```bash
   git push origin feature/add-os-filter
   ```

2. **Create PR on GitHub:**
   - Title: `feat(endpoints): add OS version filtering`
   - Description template:

   ```markdown
   ## Summary
   Adds OS version filtering to WindowsEndpoints API.

   ## Changes
   - [x] Add `filterByOSVersion` utility function
   - [x] Add 5 unit tests (100% coverage)
   - [x] Update integration tests
   - [x] Update API documentation

   ## Test Plan
   - [x] Unit tests pass (5/5)
   - [x] Integration tests pass
   - [x] Manual testing with curl
   - [x] Coverage: 85% (target: 80%)

   ## Checklist
   - [x] Tests written and passing
   - [x] ESLint passes (zero warnings)
   - [x] TypeScript compiles (zero errors)
   - [x] Documentation updated
   - [x] Coverage >= 80%

   Closes #42
   ```

3. **Request review:**
   - Assign to Lead Developer
   - Tag relevant team members

### PR Review Process

**For Authors:**
- Address all review comments
- Re-request review after changes
- Keep PR scope focused (one feature/fix per PR)

**For Reviewers:**
- Check TDD compliance (tests written first?)
- Verify test coverage (>= 80%)
- Review code quality (follows standards?)
- Test locally if needed

### Merging

After approval:
1. **Squash and merge** (preferred for features)
2. **Rebase and merge** (for multiple logical commits)
3. **Delete branch** after merge

---

## Project Structure

```
bconnect-mock/
├── src/                    # Source code
│   ├── app.ts             # Express app setup
│   ├── server.ts          # Server lifecycle
│   ├── routes/            # API routes
│   ├── middleware/        # Express middleware
│   ├── profiles/          # Profile management
│   ├── fixtures/          # Data fixtures
│   ├── generators/        # Lazy data generators
│   ├── utils/             # Utilities
│   └── generated/         # OpenAPI-generated types
│
├── tests/                  # Test suite
│   ├── unit/              # Unit tests (70%)
│   ├── integration/       # Integration tests (20%)
│   └── e2e/               # E2E tests (10%)
│
├── docs/                   # Documentation
│   ├── ADR-*.md           # Architectural decisions
│   └── API.md             # API reference
│
├── scripts/                # Build/utility scripts
│   └── generate-types.sh  # OpenAPI type generation
│
├── .github/
│   └── workflows/
│       └── ci.yml         # GitHub Actions CI
│
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── vitest.config.ts        # Test config
├── .eslintrc.json          # ESLint config
├── .prettierrc.json        # Prettier config
├── README.md               # Project overview
└── CONTRIBUTING.md         # This file
```

---

## Common Tasks

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (TDD workflow)
npm run test:watch

# Run specific test file
npx vitest tests/unit/utils/pagination.test.ts

# Run tests matching pattern
npx vitest --grep "pagination"

# Generate coverage report
npm run test:coverage

# View HTML coverage report
open coverage/index.html
```

### Building the Project

```bash
# Full build (TypeScript compilation)
npm run build

# Watch mode (rebuilds on file changes)
npm run dev

# Clean build artifacts
npm run clean
```

### Generating Types from OpenAPI

```bash
# Download latest OpenAPI specs and generate types
npm run generate-types

# Output: src/generated/*.types.ts
```

### Starting the Mock Server

```bash
# Minimal profile (1 endpoint, fast startup)
BCONNECT_MOCK_PROFILE=minimal-readonly npm start

# Standard profile (20 endpoints, realistic data)
BCONNECT_MOCK_PROFILE=standard-readonly npm start

# Large-scale profile (70K endpoints, lazy loading)
BCONNECT_MOCK_PROFILE=largescale-readonly npm start

# Read-write mode (supports CRUD operations)
BCONNECT_MOCK_PROFILE=minimal-readwrite npm start
```

### Debugging

```bash
# Run with Node debugger
node --inspect build/index.js

# VS Code launch config
{
  "type": "node",
  "request": "launch",
  "name": "Debug bConnect Mock",
  "program": "${workspaceFolder}/build/index.js",
  "env": {
    "BCONNECT_MOCK_PROFILE": "minimal-readonly",
    "LOG_LEVEL": "debug"
  }
}
```

### Linting and Formatting

```bash
# Check code style
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Check formatting
npm run format:check

# Auto-format all files
npm run format
```

---

## Additional Resources

- **Project Documentation:** [README.md](README.md)
- **API Documentation:** [docs/API.md](docs/API.md)
- **Architectural Decisions:** [docs/ADR-INDEX.md](docs/ADR-INDEX.md)
- **Testing Strategy:** [docs/ADR-003-Testing-Strategy.md](docs/ADR-003-Testing-Strategy.md)
- **vitest Documentation:** https://vitest.dev
- **TDD Resources:** https://testdriven.io
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/

---

## Getting Help

- **Issues:** Create an issue on GitHub for bugs or feature requests
- **Discussions:** Use GitHub Discussions for questions
- **Code Reviews:** Tag `@lead-developer` for urgent reviews

---

**Thank you for contributing!** 🎉

Your contributions help make the bConnect V2.0 Mock API better for everyone.
