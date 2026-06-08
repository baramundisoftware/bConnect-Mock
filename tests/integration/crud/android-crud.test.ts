/**
 * Android Endpoints CRUD Integration Tests (Phase 4)
 *
 * Tests CREATE/READ/UPDATE/DELETE lifecycle for AndroidEndpoints
 * in the standard-readwrite profile.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('AndroidEndpoints CRUD (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  describe('GET /v2.0/AndroidEndpoints', () => {
    it('should return 5 Android endpoints from standard-readwrite fixture', async () => {
      const res = await request(app).get('/v2.0/AndroidEndpoints');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.totalItems).toBe(5);
    });
  });

  describe('POST /v2.0/AndroidEndpoints', () => {
    it('should create a new Android endpoint with HTTP 201', async () => {
      const res = await request(app)
        .post('/v2.0/AndroidEndpoints')
        .send({
          displayName: 'AND-TEST-001',
          operatingSystem: 'Android 14',
          primaryUser: 'test.user@company.com',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('guid');
      expect(res.body.displayName).toBe('AND-TEST-001');
    });

    it('should return HTTP 400 when displayName is missing', async () => {
      const res = await request(app)
        .post('/v2.0/AndroidEndpoints')
        .send({ operatingSystem: 'Android 14' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should increase totalItems after POST', async () => {
      await request(app)
        .post('/v2.0/AndroidEndpoints')
        .send({ displayName: 'AND-NEW-001' });

      const res = await request(app).get('/v2.0/AndroidEndpoints');
      expect(res.body.totalItems).toBe(6);
    });
  });

  describe('PUT /v2.0/AndroidEndpoints/:id', () => {
    it('should update an existing Android endpoint', async () => {
      const createRes = await request(app)
        .post('/v2.0/AndroidEndpoints')
        .send({ displayName: 'AND-UPDATE-ORIG', operatingSystem: 'Android 13' });

      const id = createRes.body.id;

      const updateRes = await request(app)
        .put(`/v2.0/AndroidEndpoints/${id}`)
        .send({ displayName: 'AND-UPDATE-NEW', operatingSystem: 'Android 14' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.displayName).toBe('AND-UPDATE-NEW');
    });

    it('should return HTTP 404 for non-existent ID', async () => {
      const res = await request(app)
        .put('/v2.0/AndroidEndpoints/00000000-0000-0000-0000-000000000000')
        .send({ displayName: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /v2.0/AndroidEndpoints/:id', () => {
    it('should delete an Android endpoint and return HTTP 204', async () => {
      const createRes = await request(app)
        .post('/v2.0/AndroidEndpoints')
        .send({ displayName: 'AND-DELETE-ME' });

      const id = createRes.body.id;

      const deleteRes = await request(app).delete(`/v2.0/AndroidEndpoints/${id}`);
      expect(deleteRes.status).toBe(204);

      const listRes = await request(app).get('/v2.0/AndroidEndpoints');
      expect(listRes.body.totalItems).toBe(5);
    });
  });
});
