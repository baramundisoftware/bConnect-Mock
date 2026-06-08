/**
 * NetworkEndpoints Integration Tests (Phase 11)
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('NetworkEndpoints (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/NetworkEndpoints returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/NetworkEndpoints');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET /v2.0/NetworkEndpoints returns endpoints with correct structure', async () => {
    const res = await request(app).get('/v2.0/NetworkEndpoints');
    const endpoint = res.body.data[0];
    expect(endpoint).toHaveProperty('id');
    expect(endpoint).toHaveProperty('displayName');
    expect(endpoint).toHaveProperty('type', 'NetworkEndpoint');
    expect(endpoint).toHaveProperty('primaryIP');
  });

  it('GET /v2.0/NetworkEndpoints/:id returns single endpoint', async () => {
    const listRes = await request(app).get('/v2.0/NetworkEndpoints');
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/NetworkEndpoints/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/NetworkEndpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/v2.0/NetworkEndpoints/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('POST /v2.0/NetworkEndpoints returns 403 in read-only profile', async () => {
    const res = await request(app)
      .post('/v2.0/NetworkEndpoints')
      .send({ displayName: 'NET-TEST-001' });
    expect(res.status).toBe(403);
  });
});

describe('NetworkEndpoints CRUD (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  it('POST creates a new network endpoint with HTTP 201', async () => {
    const res = await request(app)
      .post('/v2.0/NetworkEndpoints')
      .send({ displayName: 'NET-NEW-001', deviceType: 'Switch' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.displayName).toBe('NET-NEW-001');
  });

  it('POST returns 400 when displayName missing', async () => {
    const res = await request(app)
      .post('/v2.0/NetworkEndpoints')
      .send({ deviceType: 'Router' });
    expect(res.status).toBe(400);
  });

  it('PATCH updates network endpoint fields', async () => {
    const createRes = await request(app)
      .post('/v2.0/NetworkEndpoints')
      .send({ displayName: 'NET-PATCH-001' });
    const id = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/v2.0/NetworkEndpoints/${id}`)
      .send({ managementState: 'Managed' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.managementState).toBe('Managed');
  });

  it('DELETE removes network endpoint with HTTP 204', async () => {
    const createRes = await request(app)
      .post('/v2.0/NetworkEndpoints')
      .send({ displayName: 'NET-DEL-001' });
    const id = createRes.body.id;

    expect((await request(app).delete(`/v2.0/NetworkEndpoints/${id}`)).status).toBe(204);
    expect((await request(app).get(`/v2.0/NetworkEndpoints/${id}`)).status).toBe(404);
  });
});
