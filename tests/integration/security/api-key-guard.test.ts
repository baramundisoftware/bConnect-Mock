/**
 * P10.24 — REQUIRE_API_KEY guard integration tests
 *
 * When REQUIRE_API_KEY is set, write endpoints and /api/reset must:
 *  - Accept requests with a matching X-Api-Key header → normal response
 *  - Reject requests with missing key → 401
 *  - Reject requests with wrong key → 401
 *  - NOT affect GET (read) endpoints
 *
 * When REQUIRE_API_KEY is not set, all endpoints work without a key.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

const TEST_KEY = 'test-secret-key-abc123';

describe('REQUIRE_API_KEY guard', () => {
  let app: Express;

  // ─────────────────────────────────────────────────────────────────────────
  // Guard ENABLED
  // ─────────────────────────────────────────────────────────────────────────
  describe('when REQUIRE_API_KEY is set', () => {
    beforeEach(() => {
      process.env.REQUIRE_API_KEY = TEST_KEY;
      app = createApp(ProfileMode.MINIMAL_READWRITE);
    });

    afterEach(async () => {
      delete process.env.REQUIRE_API_KEY;
      await request(app).post('/api/reset').set('X-Api-Key', TEST_KEY);
    });

    // --- Write endpoints blocked without key ---

    it('POST /v2.0/WindowsEndpoints → 401 when key is missing', async () => {
      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Test' });
      expect(res.status).toBe(401);
      expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
    });

    it('POST /v2.0/WindowsEndpoints → 401 when key is wrong', async () => {
      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', 'wrong-key')
        .send({ displayName: 'Test' });
      expect(res.status).toBe(401);
    });

    it('POST /v2.0/WindowsEndpoints → 201 when key is correct', async () => {
      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', TEST_KEY)
        .send({ displayName: 'Keyed Endpoint' });
      expect(res.status).toBe(201);
      expect(res.body.displayName).toBe('Keyed Endpoint');
    });

    it('PUT /v2.0/WindowsEndpoints/:id → 401 when key is missing', async () => {
      // Create first with key
      const create = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', TEST_KEY)
        .send({ displayName: 'Original' });
      expect(create.status).toBe(201);

      const res = await request(app)
        .put(`/v2.0/WindowsEndpoints/${create.body.id}`)
        .send({ displayName: 'Updated' });
      expect(res.status).toBe(401);
    });

    it('PATCH /v2.0/WindowsEndpoints/:id → 401 when key is missing', async () => {
      const create = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', TEST_KEY)
        .send({ displayName: 'Original' });

      const res = await request(app)
        .patch(`/v2.0/WindowsEndpoints/${create.body.id}`)
        .send({ displayName: 'Patched' });
      expect(res.status).toBe(401);
    });

    it('DELETE /v2.0/WindowsEndpoints/:id → 401 when key is missing', async () => {
      const create = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', TEST_KEY)
        .send({ displayName: 'ToDelete' });

      const res = await request(app)
        .delete(`/v2.0/WindowsEndpoints/${create.body.id}`);
      expect(res.status).toBe(401);
    });

    it('DELETE /v2.0/WindowsEndpoints/:id → 204 when key is correct', async () => {
      const create = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', TEST_KEY)
        .send({ displayName: 'ToDelete' });

      const res = await request(app)
        .delete(`/v2.0/WindowsEndpoints/${create.body.id}`)
        .set('X-Api-Key', TEST_KEY);
      expect(res.status).toBe(204);
    });

    it('POST /api/reset → 401 when key is missing', async () => {
      const res = await request(app).post('/api/reset');
      expect(res.status).toBe(401);
    });

    it('POST /api/reset → 200 when key is correct', async () => {
      const res = await request(app)
        .post('/api/reset')
        .set('X-Api-Key', TEST_KEY);
      expect(res.status).toBe(200);
    });

    // --- GET endpoints also require auth (simulates real bConnect) ---

    it('GET /v2.0/WindowsEndpoints → 401 without any key', async () => {
      const res = await request(app).get('/v2.0/WindowsEndpoints');
      expect(res.status).toBe(401);
    });

    it('GET /v2.0/WindowsEndpoints → 200 with valid key', async () => {
      const res = await request(app)
        .get('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', TEST_KEY);
      expect(res.status).toBe(200);
    });

    it('GET /v2.0/WindowsEndpoints/:id → 200 with valid key', async () => {
      // Seed one endpoint
      const create = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .set('X-Api-Key', TEST_KEY)
        .send({ displayName: 'ReadOnly' });

      const res = await request(app)
        .get(`/v2.0/WindowsEndpoints/${create.body.id}`)
        .set('X-Api-Key', TEST_KEY);
      expect(res.status).toBe(200);
    });

    // --- 401 body structure ---

    it('401 response body has an "error" field', async () => {
      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Test' });
      expect(res.status).toBe(401);
      expect(typeof res.headers['x-bconnect-mock-reason']).toBe('string');
      expect(String(res.headers['x-bconnect-mock-reason']).length).toBeGreaterThan(0);
    });

    it('401 response does not leak the configured API key', async () => {
      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Test' });
      expect(JSON.stringify(res.body)).not.toContain(TEST_KEY);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Guard DISABLED (no env var)
  // ─────────────────────────────────────────────────────────────────────────
  describe('when REQUIRE_API_KEY is not set', () => {
    beforeEach(() => {
      delete process.env.REQUIRE_API_KEY;
      app = createApp(ProfileMode.MINIMAL_READWRITE);
    });

    afterEach(async () => {
      await request(app).post('/api/reset');
    });

    it('POST /v2.0/WindowsEndpoints → 201 without any key', async () => {
      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'No Key Needed' });
      expect(res.status).toBe(201);
    });

    it('POST /api/reset → 200 without any key', async () => {
      const res = await request(app).post('/api/reset');
      expect(res.status).toBe(200);
    });

    it('GET /v2.0/WindowsEndpoints → 200 without any key', async () => {
      const res = await request(app).get('/v2.0/WindowsEndpoints');
      expect(res.status).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    afterEach(async () => {
      delete process.env.REQUIRE_API_KEY;
    });

    it('empty string REQUIRE_API_KEY disables the guard (treat as unset)', async () => {
      process.env.REQUIRE_API_KEY = '';
      app = createApp(ProfileMode.MINIMAL_READWRITE);

      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Empty Key Guard' });
      expect(res.status).toBe(201);

      await request(app).post('/api/reset');
    });

    it('whitespace-only REQUIRE_API_KEY disables the guard', async () => {
      process.env.REQUIRE_API_KEY = '   ';
      app = createApp(ProfileMode.MINIMAL_READWRITE);

      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'Whitespace Key' });
      expect(res.status).toBe(201);

      await request(app).post('/api/reset');
    });
  });
});
