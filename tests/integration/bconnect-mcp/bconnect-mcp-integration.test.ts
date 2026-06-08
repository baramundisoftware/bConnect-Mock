/**
 * P4.15 — bConnect-MCP Integration Test
 *
 * Validates that the mock server correctly serves the API contract
 * that bConnect-MCP tools depend on. Tests the same URL patterns,
 * query parameters, request bodies, and response shapes used by the
 * real bConnect-MCP modules.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

// ---------------------------------------------------------------------------
// App instances
// ---------------------------------------------------------------------------

let rw: Express; // standard-readwrite — used for all write-operation tests
let ro: Express; // standard-readonly — for 403 guard validation

beforeAll(() => {
  rw = createApp(ProfileMode.STANDARD_READWRITE);
  ro = createApp(ProfileMode.STANDARD_READONLY);
});

afterEach(async () => {
  // Reset state between tests (same as a bConnect-MCP test harness would do)
  await request(rw).post('/api/reset');
});

// ---------------------------------------------------------------------------
// Endpoints module (mirrors bConnect-MCP src/modules/endpoints.ts)
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: Endpoints Module', () => {
  describe('GET /v2.0/WindowsEndpoints', () => {
    it('returns paginated list matching bConnect-MCP response shape', async () => {
      const res = await request(rw)
        .get('/v2.0/WindowsEndpoints')
        .query({ PageSize: 10, Page: 0 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('totalItems');
      expect(res.body).toHaveProperty('pageSize');
      expect(res.body).toHaveProperty('page');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.totalItems).toBe(10);
      // Each endpoint has id and displayName as required by bConnect-MCP
      res.body.data.forEach((ep: Record<string, unknown>) => {
        expect(ep).toHaveProperty('id');
        expect(ep).toHaveProperty('displayName');
      });
    });

    it('SearchQuery filters by DisplayName (getEndpointsByName pattern)', async () => {
      const res = await request(rw)
        .get('/v2.0/WindowsEndpoints')
        .query({ SearchQuery: 'NYC' });

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      res.body.data.forEach((ep: Record<string, unknown>) => {
        expect(String(ep.displayName).toUpperCase()).toContain('NYC');
      });
    });

    it('OrderBy sorts by DisplayName asc (getEndpoints with ordering)', async () => {
      const res = await request(rw)
        .get('/v2.0/WindowsEndpoints')
        .query({ OrderBy: 'DisplayName asc' });

      expect(res.status).toBe(200);
      const names = res.body.data.map((ep: Record<string, unknown>) =>
        String(ep.displayName).toLowerCase()
      );
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('Pagination — page 1 and page 2 (1-based) return non-overlapping slices', async () => {
      const [p1, p2] = await Promise.all([
        request(rw).get('/v2.0/WindowsEndpoints').query({ PageSize: 5, Page: 1 }),
        request(rw).get('/v2.0/WindowsEndpoints').query({ PageSize: 5, Page: 2 }),
      ]);

      expect(p1.body.data).toHaveLength(5);
      expect(p2.body.data).toHaveLength(5);
      const p1Ids = p1.body.data.map((ep: Record<string, unknown>) => ep.id);
      const p2Ids = p2.body.data.map((ep: Record<string, unknown>) => ep.id);
      expect(p1Ids.some((id: unknown) => p2Ids.includes(id))).toBe(false);
    });
  });

  describe('GET /v2.0/AndroidEndpoints', () => {
    it('returns 5 Android endpoints with required fields', async () => {
      const res = await request(rw).get('/v2.0/AndroidEndpoints');

      expect(res.status).toBe(200);
      expect(res.body.totalItems).toBe(5);
      res.body.data.forEach((ep: Record<string, unknown>) => {
        expect(ep).toHaveProperty('id');
        expect(ep).toHaveProperty('displayName');
      });
    });
  });

  describe('POST /v2.0/AndroidEndpoints (Android enrollment — createAndroidEndpoint)', () => {
    it('creates Android endpoint and returns 201 with id+guid', async () => {
      const res = await request(rw)
        .post('/v2.0/AndroidEndpoints')
        .send({
          displayName: 'AND-MCP-TEST-001',
          operatingSystem: 'Android 14',
          primaryUser: 'mcp.test@company.com',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('guid');
      expect(res.body.displayName).toBe('AND-MCP-TEST-001');
    });

    it('returns 400 when required field missing (bConnect-MCP validation catch)', async () => {
      const res = await request(rw)
        .post('/v2.0/AndroidEndpoints')
        .send({ operatingSystem: 'Android 14' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /v2.0/LinuxEndpoints', () => {
    it('returns 3 Linux endpoints', async () => {
      const res = await request(rw).get('/v2.0/LinuxEndpoints');
      expect(res.status).toBe(200);
      expect(res.body.totalItems).toBe(3);
    });
  });

  describe('GET /v2.0/MacEndpoints', () => {
    it('returns 2 Mac endpoints', async () => {
      const res = await request(rw).get('/v2.0/MacEndpoints');
      expect(res.status).toBe(200);
      expect(res.body.totalItems).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// Software module (mirrors bConnect-MCP src/modules/software.ts)
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: Software Module', () => {
  it('getSoftware() returns paginated list with name/id fields', async () => {
    const res = await request(rw).get('/v2.0/Software').query({ PageSize: 50, Page: 0 });

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(10);
    res.body.data.forEach((sw: Record<string, unknown>) => {
      expect(sw).toHaveProperty('id');
      expect(sw).toHaveProperty('name');
    });
  });

  it('SearchQuery filters software by name (getSoftwareByName pattern)', async () => {
    const res = await request(rw)
      .get('/v2.0/Software')
      .query({ SearchQuery: 'Microsoft' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    res.body.data.forEach((sw: Record<string, unknown>) => {
      expect(String(sw.name).toLowerCase()).toContain('microsoft');
    });
  });
});

// ---------------------------------------------------------------------------
// Jobs module (mirrors bConnect-MCP src/modules/jobs.ts)
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: Jobs Module', () => {
  it('getJobs() returns 5 jobs with name/id fields', async () => {
    const res = await request(rw).get('/v2.0/JobDefinitions');

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(5);
    res.body.data.forEach((job: Record<string, unknown>) => {
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('name');
    });
  });

  it('createJob() triggers a job with status Running (triggerJob pattern)', async () => {
    const res = await request(rw)
      .post('/v2.0/JobDefinitions')
      .send({
        name: 'MCP-Triggered: Deploy Patch Tuesday',
        type: 'UpdateDeployment',
        status: 'Running',
        targetGroup: 'All Windows Endpoints',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Running');
    expect(res.body.name).toContain('MCP-Triggered');
  });

  it('updateJob() cancels a running job (cancelJob pattern)', async () => {
    const create = await request(rw)
      .post('/v2.0/JobDefinitions')
      .send({ name: 'Job To Cancel Via MCP', type: 'ComplianceScan', status: 'Running' });

    const jobId = create.body.id;

    const update = await request(rw)
      .put(`/v2.0/JobDefinitions/${jobId}`)
      .send({ name: 'Job To Cancel Via MCP', type: 'ComplianceScan', status: 'Cancelled' });

    expect(update.status).toBe(200);
    expect(update.body.status).toBe('Cancelled');
  });

  it('deleteJob() removes a job', async () => {
    const create = await request(rw)
      .post('/v2.0/JobDefinitions')
      .send({ name: 'Job To Delete', type: 'InventoryScan' });

    const jobId = create.body.id;
    const del = await request(rw).delete(`/v2.0/JobDefinitions/${jobId}`);
    expect(del.status).toBe(204);

    const list = await request(rw).get('/v2.0/JobDefinitions');
    expect(list.body.totalItems).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// Assets module (mirrors bConnect-MCP src/modules/assets.ts)
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: Assets Module', () => {
  it('getAssets() returns 10 assets with assetTag/id fields', async () => {
    const res = await request(rw).get('/v2.0/Assets');

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(10);
    res.body.data.forEach((asset: Record<string, unknown>) => {
      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('assetTag');
    });
  });

  it('createAsset() then PUT updateAsset() for contact info update', async () => {
    const create = await request(rw)
      .post('/v2.0/Assets')
      .send({
        assetTypeId: 'at-laptop-001',
        name: 'AST-MCP-001',
        ownerId: 'u-fin-001',
        ownerType: 'User',
        assetTag: 'AST-MCP-001',
        type: 'Laptop',
        department: 'Finance',
        location: 'New York HQ',
      });

    expect(create.status).toBe(201);
    const id = create.body.id;

    const update = await request(rw)
      .put(`/v2.0/Assets/${id}`)
      .send({
        assetTag: 'AST-MCP-001',
        type: 'Laptop',
        department: 'IT Operations',
        location: 'London Office',
      });

    expect(update.status).toBe(200);
    expect(update.body.department).toBe('IT Operations');
    expect(update.body.location).toBe('London Office');
  });
});

// ---------------------------------------------------------------------------
// Variables module (mirrors bConnect-MCP src/modules/variables.ts)
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: Variables Module', () => {
  it('getVariables() returns 5 variable definitions', async () => {
    const res = await request(rw).get('/v2.0/Variables');

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(5);
    res.body.data.forEach((v: Record<string, unknown>) => {
      expect(v).toHaveProperty('id');
      expect(v).toHaveProperty('name');
    });
  });

  it('createVariable() creates a new variable definition with values array', async () => {
    const res = await request(rw)
      .post('/v2.0/Variables')
      .send({
        name: 'MCP_BuildingFloor',
        type: 'String',
        description: 'Physical floor for MCP asset tracking',
        values: ['1', '2', '3', '4', '5', '6'],
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('MCP_BuildingFloor');
    expect(res.body.values).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// WindowsUpdates/CVEs module
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: WindowsUpdates Module', () => {
  it('getWindowsUpdates() returns 10 CVEs', async () => {
    const res = await request(rw).get('/v2.0/WindowsUpdates');
    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(10);
    res.body.data.forEach((cve: Record<string, unknown>) => {
      expect(cve).toHaveProperty('id');
    });
  });
});

// ---------------------------------------------------------------------------
// State reset (used by MCP test harness between test sessions)
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: State Reset', () => {
  it('POST /api/reset restores all entity types to initial state', async () => {
    // Simulate several MCP write operations
    await request(rw).post('/v2.0/AndroidEndpoints').send({ displayName: 'MCP-TEMP-001' });
    await request(rw).post('/v2.0/JobDefinitions').send({ name: 'MCP-TEMP-JOB', type: 'Test' });
    await request(rw).post('/v2.0/Assets').send({ assetTypeId: 'at-srv-001', name: 'MCP-TEMP-ASSET', ownerId: 'u-001', ownerType: 'User', type: 'Server' });

    const reset = await request(rw).post('/api/reset');
    expect(reset.status).toBe(200);

    const [andRes, jobRes, assetRes] = await Promise.all([
      request(rw).get('/v2.0/AndroidEndpoints'),
      request(rw).get('/v2.0/JobDefinitions'),
      request(rw).get('/v2.0/Assets'),
    ]);

    expect(andRes.body.totalItems).toBe(5);
    expect(jobRes.body.totalItems).toBe(5);
    expect(assetRes.body.totalItems).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Error handling — bConnect-MCP must handle 4xx gracefully
// ---------------------------------------------------------------------------

describe('P4.15 — bConnect-MCP Integration: Error Handling', () => {
  it('GET /v2.0/WindowsEndpoints/:id — 404 for non-existent endpoint', async () => {
    const res = await request(rw).get(
      '/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000'
    );
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /v2.0/AndroidEndpoints — 400 when displayName missing', async () => {
    const res = await request(rw)
      .post('/v2.0/AndroidEndpoints')
      .send({ operatingSystem: 'Android 14' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('Write to standard-readonly profile returns 403 (bConnect-MCP detects read-only mode)', async () => {
    const res = await request(ro)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'test' });

    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });

  it('PUT /v2.0/JobDefinitions/:id — 404 for non-existent job', async () => {
    const res = await request(rw)
      .put('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Ghost', type: 'Test' });

    expect(res.status).toBe(404);
  });
});
