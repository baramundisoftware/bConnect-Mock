# bConnect Mock — Consumer Integration Guide

This guide explains how each consumer project uses bConnect Mock for integration testing.
All integration tests use **real HTTP connections** against a running mock instance (see ADR-010).

---

## Quick Start

```bash
# Build the mock (from bConnect-Mock/)
npm run build

# Start in the profile your consumer needs (see table below)
PORT=8765 BCONNECT_PROFILE=standard-readwrite BCONNECT_BMS_VERSION=26r1 \
  RATE_LIMIT_ENABLED=false node build/index.js
```

**Always set `RATE_LIMIT_ENABLED=false`** when running integration tests. The default
rate limit (100 req/min per IP) will produce false failures when test suites fire
many requests quickly.

---

## Consumer Profile Matrix

| Consumer | Profile | BMS Version | Port | Why |
|---|---|---|---|---|
| n8n baramundi connector (smoke) | `minimal-readwrite` | `26r1` | `8765` | Fast; all node operations; CRUD available |
| n8n baramundi connector (full E2E) | `standard-readwrite` | `26r1` | `8765` | Realistic data volumes |
| bConnect-MCP (read tests) | `minimal-readonly` | `26r1` | `3433` | Isolated, no side-effects |
| bConnect-MCP (write tests) | `standard-readwrite` | `26r1` | `3433` | Full CRUD via MCP tools |
| bMCWeb_V2_0 (UI integration) | `standard-readonly` | `26r1` | `3433` | Realistic data; GET-only isolation |
| bMCWeb_V2_0 (performance) | `largescale-readonly` | `26r1` | `3433` | 70K+ endpoints for load testing |

---

## Consumer 1: n8n baramundi connector

**Location:** `/path/to/n8nconnector`
**Status:** ✅ E2E suite implemented and passing (REQ-8.3 satisfied)

### What the E2E suite tests

7 test files covering the full n8n node surface:

| File | Tests | What it covers |
|---|---|---|
| `admin.e2e.test.ts` | 47 | Health check, reset, profile info |
| `endpoint.e2e.test.ts` | 34 | Windows/Mac/Android/Linux endpoints: list, get, search, CRUD |
| `software.e2e.test.ts` | 35 | Software inventory: list, get, filter, version matching |
| `job.e2e.test.ts` | 32 | Job definitions, instances, execution stubs |
| `asset.e2e.test.ts` | 19 | Hardware assets: list, get, filter |
| `resourceLocator.e2e.test.ts` | 14 | GUID-based resource selection across all entity types |
| `security.e2e.test.ts` | 29 | Rate limiting, input validation, error handling |

**Total: 210 tests**

### How to run

```bash
# 1. Start mock (if not running)
cd /path/to/bConnect-Mock
PORT=8765 BCONNECT_PROFILE=standard-readwrite BCONNECT_BMS_VERSION=26r1 \
  RATE_LIMIT_ENABLED=false node build/index.js &

# Wait for health
until curl -sf http://localhost:8765/health; do sleep 1; done
echo "✅ Mock ready"

# 2. Run E2E suite
cd /path/to/n8nconnector
npx vitest run test/e2e/ --pool=forks --poolOptions.forks.singleFork
```

### Test configuration

The helpers file (`test/e2e/helpers.ts`) configures the mock URL:

```typescript
export const MOCK_URL  = 'http://localhost:8765/bconnect';
export const MOCK_USER = 'Administrator';
export const MOCK_PASS = 'password';
```

The mock accepts any credentials — auth bypass is intentional (see ADR-009).

### Expected results

```
Test Files  7 passed (7)
     Tests  210 passed (210)
  Duration  ~2s
```

### Notes

- Tests run sequentially (`--poolOptions.forks.singleFork`) to avoid rate limit
  false failures on the mock. Keep `RATE_LIMIT_ENABLED=false` to remove this
  constraint if parallelism is needed.
- `security.e2e.test.ts` verifies the mock's own security boundaries (rate limit
  headers, input validation, error format) — these tests are about the mock itself.

---

## Consumer 2: bConnect-MCP

**Location:** `/path/to/bConnect-MCP`
**Status:** 📋 P8.1/P8.2 — real-HTTP integration run not yet executed

### Background

bConnect-MCP's own integration test suite (`src/__tests__/integration/`) uses
**MSW (Mock Service Worker)** internally — it does not call bConnect Mock.
MSW intercepts the HTTP client at the Node.js level and returns fixture data,
so these tests run without any external process.

For REQ-8.1 validation, the goal is to verify that bConnect-MCP's MCP tools
produce correct results when the underlying HTTP calls actually reach bConnect Mock.

### Option A: Point the existing integration suite at bConnect Mock

bConnect-MCP's integration tests use `BConnectClient` with `baseUrl` hardcoded to
`https://bms.example.com:444/bconnect`. To run them against the mock instead:

```bash
# 1. Start mock
cd /path/to/bConnect-Mock
PORT=3433 BCONNECT_PROFILE=standard-readwrite BCONNECT_BMS_VERSION=26r1 \
  RATE_LIMIT_ENABLED=false node build/index.js &

# 2. Override the base URL (check if BConnectClient reads env vars)
# Option: set env var if supported
BCONNECT_BASE_URL=http://localhost:3433/bconnect \
  npx vitest run src/__tests__/integration/

# Option: edit .env.test or vitest.config.ts to point at localhost:3433
```

### Option B: bConnect-MCP Mock-Integration project

A dedicated integration project exists at:
```
/path/to/bConnect-MCP-Mock-Integration/
```

This is the intended path for REQ-8.1/P8.1 validation — check this directory
for how to run the MCP tools against the live mock.

```bash
ls /path/to/bConnect-MCP-Mock-Integration/
```

### What "passing" means for bConnect-MCP

- All MCP tool `list_*` calls return valid paginated responses (not errors)
- All MCP tool `get_*` calls return a single entity for a known GUID
- Write tools (`create_*`, `update_*`, `delete_*`) return success on readwrite profile
- Write tools return a clear error (not crash) on readonly profile
- No MCP tool crashes or throws an unhandled exception

---

## Consumer 3: bMCWeb_V2_0

**Location:** `/path/to/bMCWeb_V2_0`
**Status:** 📋 P8.3/P8.4 — integration run not yet executed

### Architecture

bMCWeb_V2_0 is a full-stack application:
- **Frontend** (`frontend/`) — Vite/React, calls the backend API
- **Backend** (`backend/`) — Node.js/Express, proxies to bConnect via `BCONNECT_BASE_URL`

For integration testing with bConnect Mock, only the **backend** needs to be
redirected — point `BCONNECT_BASE_URL` at the mock instead of a live bMS server.

### How to run against bConnect Mock

```bash
# 1. Start bConnect Mock
cd /path/to/bConnect-Mock
PORT=3433 BCONNECT_PROFILE=standard-readonly BCONNECT_BMS_VERSION=26r1 \
  RATE_LIMIT_ENABLED=false node build/index.js &

# 2. Configure bMCWeb_V2_0 backend to use mock
cd /path/to/bMCWeb_V2_0/backend
cat > .env.test << 'EOF'
PORT=3001
NODE_ENV=test
BCONNECT_BASE_URL=http://localhost:3433/bconnect
BCONNECT_USERNAME=Administrator
BCONNECT_PASSWORD=password
NODE_TLS_REJECT_UNAUTHORIZED=0
JWT_SECRET=test-secret
EOF

# 3. Run bMCWeb backend tests
NODE_ENV=test npx vitest run
# or
npm test
```

### Performance test (largescale-readonly)

```bash
# Start with largescale profile for performance testing
PORT=3433 BCONNECT_PROFILE=largescale-readonly BCONNECT_BMS_VERSION=26r1 \
  RATE_LIMIT_ENABLED=false node build/index.js &

# Then run bMCWeb performance tests / load test
# The mock serves 70,000+ endpoints with lazy generation — no memory spikes
```

### What "passing" means for bMCWeb_V2_0

- All backend API routes that proxy to bConnect return valid JSON (not 502/503)
- Pagination works correctly — `PageSize` and `PageIndex` params forwarded correctly
- `SearchQuery` filtering returns a subset of results
- Write operations on standard-readwrite profile return 201/200/204 (not errors)
- The frontend loads without "Failed to fetch" or network errors

---

## Response Format Reference

bConnect Mock returns all list responses in this format:

```json
{
  "data": [ { "id": "...", "displayName": "..." } ],
  "pageSize": 10,
  "page": 0,
  "totalItems": 10
}
```

> **Note:** This uses `data`/`totalItems` keys, not the OpenAPI spec's `Items`/`Count`.
> Consumer clients should map accordingly, or configure their HTTP client to use
> the mock's actual response shape. The n8nconnector handles this via its
> `tryOp` abstraction.

---

## State Management in Integration Tests

**Read-only profiles** (`minimal-readonly`, `standard-readonly`, `largescale-readonly`):
- Data never changes between requests
- Safe to run tests in parallel
- Write operations return `501 Not Implemented`
- Ideal for GET-heavy consumer tests

**Read-write profiles** (`minimal-readwrite`, `standard-readwrite`):
- State persists in memory across requests within a process lifetime
- Use `POST /api/reset` to restore initial fixtures between test runs

```bash
# Reset state between test cases (readwrite profiles only)
curl -X POST http://localhost:3433/api/reset
# Returns: 200 { "message": "State reset to initial fixtures" }
```

In vitest:
```typescript
afterEach(async () => {
  await fetch('http://localhost:3433/api/reset', { method: 'POST' });
});
```

---

## Health Check

Always verify the mock is healthy before running integration tests:

```bash
curl -sf http://localhost:3433/health | jq .
```

Expected response:
```json
{
  "status": "ok",
  "profile": "standard-readwrite",
  "bmsVersion": "26r1",
  "uptime": 42,
  "requestCount": 0
}
```

Verify that `profile` and `bmsVersion` match what your consumer test expects.

---

## CI Integration

To run consumer integration tests in CI, add a service step to start the mock:

```yaml
# GitHub Actions example
- name: Start bConnect Mock
  run: |
    PORT=3433 BCONNECT_PROFILE=standard-readwrite BCONNECT_BMS_VERSION=26r1 \
      RATE_LIMIT_ENABLED=false node build/index.js &
    echo "Waiting for mock..."
    for i in $(seq 1 20); do
      curl -sf http://localhost:3433/health && echo "✅ Mock ready" && break
      sleep 1
    done
  working-directory: /path/to/bConnect-Mock

- name: Run consumer integration tests
  run: npm test
  working-directory: /path/to/consumer-project
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ECONNREFUSED localhost:3433` | Mock not started | Start mock before running tests |
| `429 Too Many Requests` | Rate limit hit | Set `RATE_LIMIT_ENABLED=false` |
| `501 Not Implemented` on write | Wrong profile | Use `standard-readwrite` for CRUD tests |
| `404` on 26R1-only routes | Wrong bMS version | Set `BCONNECT_BMS_VERSION=26r1` |
| State leaks between test runs | Shared readwrite profile | Call `POST /api/reset` in `afterEach` |
| Flaky tests at high concurrency | Rate limit with default settings | Set `RATE_LIMIT_ENABLED=false` |

See also: [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
