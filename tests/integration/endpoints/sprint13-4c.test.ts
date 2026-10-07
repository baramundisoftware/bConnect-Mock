/**
 * Sprint 13.4 (part C) — Folders (jobs context), Bundle mutations
 * P13.4.6, P13.4.16
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

// ─── Folders / Jobs context (P13.4.6) ────────────────────────────────────────

describe('Folders/jobs context (standard-readonly)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/Folders returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/Folders').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('returns items with correct structure', async () => {
    const res = await request(app).get('/v2.0/Folders').expect(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
  });

  it('GET /v2.0/Folders/:id returns single folder', async () => {
    const listRes = await request(app).get('/v2.0/Folders').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/Folders/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/Folders/:id returns 404 for unknown id', async () => {
    await request(app).get('/v2.0/Folders/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('GET /v2.0/Folders/:id returns 400 for malformed id', async () => {
    await request(app).get('/v2.0/Folders/not-a-guid').expect(400);
  });

  it('GET /v2.0/Folders/:id/Folders returns children', async () => {
    // The top folder (its parent is the jobs module's hidden root) should have children
    const listRes = await request(app).get('/v2.0/Folders').expect(200);
    const root = listRes.body.data.find((f: Record<string, unknown>) => f['parentId'] === '8e5102e3-c2e1-47ba-ad76-295d3df9ef31');
    expect(root).toBeDefined();
    const res = await request(app).get(`/v2.0/Folders/${root.id}/Folders`).expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/Folders/:id/Folders returns 404 for unknown parent', async () => {
    await request(app).get('/v2.0/Folders/00000000-0000-0000-0000-000000000000/Folders').expect(404);
  });
});

describe('Folders CRUD (standard-readwrite)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });

  it('POST /v2.0/Folders creates a new folder', async () => {
    const res = await request(app)
      .post('/v2.0/Folders')
      .send({ name: 'New Test Folder', comment: 'Test' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('New Test Folder');
  });

  it('PATCH /v2.0/Folders/:id updates a folder', async () => {
    const listRes = await request(app).get('/v2.0/Folders').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app)
      .patch(`/v2.0/Folders/${id}`)
      .send({ comment: 'Updated comment' })
      .expect(200);
    expect(res.body.id).toBe(id);
  });

  it('DELETE /v2.0/Folders/:id removes a folder', async () => {
    const listRes = await request(app).get('/v2.0/Folders').expect(200);
    const id = listRes.body.data[listRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/Folders/${id}`).expect(204);
    await request(app).get(`/v2.0/Folders/${id}`).expect(404);
  });

  it('DELETE /v2.0/Folders/:id returns 404 for unknown id', async () => {
    await request(app).delete('/v2.0/Folders/00000000-0000-0000-0000-000000000000').expect(404);
  });
});

// ─── Bundle mutations (P13.4.16) — 26R1 only ─────────────────────────────────

describe('Bundle mutations (26R1 standard-readwrite)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1); });

  it('POST /v2.0/Bundles creates a bundle', async () => {
    const res = await request(app)
      .post('/v2.0/Bundles')
      .send({ name: 'Test Bundle', type: 'ApplicationBundle' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Bundle');
  });

  it('DELETE /v2.0/Bundles/:id removes a bundle', async () => {
    const listRes = await request(app).get('/v2.0/Bundles').expect(200);
    const id = listRes.body.data[listRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/Bundles/${id}`).expect(204);
  });

  it('DELETE /v2.0/Bundles/:id returns 404 for unknown id', async () => {
    await request(app).delete('/v2.0/Bundles/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('POST /v2.0/Bundles/:id/BundleApplications adds an application to a bundle', async () => {
    const listRes = await request(app).get('/v2.0/Bundles').expect(200);
    const bundleId = listRes.body.data[0].id;
    const res = await request(app)
      .post(`/v2.0/Bundles/${bundleId}/BundleApplications`)
      .send({ applicationId: 'a0011111-0000-0000-0000-000000000099', order: 5 })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.bundleId).toBe(bundleId);
  });

  it('POST /v2.0/Bundles/:id/BundleApplications returns 404 for unknown bundle', async () => {
    await request(app)
      .post('/v2.0/Bundles/00000000-0000-0000-0000-000000000000/BundleApplications')
      .send({ applicationId: 'a0011111-0000-0000-0000-000000000099' })
      .expect(404);
  });

  it('PATCH /v2.0/Bundles/:id/BundleApplications/:appId updates a bundle application', async () => {
    const appListRes = await request(app).get('/v2.0/BundleApplications').expect(200);
    const bundleApp = appListRes.body.data[0];
    const res = await request(app)
      .patch(`/v2.0/Bundles/${bundleApp.bundleId}/BundleApplications/${bundleApp.id}`)
      .send({ order: 99 })
      .expect(200);
    expect(res.body.id).toBe(bundleApp.id);
  });

  it('DELETE /v2.0/BundleApplications/:id removes a bundle application', async () => {
    const appListRes = await request(app).get('/v2.0/BundleApplications').expect(200);
    const id = appListRes.body.data[appListRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/BundleApplications/${id}`).expect(204);
  });

  it('DELETE /v2.0/BundleApplications/:id returns 404 for unknown id', async () => {
    await request(app).delete('/v2.0/BundleApplications/00000000-0000-0000-0000-000000000000').expect(404);
  });
});
