/**
 * P10.12 — Generic CRUD route factory unit tests
 *
 * Verifies that registerEntityWriteRoutes registers POST/PUT/PATCH/DELETE
 * routes with identical semantics to the hand-written handlers they replace.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

// These tests re-use the standard-readwrite app which exercises all entity CRUD
// routes through the factory.

describe('Generic CRUD factory — AndroidEndpoints (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('POST /v2.0/AndroidEndpoints returns 201 with id/guid', async () => {
    const res = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'AND-FACTORY-001', operatingSystem: 'Android 14' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('guid');
    expect(res.body.displayName).toBe('AND-FACTORY-001');
  });

  it('POST /v2.0/AndroidEndpoints returns 400 when displayName missing', async () => {
    const res = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ operatingSystem: 'Android 14' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('PUT /v2.0/AndroidEndpoints/:id returns 200 on success', async () => {
    const create = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'ORIG', operatingSystem: 'Android 13' });
    const res = await request(app)
      .put(`/v2.0/AndroidEndpoints/${create.body.id}`)
      .send({ displayName: 'UPDATED', operatingSystem: 'Android 14' });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('UPDATED');
  });

  it('PUT /v2.0/AndroidEndpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .put('/v2.0/AndroidEndpoints/00000000-0000-0000-0000-000000000000')
      .send({ displayName: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('PATCH /v2.0/AndroidEndpoints/:id returns 200', async () => {
    const create = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'PATCH-ME', operatingSystem: 'Android 13' });
    const res = await request(app)
      .patch(`/v2.0/AndroidEndpoints/${create.body.id}`)
      .send({ operatingSystem: 'Android 14' });
    expect(res.status).toBe(200);
    expect(res.body.operatingSystem).toBe('Android 14');
  });

  it('DELETE /v2.0/AndroidEndpoints/:id returns 204', async () => {
    const create = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'DELETE-ME' });
    const res = await request(app)
      .delete(`/v2.0/AndroidEndpoints/${create.body.id}`);
    expect(res.status).toBe(204);
  });

  it('DELETE /v2.0/AndroidEndpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/v2.0/AndroidEndpoints/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('Generic CRUD factory — LinuxEndpoints (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('POST /v2.0/LinuxEndpoints returns 201', async () => {
    const res = await request(app)
      .post('/v2.0/LinuxEndpoints')
      .send({ displayName: 'LIN-FACTORY-001' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('PATCH /v2.0/LinuxEndpoints/:id returns 200', async () => {
    const create = await request(app)
      .post('/v2.0/LinuxEndpoints')
      .send({ displayName: 'LIN-PATCH', operatingSystem: 'Ubuntu 22' });
    const res = await request(app)
      .patch(`/v2.0/LinuxEndpoints/${create.body.id}`)
      .send({ operatingSystem: 'Ubuntu 24' });
    expect(res.status).toBe(200);
    expect(res.body.operatingSystem).toBe('Ubuntu 24');
  });

  it('DELETE /v2.0/LinuxEndpoints/:id returns 204', async () => {
    const create = await request(app)
      .post('/v2.0/LinuxEndpoints')
      .send({ displayName: 'LIN-DELETE' });
    const res = await request(app)
      .delete(`/v2.0/LinuxEndpoints/${create.body.id}`);
    expect(res.status).toBe(204);
  });
});

describe('Generic CRUD factory — MacEndpoints (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('POST /v2.0/MacEndpoints returns 201', async () => {
    const res = await request(app)
      .post('/v2.0/MacEndpoints')
      .send({ displayName: 'MAC-FACTORY-001' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('PATCH /v2.0/MacEndpoints/:id returns 200', async () => {
    const create = await request(app)
      .post('/v2.0/MacEndpoints')
      .send({ displayName: 'MAC-PATCH', operatingSystem: 'macOS 14' });
    const res = await request(app)
      .patch(`/v2.0/MacEndpoints/${create.body.id}`)
      .send({ operatingSystem: 'macOS 15' });
    expect(res.status).toBe(200);
    expect(res.body.operatingSystem).toBe('macOS 15');
  });

  it('DELETE /v2.0/MacEndpoints/:id returns 204', async () => {
    const create = await request(app)
      .post('/v2.0/MacEndpoints')
      .send({ displayName: 'MAC-DELETE' });
    const res = await request(app)
      .delete(`/v2.0/MacEndpoints/${create.body.id}`);
    expect(res.status).toBe(204);
  });
});

describe('Generic CRUD factory — write ops rejected in read-only profile', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('POST /v2.0/AndroidEndpoints returns 403 in readonly profile', async () => {
    const res = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'SHOULD-FAIL' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/LinuxEndpoints/:id returns 403 in readonly profile', async () => {
    const res = await request(app)
      .patch('/v2.0/LinuxEndpoints/00000000-0000-0000-0000-000000000000')
      .send({ displayName: 'X' });
    expect(res.status).toBe(403);
  });
});
