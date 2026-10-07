/**
 * IosEndpoints Integration Tests (Phase 11)
 *
 * Tests CRUD lifecycle for IosEndpoints in both readonly and readwrite profiles.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('IosEndpoints (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/IosEndpoints returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/IosEndpoints');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('currentPage', 0);
  });

  it('GET /v2.0/IosEndpoints returns endpoints with correct structure', async () => {
    const res = await request(app).get('/v2.0/IosEndpoints');
    const endpoint = res.body.data[0];
    expect(endpoint).toHaveProperty('id');
    expect(endpoint).toHaveProperty('displayName');
    expect(endpoint).toHaveProperty('type', 'IOSEndpoint');
    expect(endpoint).toHaveProperty('operatingSystem');
  });

  it('GET /v2.0/IosEndpoints/:id returns single endpoint', async () => {
    const listRes = await request(app).get('/v2.0/IosEndpoints');
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/IosEndpoints/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/IosEndpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/v2.0/IosEndpoints/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('POST /v2.0/IosEndpoints returns 403 in read-only profile', async () => {
    const res = await request(app)
      .post('/v2.0/IosEndpoints')
      .send({ displayName: 'IOS-TEST-001' });
    expect(res.status).toBe(403);
  });

  it('supports pagination', async () => {
    const res = await request(app).get('/v2.0/IosEndpoints?PageSize=2&Page=0');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pageSize).toBe(2);
  });
});

describe('IosEndpoints CRUD (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  it('POST /v2.0/IosEndpoints creates a new endpoint with HTTP 201', async () => {
    const res = await request(app)
      .post('/v2.0/IosEndpoints')
      .send({ displayName: 'IOS-NEW-001', operatingSystem: 'iOS 17.4' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.displayName).toBe('IOS-NEW-001');
  });

  it('POST /v2.0/IosEndpoints returns 400 when displayName missing', async () => {
    const res = await request(app)
      .post('/v2.0/IosEndpoints')
      .send({ operatingSystem: 'iOS 17.4' });
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('PATCH /v2.0/IosEndpoints/:id updates endpoint fields', async () => {
    const createRes = await request(app)
      .post('/v2.0/IosEndpoints')
      .send({ displayName: 'IOS-PATCH-001' });
    const id = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/v2.0/IosEndpoints/${id}`)
      .send({ managementState: 'Enrolled' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.managementState).toBe('Enrolled');
  });

  it('PATCH /v2.0/IosEndpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/v2.0/IosEndpoints/00000000-0000-0000-0000-000000000000')
      .send({ displayName: 'X' });
    expect(res.status).toBe(404);
  });

  it('DELETE /v2.0/IosEndpoints/:id removes endpoint with HTTP 204', async () => {
    const createRes = await request(app)
      .post('/v2.0/IosEndpoints')
      .send({ displayName: 'IOS-DEL-001' });
    const id = createRes.body.id;

    const delRes = await request(app).delete(`/v2.0/IosEndpoints/${id}`);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/v2.0/IosEndpoints/${id}`);
    expect(getRes.status).toBe(404);
  });

  it('DELETE /v2.0/IosEndpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app).delete('/v2.0/IosEndpoints/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
