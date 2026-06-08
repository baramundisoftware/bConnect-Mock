/**
 * Coverage Fix — endpoints.ts hasPut branches + crudRoutes.ts fixture fallback
 *
 * Tests PUT routes (hasPut=true) for Android/Linux/Mac/iOS/Network/Industrial endpoints.
 * Also covers crudRoutes.ts fixture fallback (GET list/by-id in read-only mode).
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

const VALID_GUID = '00000000-0000-0000-0000-000000000001';

describe('Endpoint PUT routes (hasPut=true)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => { await request(app).post('/api/reset'); });

  it('PUT /v2.0/AndroidEndpoints/:id returns 404 for non-existent id', async () => {
    const res = await request(app)
      .put(`/v2.0/AndroidEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Test', operatingSystem: 'Android 14' });
    expect(res.status).toBe(404);
  });

  it('PUT /v2.0/AndroidEndpoints/:id returns 200 after create', async () => {
    const createRes = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'PutTest', operatingSystem: 'Android 14' })
      .expect(201);
    const id = createRes.body.id as string;

    const res = await request(app)
      .put(`/v2.0/AndroidEndpoints/${id}`)
      .send({ displayName: 'PutUpdated', operatingSystem: 'Android 14' });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('PutUpdated');
  });

  it('PUT /v2.0/LinuxEndpoints/:id returns 404 for non-existent id', async () => {
    const res = await request(app)
      .put(`/v2.0/LinuxEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Test' });
    expect(res.status).toBe(404);
  });

  it('PUT /v2.0/MacEndpoints/:id returns 404 for non-existent id', async () => {
    const res = await request(app)
      .put(`/v2.0/MacEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Test' });
    expect(res.status).toBe(404);
  });

  it('PUT /v2.0/IosEndpoints/:id returns 404 for non-existent id', async () => {
    const res = await request(app)
      .put(`/v2.0/IosEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Test' });
    expect(res.status).toBe(404);
  });

  it('PUT /v2.0/NetworkEndpoints/:id returns 404 for non-existent id', async () => {
    const res = await request(app)
      .put(`/v2.0/NetworkEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Test' });
    expect(res.status).toBe(404);
  });

  it('PATCH /v2.0/AndroidEndpoints/:id returns 404 for non-existent id', async () => {
    const res = await request(app)
      .patch(`/v2.0/AndroidEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Updated' });
    expect(res.status).toBe(404);
  });

  it('DELETE /v2.0/AndroidEndpoints/:id returns 404 for non-existent id', async () => {
    const res = await request(app).delete(`/v2.0/AndroidEndpoints/${VALID_GUID}`);
    expect(res.status).toBe(404);
  });
});

describe('crudRoutes.ts — fixture fallback path (read-only profile)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/VariableDefinitions returns list from fixture in read-only', async () => {
    const res = await request(app).get('/v2.0/VariableDefinitions').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/VariableDefinitions/:id returns 404 for unknown id', async () => {
    await request(app).get(`/v2.0/VariableDefinitions/${VALID_GUID}`).expect(404);
  });

  it('POST /v2.0/VariableDefinitions returns 403 in read-only mode', async () => {
    const res = await request(app).post('/v2.0/VariableDefinitions').send({ name: 'Var' });
    expect(res.status).toBe(403);
  });
});
