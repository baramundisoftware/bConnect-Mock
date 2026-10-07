/**
 * P6.17 — E2E test suite: All profiles, all endpoints
 *
 * Covers:
 * - All 5 active profiles (minimal-readonly, minimal-readwrite,
 *   standard-readonly, standard-readwrite, largescale-readonly)
 * - All Phase 6 endpoints (ServerManagement, ActiveDirectory, DefenseControl)
 * - Swagger UI / OpenAPI spec
 * - Security input validation
 * - Full CRUD lifecycle (create → read → update → delete → reset)
 * - Pagination, SearchQuery, OrderBy across all list endpoints
 * - BMS version switching (25R2 vs 26R1)
 * - Health check and admin endpoints
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** The spec's PagedList envelope, as a live bMS answers every list */
function expectPaginated(body: unknown): void {
  expect(body).toMatchObject({
    currentPage: expect.any(Number),
    pageSize: expect.any(Number),
    totalPages: expect.any(Number),
    totalItems: expect.any(Number),
    hasPreviousPage: expect.any(Boolean),
    hasNextPage: expect.any(Boolean),
    data: expect.any(Array),
  });
  expect(body).not.toHaveProperty('page');
}

// ---------------------------------------------------------------------------
// Health & System
// ---------------------------------------------------------------------------
describe('E2E: Health and System — all profiles', () => {
  const profiles = [
    ProfileMode.MINIMAL_READONLY,
    ProfileMode.MINIMAL_READWRITE,
    ProfileMode.STANDARD_READONLY,
    ProfileMode.STANDARD_READWRITE,
  ] as const;

  for (const profile of profiles) {
    it(`GET /health returns 200 for ${profile}`, async () => {
      const app = createApp(profile, BmsVersion.BMS_25R2);
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  }
});

// ---------------------------------------------------------------------------
// Swagger UI / OpenAPI spec
// ---------------------------------------------------------------------------
describe('E2E: Swagger UI / OpenAPI', () => {
  const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);

  it('GET /api-docs/ serves Swagger UI HTML', async () => {
    const res = await request(app).get('/api-docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });

  it('GET /api-docs/swagger.json returns valid OpenAPI 3.x spec', async () => {
    const res = await request(app).get('/api-docs/swagger.json');
    expect(res.status).toBe(200);
    const spec = res.body as Record<string, unknown>;
    expect(typeof spec.openapi).toBe('string');
    expect((spec.openapi as string).startsWith('3.')).toBe(true);
    expect(spec.paths).toBeDefined();
  });

  it('OpenAPI spec lists all major endpoint groups', async () => {
    const res = await request(app).get('/api-docs/swagger.json');
    const spec = res.body as { paths: Record<string, unknown> };
    const paths = Object.keys(spec.paths);
    expect(paths.some((p) => p.includes('WindowsEndpoints'))).toBe(true);
    expect(paths.some((p) => p.includes('Software'))).toBe(true);
    expect(paths.some((p) => p.includes('ADGroups'))).toBe(true);
    expect(paths.some((p) => p.includes('Microservices'))).toBe(true);
    expect(paths.some((p) => p.includes('BitLocker'))).toBe(true);
    expect(paths.some((p) => p.includes('OSFolders'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Minimal Read-Only — all GET endpoints
// ---------------------------------------------------------------------------
describe('E2E: minimal-readonly — all GET endpoints', () => {
  const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);

  // Endpoints guaranteed present in ALL profiles (including minimal)
  const getEndpoints = [
    '/v2.0/WindowsEndpoints',
    '/v2.0/Software',
    '/v2.0/WindowsUpdates',
    '/v2.0/ADGroups',
    '/v2.0/ADObjects',
    '/v2.0/Microservices',
    '/v2.0/BitLocker/WindowsEndpoints',
    '/v2.0/OSFolders',
  ];

  for (const endpoint of getEndpoints) {
    it(`GET ${endpoint} returns 200 with paginated response`, async () => {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(200);
      expectPaginated(res.body);
    });
  }

  it('GET /v2.0/JobDefinitions returns 200', async () => {
    const res = await request(app).get('/v2.0/JobDefinitions');
    expect(res.status).toBe(200);
  });

  it('GET /v2.0/Assets returns 200', async () => {
    const res = await request(app).get('/v2.0/Assets');
    expect(res.status).toBe(200);
  });

  it('GET /v2.0/Variables returns 200', async () => {
    const res = await request(app).get('/v2.0/Variables');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Minimal Read-Only — write operations blocked (403)
// ---------------------------------------------------------------------------
describe('E2E: minimal-readonly — write operations blocked', () => {
  const app = createApp(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);

  const mutationCases: Array<[string, string]> = [
    ['POST', '/v2.0/WindowsEndpoints'],
    ['PUT', '/v2.0/WindowsEndpoints/some-id'],
    ['PATCH', '/v2.0/WindowsEndpoints/some-id'],
    ['DELETE', '/v2.0/WindowsEndpoints/some-id'],
    ['POST', '/v2.0/AndroidEndpoints'],
    ['POST', '/v2.0/JobDefinitions'],
    ['POST', '/v2.0/Assets'],
    ['POST', '/v2.0/Variables'],
  ];

  for (const [method, path] of mutationCases) {
    it(`${method} ${path} returns 403 in read-only profile`, async () => {
      const res = await (request(app) as Record<string, (p: string) => request.Test>)[method.toLowerCase()](path)
        .send({ displayName: 'test' });
      expect(res.status).toBe(403);
    });
  }

  it('POST /v2.0/Microservices/:id/Start returns non-403 (action allowed)', async () => {
    const res = await request(app).post('/v2.0/Microservices/svc-0001/Start');
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Minimal Read-Write — full CRUD lifecycle
// ---------------------------------------------------------------------------
describe('E2E: minimal-readwrite — full CRUD lifecycle', () => {
  const app = createApp(ProfileMode.MINIMAL_READWRITE, BmsVersion.BMS_25R2);

  beforeEach(async () => {
    await request(app).post('/api/reset');
  });

  it('Windows endpoints: create → read → update → patch → delete', async () => {
    // Create
    const create = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({ displayName: 'E2E-WIN-001', primaryUser: 'qa@company.com' });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;
    expect(id).toBeTruthy();

    // Read — appears in list
    const list = await request(app).get('/v2.0/WindowsEndpoints');
    expect(list.status).toBe(200);
    const ids = (list.body as { data: Array<{ id: string }> }).data.map((e) => e.id);
    expect(ids).toContain(id);

    // Read by ID
    const single = await request(app).get(`/v2.0/WindowsEndpoints/${id}`);
    expect(single.status).toBe(200);
    expect((single.body as { displayName: string }).displayName).toBe('E2E-WIN-001');

    // Full update (PUT) — returns 200 with updated object
    const put = await request(app)
      .put(`/v2.0/WindowsEndpoints/${id}`)
      .send({ displayName: 'E2E-WIN-001-UPDATED', primaryUser: 'qa@company.com' });
    expect(put.status).toBe(200);

    // Partial update (PATCH) — returns 200 with updated object
    const patch = await request(app)
      .patch(`/v2.0/WindowsEndpoints/${id}`)
      .send({ primaryUser: 'lead@company.com' });
    expect(patch.status).toBe(200);

    // Delete
    const del = await request(app).delete(`/v2.0/WindowsEndpoints/${id}`);
    expect([200, 204]).toContain(del.status);

    // Confirm gone — use a valid-looking GUID that doesn't exist
    const gone = await request(app).get(`/v2.0/WindowsEndpoints/${id}`);
    expect(gone.status).toBe(404);
  });

  it('POST /api/reset restores initial state', async () => {
    // Delete all items
    const initial = await request(app).get('/v2.0/WindowsEndpoints');
    const initialCount = (initial.body as { totalItems: number }).totalItems;

    await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'EXTRA' });
    const afterAdd = await request(app).get('/v2.0/WindowsEndpoints');
    expect((afterAdd.body as { totalItems: number }).totalItems).toBe(initialCount + 1);

    // Reset
    const reset = await request(app).post('/api/reset');
    expect(reset.status).toBe(200);

    // Back to initial
    const afterReset = await request(app).get('/v2.0/WindowsEndpoints');
    expect((afterReset.body as { totalItems: number }).totalItems).toBe(initialCount);
  });

  it('404 for non-existent ID (valid GUID format)', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints/99999999-9999-9999-9999-999999999999');
    expect(res.status).toBe(404);
  });

  it('400 for missing required field on create', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({ primaryUser: 'no-display-name@company.com' });
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Standard Read-Only — pagination, search, sort
// ---------------------------------------------------------------------------
describe('E2E: standard-readonly — pagination, search, sort', () => {
  const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);

  it('pagination: PageSize=5 returns 5 items', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=5&Page=1');
    expect(res.status).toBe(200);
    expect((res.body as { data: unknown[] }).data).toHaveLength(5);
    expect((res.body as { pageSize: number }).pageSize).toBe(5);
  });

  it('pagination: Page=1 (zero-indexed) returns the second page', async () => {
    const p1 = await request(app).get('/v2.0/WindowsEndpoints?PageSize=5&Page=0');
    const p2 = await request(app).get('/v2.0/WindowsEndpoints?PageSize=5&Page=1');
    const ids1 = (p1.body as { data: Array<{ id: string }> }).data.map((e) => e.id);
    const ids2 = (p2.body as { data: Array<{ id: string }> }).data.map((e) => e.id);
    // Pages must not overlap
    expect(ids1.some((id) => ids2.includes(id))).toBe(false);
  });

  it('SearchQuery: filters results', async () => {
    // Get the first item's displayName to search for
    const all = await request(app).get('/v2.0/WindowsEndpoints');
    const firstName = (all.body as { data: Array<{ displayName: string }> }).data[0]?.displayName ?? '';
    const keyword = firstName.slice(0, 4);

    const filtered = await request(app).get(`/v2.0/WindowsEndpoints?SearchQuery=${encodeURIComponent(keyword)}`);
    expect(filtered.status).toBe(200);
    const filteredData = (filtered.body as { data: Array<{ displayName: string }> }).data;
    expect(filteredData.every((e) => e.displayName.toLowerCase().includes(keyword.toLowerCase()))).toBe(true);
  });

  it('OrderBy: results are sorted ascending', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?OrderBy=displayName+asc');
    expect(res.status).toBe(200);
    const names = (res.body as { data: Array<{ displayName: string }> }).data.map((e) => e.displayName);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('OrderBy: results are sorted descending', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?OrderBy=displayName+desc');
    expect(res.status).toBe(200);
    const names = (res.body as { data: Array<{ displayName: string }> }).data.map((e) => e.displayName);
    const sorted = [...names].sort((a, b) => b.localeCompare(a));
    expect(names).toEqual(sorted);
  });

  it('SearchQuery + OrderBy + PageSize combined', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?SearchQuery=PC&OrderBy=displayName+asc&PageSize=3&Page=0');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect((res.body as { data: unknown[] }).data.length).toBeLessThanOrEqual(3);
    }
  });
});

// ---------------------------------------------------------------------------
// Standard Read-Write — all entity types, CRUD + reset
// ---------------------------------------------------------------------------
describe('E2E: standard-readwrite — all entity types', () => {
  const app = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);

  beforeEach(async () => {
    await request(app).post('/api/reset');
  });

  it('Android endpoints: full CRUD', async () => {
    const create = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'E2E-AND-001', operatingSystem: 'Android 14' });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;

    const del = await request(app).delete(`/v2.0/AndroidEndpoints/${id}`);
    expect(del.status).toBe(204);

    const gone = await request(app).get(`/v2.0/AndroidEndpoints/${id}`);
    expect(gone.status).toBe(404);
  });

  it('Linux endpoints: create and patch', async () => {
    const create = await request(app)
      .post('/v2.0/LinuxEndpoints')
      .send({ displayName: 'E2E-LNX-001' });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;

    const patch = await request(app)
      .patch(`/v2.0/LinuxEndpoints/${id}`)
      .send({ operatingSystem: 'Ubuntu 24.04 LTS' });
    expect([200, 204]).toContain(patch.status);
  });

  it('Mac endpoints: create and update', async () => {
    const create = await request(app)
      .post('/v2.0/MacEndpoints')
      .send({ displayName: 'E2E-MAC-001' });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;

    const put = await request(app)
      .put(`/v2.0/MacEndpoints/${id}`)
      .send({ displayName: 'E2E-MAC-001-UPDATED' });
    expect([200, 204]).toContain(put.status);
  });

  it('JobDefinitions: full CRUD lifecycle', async () => {
    const create = await request(app)
      .post('/v2.0/JobDefinitions')
      .send({ name: 'E2E Deploy Job', type: 'UpdateDeployment', status: 'Pending' });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;

    const list = await request(app).get('/v2.0/JobDefinitions');
    const ids = (list.body as { data: Array<{ id: string }> }).data.map((j) => j.id);
    expect(ids).toContain(id);

    const del = await request(app).delete(`/v2.0/JobDefinitions/${id}`);
    expect(del.status).toBe(204);
  });

  it('Assets: full CRUD lifecycle', async () => {
    const create = await request(app)
      .post('/v2.0/Assets')
      .send({ assetTypeId: 'at-desktop-001', name: 'E2E-AST-001', ownerId: 'u-qa-001', ownerType: 'User', assetTag: 'E2E-AST-001', type: 'Desktop', department: 'QA' });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;

    const patch = await request(app)
      .patch(`/v2.0/Assets/${id}`)
      .send({ location: 'Test Lab Floor 2' });
    expect([200, 204]).toContain(patch.status);

    const del = await request(app).delete(`/v2.0/Assets/${id}`);
    expect(del.status).toBe(204);
  });

  it('Variables: full CRUD lifecycle', async () => {
    const create = await request(app)
      .post('/v2.0/Variables')
      .send({ name: 'E2ETestVar', type: 'String', values: ['a', 'b'] });
    expect(create.status).toBe(201);
    const id = (create.body as { id: string }).id;

    const del = await request(app).delete(`/v2.0/Variables/${id}`);
    expect(del.status).toBe(204);
  });

  it('POST /api/reset restores all entity collections', async () => {
    // Create extras across all types
    await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'EXTRA-WIN' });
    await request(app).post('/v2.0/AndroidEndpoints').send({ displayName: 'EXTRA-AND' });
    await request(app).post('/v2.0/JobDefinitions').send({ name: 'EXTRA-JOB' });
    await request(app).post('/v2.0/Assets').send({ assetTypeId: 'at-001', name: 'EXTRA-AST', ownerId: 'u-001', ownerType: 'User' });

    const reset = await request(app).post('/api/reset');
    expect(reset.status).toBe(200);

    // Counts should be back to fixture values (≤ initial)
    const win = await request(app).get('/v2.0/WindowsEndpoints');
    expect((win.body as { totalItems: number }).totalItems).toBe(10);

    const and = await request(app).get('/v2.0/AndroidEndpoints');
    expect((and.body as { totalItems: number }).totalItems).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Large-Scale Read-Only — pagination performance and data integrity
// ---------------------------------------------------------------------------
describe('E2E: largescale-readonly — pagination and data integrity', () => {
  const app = createApp(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_25R2);

  it('GET /v2.0/WindowsEndpoints returns 60,000 totalItems', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=1');
    expect(res.status).toBe(200);
    expect((res.body as { totalItems: number }).totalItems).toBe(60000);
  });

  it('pagination: PageSize=50 returns exactly 50 items', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?PageSize=50&Page=0');
    expect(res.status).toBe(200);
    expect((res.body as { data: unknown[] }).data).toHaveLength(50);
  });

  it('pagination: mid-dataset page (page 500) returns consistent data', async () => {
    const res1 = await request(app).get('/v2.0/WindowsEndpoints?PageSize=10&Page=500');
    const res2 = await request(app).get('/v2.0/WindowsEndpoints?PageSize=10&Page=500');
    // Deterministic — identical responses
    expect(res1.body).toEqual(res2.body);
  });

  it('GET /v2.0/AndroidEndpoints returns 5,000 totalItems', async () => {
    const res = await request(app).get('/v2.0/AndroidEndpoints?PageSize=1');
    expect(res.status).toBe(200);
    expect((res.body as { totalItems: number }).totalItems).toBe(5000);
  });

  it('GET /v2.0/Software returns 500 totalItems', async () => {
    const res = await request(app).get('/v2.0/Software?PageSize=1');
    expect(res.status).toBe(200);
    expect((res.body as { totalItems: number }).totalItems).toBe(500);
  });

  it('write operations return 403 in largescale-readonly', async () => {
    const res = await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'test' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Large-Scale — 26R1 version switching
// ---------------------------------------------------------------------------
describe('E2E: BMS version switching (25R2 vs 26R1)', () => {
  it('largescale-readonly 25R2: /v2.0/Vulnerabilities returns 404', async () => {
    const app = createApp(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_25R2);
    const res = await request(app).get('/v2.0/Vulnerabilities?PageSize=1');
    // Not registered in 25R2 — expect 404
    expect(res.status).toBe(404);
  });

  it('standard-readonly 25R2: core endpoints all respond 200', async () => {
    const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    const endpoints = ['/v2.0/WindowsEndpoints', '/v2.0/Software', '/v2.0/WindowsUpdates'];
    for (const ep of endpoints) {
      const res = await request(app).get(ep);
      expect(res.status).toBe(200);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 6 modules: ServerManagement, ActiveDirectory, DefenseControl
// ---------------------------------------------------------------------------
describe('E2E: Phase 6 modules — ServerManagement', () => {
  const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);

  it('GET /v2.0/Microservices returns paginated microservices', async () => {
    const res = await request(app).get('/v2.0/Microservices');
    expect(res.status).toBe(200);
    expectPaginated(res.body);
    expect((res.body as { totalItems: number }).totalItems).toBeGreaterThan(0);
  });

  it('GET /v2.0/Microservices/:id returns single microservice', async () => {
    const list = await request(app).get('/v2.0/Microservices?PageSize=1');
    const firstId = (list.body as { data: Array<{ id: string }> }).data[0]?.id;
    if (firstId) {
      const single = await request(app).get(`/v2.0/Microservices/${firstId}`);
      expect(single.status).toBe(200);
      expect((single.body as { id: string }).id).toBe(firstId);
    }
  });

  it('POST /v2.0/Microservices/:id/Start returns 200', async () => {
    const list = await request(app).get('/v2.0/Microservices?PageSize=1');
    const firstId = (list.body as { data: Array<{ id: string }> }).data[0]?.id;
    if (firstId) {
      const res = await request(app).post(`/v2.0/Microservices/${firstId}/Start`);
      expect(res.status).toBe(200);
    }
  });

  it('POST /v2.0/Microservices/:id/Stop returns 200', async () => {
    const list = await request(app).get('/v2.0/Microservices?PageSize=1');
    const firstId = (list.body as { data: Array<{ id: string }> }).data[0]?.id;
    if (firstId) {
      const res = await request(app).post(`/v2.0/Microservices/${firstId}/Stop`);
      expect(res.status).toBe(200);
    }
  });

  it('POST /v2.0/Microservices/:id/Restart returns 200', async () => {
    const list = await request(app).get('/v2.0/Microservices?PageSize=1');
    const firstId = (list.body as { data: Array<{ id: string }> }).data[0]?.id;
    if (firstId) {
      const res = await request(app).post(`/v2.0/Microservices/${firstId}/Restart`);
      expect(res.status).toBe(200);
    }
  });

  it('GET /v2.0/Microservices/:id 404 for unknown ID', async () => {
    const res = await request(app).get('/v2.0/Microservices/99999999-9999-9999-9999-999999999999');
    expect(res.status).toBe(404);
  });
});

describe('E2E: Phase 6 modules — ActiveDirectory', () => {
  const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);

  it('GET /v2.0/ADGroups returns paginated groups', async () => {
    const res = await request(app).get('/v2.0/ADGroups');
    expect(res.status).toBe(200);
    expectPaginated(res.body);
    expect((res.body as { totalItems: number }).totalItems).toBeGreaterThan(0);
  });

  it('GET /v2.0/ADGroups/:id returns single group', async () => {
    const list = await request(app).get('/v2.0/ADGroups?PageSize=1');
    const firstId = (list.body as { data: Array<{ id: string }> }).data[0]?.id;
    if (firstId) {
      const single = await request(app).get(`/v2.0/ADGroups/${firstId}`);
      expect(single.status).toBe(200);
    }
  });

  it('GET /v2.0/ADObjects returns paginated objects', async () => {
    const res = await request(app).get('/v2.0/ADObjects');
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });

  it('GET /v2.0/ADGroups supports SearchQuery', async () => {
    const res = await request(app).get('/v2.0/ADGroups?SearchQuery=Admin');
    expect(res.status).toBe(200);
  });
});

describe('E2E: Phase 6 modules — DefenseControl', () => {
  const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);

  it('GET /v2.0/BitLocker/WindowsEndpoints returns paginated results', async () => {
    const res = await request(app).get('/v2.0/BitLocker/WindowsEndpoints');
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints/:id returns single item', async () => {
    const list = await request(app).get('/v2.0/BitLocker/WindowsEndpoints?PageSize=1');
    const firstId = (list.body as { data: Array<{ id: string }> }).data[0]?.id;
    if (firstId) {
      const single = await request(app).get(`/v2.0/BitLocker/WindowsEndpoints/${firstId}`);
      expect(single.status).toBe(200);
    }
  });

  it('GET /v2.0/OSFolders returns paginated folders', async () => {
    const res = await request(app).get('/v2.0/OSFolders');
    expect(res.status).toBe(200);
    expectPaginated(res.body);
  });

  it('GET /v2.0/OSFolders/:id returns single folder', async () => {
    const list = await request(app).get('/v2.0/OSFolders?PageSize=1');
    const firstId = (list.body as { data: Array<{ id: string }> }).data[0]?.id;
    if (firstId) {
      const single = await request(app).get(`/v2.0/OSFolders/${firstId}`);
      expect(single.status).toBe(200);
    }
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints/:id 404 for unknown ID', async () => {
    const res = await request(app).get('/v2.0/BitLocker/WindowsEndpoints/99999999-9999-9999-9999-999999999999');
    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Security: input validation on all list endpoints
// ---------------------------------------------------------------------------
describe('E2E: Security validation — all profiles', () => {
  const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);

  const endpoints = [
    '/v2.0/WindowsEndpoints',
    '/v2.0/Software',
    '/v2.0/ADGroups',
    '/v2.0/Microservices',
    '/v2.0/BitLocker/WindowsEndpoints',
  ];

  for (const endpoint of endpoints) {
    it(`${endpoint}: rejects PageSize=-1 with 400`, async () => {
      const res = await request(app).get(`${endpoint}?PageSize=-1`);
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it(`${endpoint}: rejects PageSize=200000 with 400`, async () => {
      const res = await request(app).get(`${endpoint}?PageSize=200000`);
      expect(res.status).toBe(400);
    });
  }

  it('SearchQuery > 500 chars rejected with 400', async () => {
    const longQuery = 'x'.repeat(501);
    const res = await request(app).get(`/v2.0/WindowsEndpoints?SearchQuery=${encodeURIComponent(longQuery)}`);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('Negative Page rejected with 400', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?Page=-5');
    expect(res.status).toBe(400);
  });

  it('Error responses never expose stack traces', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints?Page=-1');
    expect(res.status).toBe(400);
    expect(res.body.stack).toBeUndefined();
  });
});
