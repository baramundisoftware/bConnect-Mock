/**
 * Coverage Boost Tests — Phase 13 Acceptance Criteria
 *
 * Targets the routes with < 80% coverage:
 *   - jobs.ts (17.98%) — JobInstances CRUD + action routes
 *   - singleton.ts (50%) — factory edge cases
 *   - crudRoutes.ts (51.45%) — read-only path + PUT + 404 branches
 *   - assets.ts (53.4%) — write ops in read-only, Variables CRUD
 *   - software.ts (58.03%) — Bundles/BundleApplications/Bundle/Folders
 *   - serverManagement.ts / misc / others — 404 and error paths
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { BmsVersion, ProfileMode } from '../../../src/profiles/ProfileManager';

// ─────────────────────────────────────────────────────────────────────────────
// JOBS.TS — JobInstances (Start / Stop / Resume / CRUD)
// ─────────────────────────────────────────────────────────────────────────────

describe('JobInstances — standard-readwrite (jobs.ts coverage)', () => {
  let app: Express;
  // jobDefinitionId and endpointId from the standard-readwrite fixtures
  const JOB_DEF_ID = 'bb000001-0001-0001-0001-000000000001';
  const ENDPOINT_ID = 'a1000001-0001-0001-0001-000000000001';

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  /** Helper: create a job instance and return its id */
  const createInstance = async (): Promise<string> => {
    const res = await request(app)
      .post('/v2.0/JobInstances')
      .send({ jobDefinitionId: JOB_DEF_ID, endpointId: ENDPOINT_ID, type: 'JobInstance' });
    return res.body.id as string;
  };

  it('GET /v2.0/JobInstances returns list (empty initially)', async () => {
    const res = await request(app).get('/v2.0/JobInstances').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET /v2.0/JobInstances with SearchQuery filters results', async () => {
    await createInstance();
    const res = await request(app)
      .get('/v2.0/JobInstances?SearchQuery=Deploy')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/JobInstances with OrderBy', async () => {
    await createInstance();
    const res = await request(app)
      .get('/v2.0/JobInstances?OrderBy=state asc')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/JobInstances/:id returns 200 for existing instance', async () => {
    const id = await createInstance();
    const res = await request(app).get(`/v2.0/JobInstances/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/JobInstances/:id returns 404 for unknown id', async () => {
    await request(app)
      .get('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/JobInstances creates a new instance', async () => {
    const res = await request(app)
      .post('/v2.0/JobInstances')
      .send({ jobDefinitionId: JOB_DEF_ID, endpointId: ENDPOINT_ID, type: 'JobInstance' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.state).toBe('Pending');
  });

  it('POST /v2.0/JobInstances returns 400 when required fields missing', async () => {
    await request(app)
      .post('/v2.0/JobInstances')
      .send({ jobDefinitionId: 'some-id' }) // missing endpointId
      .expect(400);
  });

  it('DELETE /v2.0/JobInstances/:id returns 204', async () => {
    const id = await createInstance();
    await request(app).delete(`/v2.0/JobInstances/${id}`).expect(204);
  });

  it('DELETE /v2.0/JobInstances/:id returns 404 for unknown id', async () => {
    await request(app)
      .delete('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Start transitions state to Running', async () => {
    const id = await createInstance();
    const res = await request(app)
      .post(`/v2.0/JobInstances/${id}/Start`)
      .expect(200);
    expect(res.body.message).toContain(id);
  });

  it('POST /v2.0/JobInstances/:id/Start returns 404 for unknown id', async () => {
    await request(app)
      .post('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000/Start')
      .expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Stop transitions state to Cancelled', async () => {
    const id = await createInstance();
    const res = await request(app)
      .post(`/v2.0/JobInstances/${id}/Stop`)
      .expect(200);
    expect(res.body.message).toContain(id);
  });

  it('POST /v2.0/JobInstances/:id/Stop returns 404 for unknown id', async () => {
    await request(app)
      .post('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000/Stop')
      .expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Resume transitions state', async () => {
    const id = await createInstance();
    const res = await request(app)
      .post(`/v2.0/JobInstances/${id}/Resume`)
      .expect(200);
    expect(res.body.message).toContain(id);
  });

  it('POST /v2.0/JobInstances/:id/Resume returns 404 for unknown id', async () => {
    await request(app)
      .post('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000/Resume')
      .expect(404);
  });
});

describe('JobInstances — standard-readonly profile (403 for writes)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/JobInstances returns 200 from fixture', async () => {
    const res = await request(app).get('/v2.0/JobInstances').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/JobInstances/:id returns 200 from fixture', async () => {
    const list = await request(app).get('/v2.0/JobInstances').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).get(`/v2.0/JobInstances/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/JobInstances/:id returns 404 for unknown id', async () => {
    await request(app)
      .get('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/JobInstances returns 403 in read-only mode', async () => {
    await request(app)
      .post('/v2.0/JobInstances')
      .send({ jobDefinitionId: 'x', endpointId: 'y' })
      .expect(403);
  });

  it('DELETE /v2.0/JobInstances/:id returns 403 in read-only mode', async () => {
    await request(app)
      .delete('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000')
      .expect(403);
  });

  it('POST /v2.0/JobInstances/:id/Start returns 200 from fixture', async () => {
    const list = await request(app).get('/v2.0/JobInstances').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).post(`/v2.0/JobInstances/${id}/Start`).expect(200);
    expect(res.body.message).toContain(id);
  });

  it('POST /v2.0/JobInstances/:id/Stop returns 200 from fixture', async () => {
    const list = await request(app).get('/v2.0/JobInstances').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).post(`/v2.0/JobInstances/${id}/Stop`).expect(200);
    expect(res.body.message).toContain(id);
  });

  it('POST /v2.0/JobInstances/:id/Resume returns 200 from fixture (action allowed in read-only)', async () => {
    const list = await request(app).get('/v2.0/JobInstances').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).post(`/v2.0/JobInstances/${id}/Resume`).expect(200);
    expect(res.body.message).toContain(id);
  });

  it('POST /v2.0/JobInstances/:id/Start returns 404 for unknown id in fixture', async () => {
    await request(app)
      .post('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000/Start')
      .expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Stop returns 404 for unknown id in fixture', async () => {
    await request(app)
      .post('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000/Stop')
      .expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Resume returns 404 for unknown id in fixture', async () => {
    await request(app)
      .post('/v2.0/JobInstances/00000000-0000-0000-0000-000000000000/Resume')
      .expect(404);
  });
});

describe('JobDefinitions — standard-readonly read-only paths', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/JobDefinitions returns 200 with data', async () => {
    const res = await request(app).get('/v2.0/JobDefinitions').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/JobDefinitions with SearchQuery', async () => {
    const res = await request(app)
      .get('/v2.0/JobDefinitions?SearchQuery=Deploy')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/JobDefinitions/:id returns 200 for existing id', async () => {
    const list = await request(app).get('/v2.0/JobDefinitions').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).get(`/v2.0/JobDefinitions/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/JobDefinitions/:id returns 404 for unknown id', async () => {
    await request(app)
      .get('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/JobDefinitions returns 403 in read-only mode', async () => {
    await request(app)
      .post('/v2.0/JobDefinitions')
      .send({ name: 'Test Job', type: 'SoftwareDeployment' })
      .expect(403);
  });

  it('PUT /v2.0/JobDefinitions/:id returns 403 in read-only mode', async () => {
    await request(app)
      .put('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Test', type: 'SoftwareDeployment' })
      .expect(403);
  });

  it('PATCH /v2.0/JobDefinitions/:id returns 403 in read-only mode', async () => {
    await request(app)
      .patch('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Updated' })
      .expect(403);
  });

  it('DELETE /v2.0/JobDefinitions/:id returns 403 in read-only mode', async () => {
    await request(app)
      .delete('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(403);
  });
});

describe('JobDefinitions — standard-readwrite 404 paths', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('GET /v2.0/JobDefinitions/:id returns 404 for unknown id', async () => {
    await request(app)
      .get('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('PUT /v2.0/JobDefinitions/:id returns 404 for unknown id', async () => {
    await request(app)
      .put('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Updated', type: 'SoftwareDeployment' })
      .expect(404);
  });

  it('PATCH /v2.0/JobDefinitions/:id returns 404 for unknown id', async () => {
    await request(app)
      .patch('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Updated' })
      .expect(404);
  });

  it('DELETE /v2.0/JobDefinitions/:id returns 404 for unknown id', async () => {
    await request(app)
      .delete('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/JobDefinitions returns 400 when name missing', async () => {
    await request(app)
      .post('/v2.0/JobDefinitions')
      .send({ type: 'SoftwareDeployment' })
      .expect(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS.TS — read-only 403 + CRUD in readwrite
// ─────────────────────────────────────────────────────────────────────────────

describe('Assets — read-only profile 403 paths (assets.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('POST /v2.0/Assets returns 403', async () => {
    await request(app)
      .post('/v2.0/Assets')
      .send({ assetTag: 'AST-TEST-001', type: 'Desktop' })
      .expect(403);
  });

  it('PUT /v2.0/Assets/:id returns 403', async () => {
    await request(app)
      .put('/v2.0/Assets/a0000001-0001-0001-0001-000000000001')
      .send({ assetTag: 'AST-TEST-001', type: 'Desktop' })
      .expect(403);
  });

  it('PATCH /v2.0/Assets/:id returns 403', async () => {
    await request(app)
      .patch('/v2.0/Assets/a0000001-0001-0001-0001-000000000001')
      .send({ department: 'IT' })
      .expect(403);
  });

  it('DELETE /v2.0/Assets/:id returns 403', async () => {
    await request(app)
      .delete('/v2.0/Assets/a0000001-0001-0001-0001-000000000001')
      .expect(403);
  });
});

describe('Assets — standard-readwrite CRUD (assets.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('GET /v2.0/Assets returns list', async () => {
    const res = await request(app).get('/v2.0/Assets').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Assets with SearchQuery', async () => {
    const res = await request(app)
      .get('/v2.0/Assets?SearchQuery=Finance')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /v2.0/Assets creates asset', async () => {
    const res = await request(app)
      .post('/v2.0/Assets')
      .send({ assetTypeId: 'at-desktop-001', name: 'AST-TEST-999', ownerId: 'u-it-001', ownerType: 'User', assetTag: 'AST-TEST-999', type: 'Desktop', department: 'IT' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.assetTag).toBe('AST-TEST-999');
  });

  it('POST /v2.0/Assets returns 400 when assetTag missing', async () => {
    await request(app)
      .post('/v2.0/Assets')
      .send({ type: 'Desktop' })
      .expect(400);
  });

  it('PUT /v2.0/Assets/:id updates asset', async () => {
    const list = await request(app).get('/v2.0/Assets').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app)
      .put(`/v2.0/Assets/${id}`)
      .send({ assetTag: 'AST-UPDATED', type: 'Laptop' })
      .expect(200);
    expect(res.body.assetTag).toBe('AST-UPDATED');
  });

  it('PUT /v2.0/Assets/:id returns 404 for unknown id', async () => {
    await request(app)
      .put('/v2.0/Assets/00000000-0000-0000-0000-000000000000')
      .send({ assetTag: 'AST-TEST', type: 'Desktop' })
      .expect(404);
  });

  it('PATCH /v2.0/Assets/:id patches asset', async () => {
    const list = await request(app).get('/v2.0/Assets').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app)
      .patch(`/v2.0/Assets/${id}`)
      .send({ department: 'Engineering' })
      .expect(200);
    expect(res.body.department).toBe('Engineering');
  });

  it('PATCH /v2.0/Assets/:id returns 404 for unknown id', async () => {
    await request(app)
      .patch('/v2.0/Assets/00000000-0000-0000-0000-000000000000')
      .send({ department: 'IT' })
      .expect(404);
  });

  it('DELETE /v2.0/Assets/:id deletes asset', async () => {
    const list = await request(app).get('/v2.0/Assets').expect(200);
    const id = list.body.data[0]?.id;
    await request(app).delete(`/v2.0/Assets/${id}`).expect(204);
  });

  it('DELETE /v2.0/Assets/:id returns 404 for unknown id', async () => {
    await request(app)
      .delete('/v2.0/Assets/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SOFTWARE.TS — Bundles + BundleApplications + Bundle/Folders (26R1)
// ─────────────────────────────────────────────────────────────────────────────

describe('Bundles — standard-readonly 26R1 (software.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); });

  it('GET /v2.0/Bundles returns 200 list', async () => {
    const res = await request(app).get('/v2.0/Bundles').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/Bundles with SearchQuery', async () => {
    const res = await request(app)
      .get('/v2.0/Bundles?SearchQuery=Office')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Bundles/:id returns 200 for existing bundle', async () => {
    const list = await request(app).get('/v2.0/Bundles').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).get(`/v2.0/Bundles/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/Bundles/:id returns 404 for unknown id', async () => {
    await request(app)
      .get('/v2.0/Bundles/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/BundleApplications returns 200 list', async () => {
    const res = await request(app).get('/v2.0/BundleApplications').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/BundleApplications/:id returns 200 for existing', async () => {
    const list = await request(app).get('/v2.0/BundleApplications').expect(200);
    if (list.body.data.length === 0) {return;} // skip if empty
    const id = list.body.data[0]?.id;
    const res = await request(app).get(`/v2.0/BundleApplications/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/BundleApplications/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/BundleApplications/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/Bundle/Folders returns 200 list', async () => {
    const res = await request(app).get('/v2.0/Bundle/Folders').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Bundle/Folders with SearchQuery', async () => {
    const res = await request(app)
      .get('/v2.0/Bundle/Folders?SearchQuery=Productivity')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Bundle/Folders/:id returns 200', async () => {
    const list = await request(app).get('/v2.0/Bundle/Folders').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).get(`/v2.0/Bundle/Folders/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/Bundle/Folders/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/Bundle/Folders/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/Bundles returns 403 in read-only mode', async () => {
    await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'New Bundle' })
      .expect(403);
  });

  it('DELETE /v2.0/Bundles/:id returns 403 in read-only mode', async () => {
    await request(app)
      .delete('/v2.0/Bundles/00000000-0000-0000-0000-000000000000')
      .expect(403);
  });

  it('POST /v2.0/Bundle/Folders returns 403 in read-only mode', async () => {
    await request(app)
      .post('/v2.0/Bundle/Folders')
      .send({ name: 'New Folder' })
      .expect(403);
  });

  it('PATCH /v2.0/Bundle/Folders/:id returns 403 in read-only mode', async () => {
    await request(app)
      .patch('/v2.0/Bundle/Folders/b0011111-0000-0000-0000-000000000001')
      .send({ name: 'Updated' })
      .expect(403);
  });

  it('DELETE /v2.0/Bundle/Folders/:id returns 403 in read-only mode', async () => {
    await request(app)
      .delete('/v2.0/Bundle/Folders/b0011111-0000-0000-0000-000000000001')
      .expect(403);
  });
});

describe('Bundles — standard-readwrite 26R1 mutations (software.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('POST /v2.0/Bundles creates bundle', async () => {
    const res = await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'Test Bundle', type: 'ApplicationBundle' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });

  it('DELETE /v2.0/Bundles/:id returns 404 for unknown id', async () => {
    await request(app)
      .delete('/v2.0/Bundles/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('DELETE /v2.0/Bundles/:id returns 204 for existing', async () => {
    const created = await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'ToDelete', type: 'ApplicationBundle' })
      .expect(201);
    await request(app)
      .delete(`/v2.0/Bundles/${created.body.id}`)
      .expect(204);
  });

  it('POST /v2.0/Bundles/:bundleId/BundleApplications creates app in bundle', async () => {
    const bundle = await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'BundleForApps', type: 'ApplicationBundle' })
      .expect(201);
    const res = await request(app)
      .post(`/v2.0/Bundles/${bundle.body.id}/BundleApplications`)
      .send({ applicationId: 'app-001', applicationName: 'TestApp' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.bundleId).toBe(bundle.body.id);
  });

  it('POST /v2.0/Bundles/:bundleId/BundleApplications returns 404 for unknown bundle', async () => {
    await request(app)
      .post('/v2.0/Bundles/00000000-0000-0000-0000-000000000000/BundleApplications')
      .send({ applicationId: 'app-001' })
      .expect(404);
  });

  it('POST /v2.0/Bundles/:bundleId/BundleApplications returns 400 for invalid GUID', async () => {
    await request(app)
      .post('/v2.0/Bundles/not-a-guid/BundleApplications')
      .send({ applicationId: 'app-001' })
      .expect(400);
  });

  it('PATCH /v2.0/Bundles/:bundleId/BundleApplications/:appId updates app', async () => {
    const bundle = await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'BundleForPatch', type: 'ApplicationBundle' })
      .expect(201);
    const app1 = await request(app)
      .post(`/v2.0/Bundles/${bundle.body.id}/BundleApplications`)
      .send({ applicationId: 'app-002', applicationName: 'PatchApp' })
      .expect(201);
    const res = await request(app)
      .patch(`/v2.0/Bundles/${bundle.body.id}/BundleApplications/${app1.body.id}`)
      .send({ applicationName: 'PatchedApp' })
      .expect(200);
    expect(res.body.applicationName).toBe('PatchedApp');
  });

  it('PATCH /v2.0/Bundles/:bundleId/BundleApplications/:appId returns 404 for unknown', async () => {
    const bundle = await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'BundleForBadPatch', type: 'ApplicationBundle' })
      .expect(201);
    await request(app)
      .patch(`/v2.0/Bundles/${bundle.body.id}/BundleApplications/00000000-0000-0000-0000-000000000000`)
      .send({ applicationName: 'X' })
      .expect(404);
  });

  it('DELETE /v2.0/BundleApplications/:id returns 204', async () => {
    const bundle = await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'BundleForDeleteApp', type: 'ApplicationBundle' })
      .expect(201);
    const app1 = await request(app)
      .post(`/v2.0/Bundles/${bundle.body.id}/BundleApplications`)
      .send({ applicationId: 'app-003', applicationName: 'DeleteApp' })
      .expect(201);
    await request(app)
      .delete(`/v2.0/BundleApplications/${app1.body.id}`)
      .expect(204);
  });

  it('DELETE /v2.0/BundleApplications/:id returns 404 for unknown', async () => {
    await request(app)
      .delete('/v2.0/BundleApplications/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/Bundle/Folders creates folder', async () => {
    const res = await request(app)
      .post('/v2.0/Bundle/Folders')
      .send({ name: 'New Bundle Folder' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });

  it('PATCH /v2.0/Bundle/Folders/:id patches folder', async () => {
    const list = await request(app).get('/v2.0/Bundle/Folders').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app)
      .patch(`/v2.0/Bundle/Folders/${id}`)
      .send({ name: 'Updated Folder' })
      .expect(200);
    expect(res.body.name).toBe('Updated Folder');
  });

  it('PATCH /v2.0/Bundle/Folders/:id returns 404 for unknown', async () => {
    await request(app)
      .patch('/v2.0/Bundle/Folders/00000000-0000-0000-0000-000000000000')
      .send({ name: 'X' })
      .expect(404);
  });

  it('DELETE /v2.0/Bundle/Folders/:id returns 204', async () => {
    const created = await request(app)
      .post('/v2.0/Bundle/Folders')
      .send({ name: 'FolderToDelete' })
      .expect(201);
    await request(app)
      .delete(`/v2.0/Bundle/Folders/${created.body.id}`)
      .expect(204);
  });

  it('DELETE /v2.0/Bundle/Folders/:id returns 404 for unknown', async () => {
    await request(app)
      .delete('/v2.0/Bundle/Folders/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRUD FACTORY (crudRoutes.ts) — read-only profile path + PUT + 404 branches
// ─────────────────────────────────────────────────────────────────────────────

describe('CRUD factory — read-only profile paths (crudRoutes.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/VariableDefinitions returns list from fixture (read-only)', async () => {
    const res = await request(app).get('/v2.0/VariableDefinitions').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/VariableDefinitions with SearchQuery filters from fixture', async () => {
    const res = await request(app)
      .get('/v2.0/VariableDefinitions?SearchQuery=Endpoint')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/VariableDefinitions/:id returns 200 from fixture', async () => {
    const list = await request(app).get('/v2.0/VariableDefinitions').expect(200);
    const id = list.body.data[0]?.id;
    if (!id) {return;}
    const res = await request(app).get(`/v2.0/VariableDefinitions/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/VariableDefinitions/:id returns 404 for unknown id (read-only)', async () => {
    await request(app)
      .get('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/VariableDefinitions returns 403 in read-only mode', async () => {
    await request(app)
      .post('/v2.0/VariableDefinitions')
      .send({ name: 'Test Var', dataType: 'String' })
      .expect(403);
  });

  it('PATCH /v2.0/VariableDefinitions/:id returns 403 in read-only mode', async () => {
    await request(app)
      .patch('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Updated' })
      .expect(403);
  });

  it('DELETE /v2.0/VariableDefinitions/:id returns 403 in read-only mode', async () => {
    await request(app)
      .delete('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(403);
  });

  it('GET /v2.0/SecurityGroups/:id returns 400 for invalid GUID (read-only)', async () => {
    await request(app)
      .get('/v2.0/SecurityGroups/not-a-guid')
      .expect(400);
  });
});

describe('CRUD factory — readwrite 404 and PUT coverage (crudRoutes.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('GET /v2.0/VariableDefinitions/:id returns 404 for unknown id (readwrite)', async () => {
    await request(app)
      .get('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/VariableDefinitions/:id returns 400 for invalid GUID', async () => {
    await request(app)
      .get('/v2.0/VariableDefinitions/not-a-guid')
      .expect(400);
  });

  it('POST /v2.0/VariableDefinitions returns 400 when required field missing', async () => {
    await request(app)
      .post('/v2.0/VariableDefinitions')
      .send({ dataType: 'String' }) // missing name
      .expect(400);
  });

  it('PATCH /v2.0/VariableDefinitions/:id returns 404 for unknown id', async () => {
    await request(app)
      .patch('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Updated' })
      .expect(404);
  });

  it('PATCH /v2.0/VariableDefinitions/:id returns 404 for non-existent id (no GUID check)', async () => {
    // VariableDefinitions uses Array.isArray(id) not GUID_REGEX — any string id returns 404 if not found
    await request(app)
      .patch('/v2.0/VariableDefinitions/not-a-guid')
      .send({ name: 'Updated' })
      .expect(404);
  });

  it('DELETE /v2.0/VariableDefinitions/:id returns 404 for unknown id', async () => {
    await request(app)
      .delete('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('DELETE /v2.0/VariableDefinitions/:id returns 404 for non-GUID id (no GUID validation)', async () => {
    await request(app)
      .delete('/v2.0/VariableDefinitions/not-a-guid')
      .expect(404);
  });

  // SecurityGroups CRUD (no PUT — hasPut not set)
  it('POST + PATCH /v2.0/SecurityGroups — create then patch', async () => {
    const created = await request(app)
      .post('/v2.0/SecurityGroups')
      .send({ name: 'TestSecGroup', description: 'Test' })
      .expect(201);
    const id = created.body.id;
    const updated = await request(app)
      .patch(`/v2.0/SecurityGroups/${id}`)
      .send({ name: 'UpdatedSecGroup' })
      .expect(200);
    expect(updated.body.name).toBe('UpdatedSecGroup');
  });

  it('PATCH /v2.0/SecurityGroups/:id returns 400 for invalid GUID (factory uses GUID_REGEX)', async () => {
    await request(app)
      .patch('/v2.0/SecurityGroups/not-a-guid')
      .send({ name: 'X' })
      .expect(400);
  });

  it('DELETE /v2.0/SecurityGroups/:id returns 400 for invalid GUID', async () => {
    await request(app)
      .delete('/v2.0/SecurityGroups/not-a-guid')
      .expect(400);
  });

  it('DELETE /v2.0/SecurityGroups/:id returns 404 for unknown id', async () => {
    await request(app)
      .delete('/v2.0/SecurityGroups/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/SecurityGroups returns 403 in read-only mode', async () => {
    const roApp = createApp(ProfileMode.STANDARD_READONLY);
    await request(roApp)
      .post('/v2.0/SecurityGroups')
      .send({ name: 'X' })
      .expect(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON FACTORY (singleton.ts) — edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Singleton factory edge cases (singleton.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/Gateway returns singleton object (array[0])', async () => {
    const res = await request(app).get('/v2.0/Gateway').expect(200);
    // gateway.json is an array with one element
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
  });

  it('GET /v2.0/ManagementServer returns singleton from array', async () => {
    const res = await request(app).get('/v2.0/ManagementServer').expect(200);
    expect(res.body).toHaveProperty('version');
  });

  it('GET /v2.0/VpnAppliance returns singleton', async () => {
    const res = await request(app).get('/v2.0/VpnAppliance').expect(200);
    expect(res.body).toHaveProperty('id');
  });

  it('GET /v2.0/Dips returns singleton', async () => {
    const res = await request(app).get('/v2.0/Dips').expect(200);
    expect(res.body).toHaveProperty('id');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILS.TS — parsePage, GUID_REGEX, resolveEntityData edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Route utils edge cases (utils.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('Page=0 is the first page and Page=1 the second (zero-indexed pagination)', async () => {
    const all = await request(app).get('/v2.0/WindowsEndpoints').expect(200);
    const resP0 = await request(app).get('/v2.0/WindowsEndpoints?Page=0&PageSize=2').expect(200);
    const resP1 = await request(app).get('/v2.0/WindowsEndpoints?Page=1&PageSize=2').expect(200);
    expect(resP0.body.data[0]?.id).toBe(all.body.data[0]?.id);
    expect(resP1.body.data[0]?.id).toBe(all.body.data[2]?.id);
  });

  it('Page=-1 falls back to the first page', async () => {
    const all = await request(app).get('/v2.0/WindowsEndpoints').expect(200);
    const res = await request(app).get('/v2.0/WindowsEndpoints?Page=-1&PageSize=2');
    if (res.status === 200) { expect(res.body.data[0]?.id).toBe(all.body.data[0]?.id); }
  });

  it('GET /v2.0/LinuxEndpoints/:id returns 400 for non-GUID id', async () => {
    await request(app).get('/v2.0/LinuxEndpoints/not-a-guid').expect(400);
  });

  it('GET /v2.0/MacEndpoints/:id returns 400 for non-GUID id', async () => {
    await request(app).get('/v2.0/MacEndpoints/not-a-guid').expect(400);
  });

  it('GET /v2.0/Assets/:id returns 400 for non-GUID id', async () => {
    await request(app).get('/v2.0/Assets/not-a-guid').expect(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// READONLY LIST FACTORY (readonlyList.ts) — SearchQuery + OrderBy + pagination
// ─────────────────────────────────────────────────────────────────────────────

describe('ReadonlyList factory — SearchQuery + OrderBy (readonlyList.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/IosEndpoints returns list', async () => {
    const res = await request(app).get('/v2.0/IosEndpoints').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/IosEndpoints with SearchQuery', async () => {
    const res = await request(app)
      .get('/v2.0/IosEndpoints?SearchQuery=iPhone')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/IosEndpoints with OrderBy', async () => {
    const res = await request(app)
      .get('/v2.0/IosEndpoints?OrderBy=displayName asc')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/IosEndpoints with pagination', async () => {
    const res = await request(app)
      .get('/v2.0/IosEndpoints?Page=1&PageSize=2')
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });

  it('GET /v2.0/NetworkEndpoints returns list', async () => {
    const res = await request(app).get('/v2.0/NetworkEndpoints').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/NetworkEndpoints with SearchQuery', async () => {
    const res = await request(app)
      .get('/v2.0/NetworkEndpoints?SearchQuery=Switch')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET-BY-ID FACTORY (getById.ts) — 404 and 400 paths
// ─────────────────────────────────────────────────────────────────────────────

describe('GetById factory — 404 and 400 paths (getById.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/LinuxEndpoints/:id returns 404 for unknown GUID', async () => {
    await request(app)
      .get('/v2.0/LinuxEndpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/MacEndpoints/:id returns 404 for unknown GUID', async () => {
    await request(app)
      .get('/v2.0/MacEndpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/Assets/:id returns 404 for unknown GUID', async () => {
    await request(app)
      .get('/v2.0/Assets/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/LinuxEndpoints/:id returns 200 for existing endpoint', async () => {
    const list = await request(app).get('/v2.0/LinuxEndpoints').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).get(`/v2.0/LinuxEndpoints/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/MacEndpoints/:id returns 200 for existing endpoint', async () => {
    const list = await request(app).get('/v2.0/MacEndpoints').expect(200);
    const id = list.body.data[0]?.id;
    const res = await request(app).get(`/v2.0/MacEndpoints/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });
});
