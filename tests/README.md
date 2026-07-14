# Test Directory Structure

## Overview

Comprehensive test suite following the Test Pyramid (70% unit, 20% integration, 10% E2E).

## Directory Layout

```
tests/
├── unit/              # Unit tests (fast, isolated — bulk of the suite)
│   ├── generators/    # Data-generator tests
│   ├── generated/     # Generated-type tests
│   ├── profiles/      # Profile manager tests
│   ├── factories/     # Route-factory tests
│   ├── fixtures/      # Fixture tests
│   └── audit/         # Route/spec audit tests
├── integration/       # Integration tests (in-memory, no external services)
│   ├── endpoints/     # Endpoint integration tests
│   ├── crud/          # CRUD lifecycle tests (readwrite profiles)
│   ├── catalog/       # Catalog tests
│   ├── concurrency/   # Concurrency tests
│   ├── coverage/      # Coverage-boost tests
│   ├── security/      # Security / OWASP tests
│   └── bconnect-mcp/  # bConnect-MCP consumer integration
├── e2e/               # End-to-end tests (server start → request → stop)
│   └── all-profiles.e2e.test.ts
└── performance/       # Performance benchmarks
    ├── response-time.test.ts
    └── largescale-generators.test.ts
```

## Testing Strategy

### Unit Tests (70%)
- Test individual functions and classes in isolation
- Mock external dependencies
- Fast execution (<1ms per test)
- Example: Test pagination logic with mock data

### Integration Tests (20%)
- Test multiple modules working together
- Use in-memory state (no external services)
- Moderate execution time (<100ms per test)
- Example: Test full CRUD lifecycle for WindowsEndpoints

### E2E Tests (10%)
- Test complete server lifecycle (start → request → stop)
- Real HTTP requests using supertest
- Slower execution (<1s per test)
- Example: Start server with minimal-readonly, make GET request, verify response

### Performance Tests
- Benchmark response times (P50, P95, P99)
- Memory profiling (heap usage, memory leaks)
- Load testing (concurrent requests)
- Compare against targets (minimal: <50ms, standard: <100ms, largescale: <500ms)

## Test Conventions

**File Naming:**
- Unit / integration / performance tests: `*.test.ts` (located by directory)
- E2E tests: `*.e2e.test.ts`

**Test Structure (AAA Pattern):**
```typescript
describe('GET /v2.0/WindowsEndpoints', () => {
  it('should return 1 endpoint for minimal-readonly profile', async () => {
    // Arrange: Set up test data and mocks
    const profile = 'minimal-readonly';
    const mockData = createMinimalFixture();

    // Act: Execute the function/endpoint
    const result = await getWindowsEndpoints(profile);

    // Assert: Verify the result
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ displayName: 'WIN-PC-001' });
  });
});
```

## Running Tests

```bash
# All tests
npm test

# Watch mode (TDD)
npm run test:watch

# Coverage report
npm run test:coverage

# Specific test file
npm test -- tests/unit/utils/pagination.test.ts

# E2E tests only
npm test -- tests/e2e/
```

## Coverage Targets

- Overall: ≥80% (target: 90%+)
- New code: ≥80% (enforced in PR checks)
- Critical paths: 100% (profile manager, state manager, validation)
