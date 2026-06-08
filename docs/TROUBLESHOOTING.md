# bConnect Mock V2.0 — Troubleshooting Guide

> Solutions for common problems. See [API.md](API.md) for endpoint reference and [README.md](../README.md) for setup instructions.

## Table of Contents

- [Server Won't Start](#server-wont-start)
- [Unexpected 404 Responses](#unexpected-404-responses)
- [Unexpected 501 Responses](#unexpected-501-responses)
- [Unexpected 400 Responses](#unexpected-400-responses)
- [Unexpected 429 Responses](#unexpected-429-responses)
- [Empty or Incorrect Data](#empty-or-incorrect-data)
- [Pagination Not Working As Expected](#pagination-not-working-as-expected)
- [CRUD Operations Not Persisting](#crud-operations-not-persisting)
- [Performance Problems](#performance-problems)
- [Test Isolation Issues](#test-isolation-issues)
- [TypeScript / Build Errors](#typescript--build-errors)

---

## Server Won't Start

### Problem: `Error: Cannot find module '...'`

**Cause:** Dependencies not installed.

**Fix:**
```bash
npm install
```

### Problem: `EADDRINUSE: address already in use :::3433`

**Cause:** Port 3433 is already in use by another process.

**Fix:**
```bash
# Find what is using port 3433
lsof -i :3433

# Either stop that process, or use a different port
BCONNECT_MOCK_PORT=3001 npm start
```

### Problem: `Unknown profile mode: ...`

**Cause:** `BCONNECT_MOCK_PROFILE` is set to an unrecognised value.

**Valid values:**
```
minimal-readonly
minimal-readwrite
standard-readonly
standard-readwrite
largescale-readonly
largescale-readwrite
```

**Fix:**
```bash
BCONNECT_MOCK_PROFILE=minimal-readonly npm start
```

---

## Unexpected 404 Responses

### Problem: `GET /v2.0/SomeEndpoint` returns 404

**Possible causes:**

1. **Route not registered.** Verify the path is listed in [API.md](API.md) or the Swagger UI at `/api-docs`.

2. **26R1-only endpoint in 25R2 mode.** Endpoints such as `/v2.0/Vulnerabilities` and `/v2.0/UniversalDynamicGroups` only exist in 26R1 mode.

   **Fix:**
   ```bash
   BMS_VERSION=26r1 BCONNECT_MOCK_PROFILE=largescale-readonly npm start
   ```

3. **ID does not exist.** `GET /v2.0/WindowsEndpoints/:id` returns 404 when the GUID is not in the dataset. Check available IDs first:
   ```bash
   curl http://localhost:3433/v2.0/WindowsEndpoints | jq '.data[0].id'
   ```

4. **Wrong base path.** The API base is `/v2.0/`, not `/api/v2/` or `/bconnect/v2.0/`.

---

## Unexpected 501 Responses

### Problem: `POST /v2.0/WindowsEndpoints` returns 501

**Cause:** The server is running in a read-only profile. POST, PUT, PATCH, and DELETE return `501 Not Implemented` in read-only profiles.

**Fix:** Use a readwrite profile:
```bash
BCONNECT_MOCK_PROFILE=minimal-readwrite npm start
# or
BCONNECT_MOCK_PROFILE=standard-readwrite npm start
```

**Exception:** Action paths (`/Start`, `/Stop`, `/Restart`) always return 200 even in read-only profiles — they represent mock triggers, not CRUD mutations.

---

## Unexpected 400 Responses

### Problem: `POST` returns `400 Missing required field: displayName`

**Cause:** The request body is missing a required field.

**Fix:** Include `displayName` in the request body:
```bash
curl -X POST http://localhost:3433/v2.0/WindowsEndpoints \
  -H "Content-Type: application/json" \
  -d '{"displayName": "MY-PC-001"}'
```

### Problem: `GET` returns `400` about `PageSize`

**Cause:** `PageSize` is outside the allowed range (0–100,000) or is negative.

```json
{ "error": "PageSize must be between 0 and 100000" }
```

**Fix:** Use a valid PageSize:
```bash
# Valid: omit for all, or use 1–100000
curl "http://localhost:3433/v2.0/WindowsEndpoints?PageSize=50"
```

### Problem: `GET` returns `400` about `Page`

**Cause:** `Page` is negative.

**Fix:**
```bash
curl "http://localhost:3433/v2.0/WindowsEndpoints?Page=0"
```

### Problem: `GET` returns `400` about `SearchQuery`

**Cause:** `SearchQuery` exceeds 500 characters.

**Fix:** Shorten the search string.

### Problem: `400` with `Content-Type` issues

**Cause:** The `Content-Type: application/json` header is missing on POST/PUT/PATCH requests.

**Fix:**
```bash
curl -X POST http://localhost:3433/v2.0/WindowsEndpoints \
  -H "Content-Type: application/json" \
  -d '{"displayName": "MY-PC-001"}'
```

---

## Unexpected 429 Responses

### Problem: Requests return `429 Too Many Requests`

**Cause:** Rate limiting is enabled (`RATE_LIMIT_ENABLED=true`) and the request limit has been exceeded.

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

**Fix options:**

1. **Wait** the number of seconds shown in the `Retry-After` response header.

2. **Increase the limit** for testing:
   ```bash
   RATE_LIMIT_ENABLED=true RATE_LIMIT_MAX=10000 npm start
   ```

3. **Disable rate limiting** (default state — no env var needed):
   ```bash
   # Simply don't set RATE_LIMIT_ENABLED
   BCONNECT_MOCK_PROFILE=standard-readonly npm start
   ```

---

## Empty or Incorrect Data

### Problem: List endpoint returns `[]` or `totalCount: 0`

**Possible causes:**

1. **SearchQuery too specific.** The filter returns no matches. Try omitting `SearchQuery`:
   ```bash
   curl http://localhost:3433/v2.0/WindowsEndpoints
   ```

2. **Profile has no data for this entity type.** The `minimal-*` profiles contain only a few items. Use `standard-*` or `largescale-*` for richer data:
   ```bash
   BCONNECT_MOCK_PROFILE=standard-readonly npm start
   ```

3. **State was deleted.** In readwrite profiles, if all records were deleted, the list is empty. Reset state:
   ```bash
   curl -X POST http://localhost:3433/api/reset
   ```

### Problem: Data changes between server restarts

**Expected behaviour:** This is by design. Read-only profiles always return the same fixture data. Readwrite profiles start from the fixture on each startup.

To preserve test state across server restarts, use the fixture files directly (`fixtures/standard-readwrite/*.json`).

---

## Pagination Not Working As Expected

### Problem: Getting the same items on every page

**Cause:** `Page` is not being incremented, or `PageSize` is set to a value larger than `totalCount`.

**Fix:** Increment `Page` and ensure `PageSize` is smaller than `totalCount`:
```bash
# Page 0 of 3 (5 items per page, 15 total)
curl "http://localhost:3433/v2.0/WindowsEndpoints?PageSize=5&Page=0"

# Page 1 of 3
curl "http://localhost:3433/v2.0/WindowsEndpoints?PageSize=5&Page=1"

# Page 2 of 3
curl "http://localhost:3433/v2.0/WindowsEndpoints?PageSize=5&Page=2"
```

### Problem: `totalCount` does not match expected count

**Cause:** A `SearchQuery` filter reduces the effective dataset. `totalCount` reflects the count *after* filtering.

**Example:**
```bash
# 10 total without filter
curl "http://localhost:3433/v2.0/WindowsEndpoints"
# {"totalCount": 10, ...}

# Only 2 match "NYC"
curl "http://localhost:3433/v2.0/WindowsEndpoints?SearchQuery=NYC"
# {"totalCount": 2, ...}
```

---

## CRUD Operations Not Persisting

### Problem: Created items disappear after some requests

**Cause:** State is in-memory only. Server restart or `POST /api/reset` clears all state.

**Prevention in tests:** Call `POST /api/reset` in `afterEach` / `afterAll` instead of restarting the server:
```typescript
afterEach(async () => {
  await fetch('http://localhost:3433/api/reset', { method: 'POST' });
});
```

### Problem: `PUT` / `PATCH` returns 404

**Cause:** The ID in the URL does not exist in the current state. This can happen if the state was reset, or if the item was never created in this session.

**Fix:** Check current IDs with `GET /v2.0/<EntityType>` before performing write operations.

---

## Performance Problems

### Problem: First request to a large-scale profile is slow

**Cause:** The large-scale profile initialises generator instances on the first request.

**Fix:** This is expected one-time overhead. Subsequent requests are fast (sub-millisecond for paginated reads without search/sort).

### Problem: Requests with `SearchQuery` or `OrderBy` are slow on large-scale profile

**Cause:** Filtering or sorting forces a full scan of all generated items (e.g., 60,000 Windows endpoints). This is by design — the generator produces all items for the scan.

**Recommendations:**
- Use `SearchQuery` and `OrderBy` sparingly in performance tests.
- For performance benchmarks, use plain paginated requests (`PageSize` + `Page` only).
- Consider the `standard-readonly` profile (10–20 items) for tests that need filtering.

### Problem: High memory usage with large-scale profile

**Cause:** A full-scan operation (SearchQuery or OrderBy) materialises all generated items into an array.

**Fix:** See performance recommendations above. For memory profiling, use the `standard-readonly` profile instead.

---

## Test Isolation Issues

### Problem: Tests pass individually but fail when run together

**Cause:** One test mutates state (in a readwrite profile) and leaves it dirty for subsequent tests.

**Fix:** Use `POST /api/reset` in your test setup/teardown:
```typescript
import { beforeEach } from 'vitest';

beforeEach(async () => {
  await request(app).post('/api/reset');
});
```

### Problem: Tests behave differently depending on run order

**Cause:** Same as above — shared mutable state. Alternatively, switch to read-only profiles for tests that only need GET operations:
```typescript
// For read-only tests — no state leakage possible
const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
```

---

## TypeScript / Build Errors

### Problem: `error TS2307: Cannot find module '...'`

**Fix:**
```bash
npm install
npx tsc --noEmit
```

### Problem: Type errors in generated files (`src/generated/*.ts`)

**Cause:** Generated types are out of sync with the OpenAPI specs.

**Fix:** Regenerate types:
```bash
npm run generate-types
```

### Problem: Lint errors on `npm run lint`

**Fix:** Auto-fix where possible:
```bash
npm run lint -- --fix
npm run format
```

---

## Still Stuck?

1. **Check the Swagger UI** at http://localhost:3433/api-docs for the exact request format.
2. **Enable debug logging** to see full request details:
   ```bash
   LOG_LEVEL=debug BCONNECT_MOCK_PROFILE=standard-readonly npm start
   ```
3. **Run the test suite** to verify the server is working correctly:
   ```bash
   npm test
   ```
4. **Open an issue** at https://github.com/baramundisoftware/bConnect-Mock/issues with:
   - The command you ran
   - The full request (URL + headers + body)
   - The full response (status + headers + body)
   - The profile and BMS version you're using
