/**
 * Assets CRUD Integration Tests (Phase 4)
 *
 * Tests CREATE/READ/UPDATE/DELETE lifecycle for Assets
 * in the standard-readwrite profile.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('Assets CRUD (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  describe('GET /v2.0/Assets', () => {
    it('should return 10 assets from standard-readwrite fixture', async () => {
      const res = await request(app).get('/v2.0/Assets');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(10);
      expect(res.body.totalItems).toBe(10);
    });
  });

  describe('POST /v2.0/Assets', () => {
    it('should create a new asset with HTTP 201', async () => {
      const res = await request(app)
        .post('/v2.0/Assets')
        .send({
          assetTypeId: 'at-laptop-001',
          name: 'AST-TEST-001',
          ownerId: 'u-eng-001',
          ownerType: 'User',
          assetTag: 'AST-TEST-001',
          type: 'Laptop',
          department: 'Engineering',
          location: 'Test Office',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.assetTag).toBe('AST-TEST-001');
      expect(res.body.department).toBe('Engineering');
    });

    it('should return HTTP 400 when assetTag is missing', async () => {
      const res = await request(app)
        .post('/v2.0/Assets')
        .send({ type: 'Laptop', department: 'IT' });

      expect(res.status).toBe(400);
      expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
    });

    it('should update contact info via POST then PUT', async () => {
      const createRes = await request(app)
        .post('/v2.0/Assets')
        .send({ assetTypeId: 'at-desktop-001', name: 'AST-CONTACT-001', ownerId: 'u-hr-001', ownerType: 'User', assetTag: 'AST-CONTACT-001', type: 'Desktop', department: 'HR' });

      const id = createRes.body.id;

      const updateRes = await request(app)
        .put(`/v2.0/Assets/${id}`)
        .send({
          assetTag: 'AST-CONTACT-001',
          type: 'Desktop',
          department: 'Finance',
          location: 'New York HQ',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.department).toBe('Finance');
      expect(updateRes.body.location).toBe('New York HQ');
    });
  });

  describe('PUT /v2.0/Assets/:id', () => {
    it('should return HTTP 404 for non-existent asset', async () => {
      const res = await request(app)
        .put('/v2.0/Assets/00000000-0000-0000-0000-000000000000')
        .send({ assetTag: 'GHOST' });

      expect(res.status).toBe(404);
    });
  });

  // P13.1.5 — GET /v2.0/Assets/:id
  describe('GET /v2.0/Assets/:id', () => {
    it('should return 200 with a single asset for a valid ID', async () => {
      const listRes = await request(app).get('/v2.0/Assets');
      const id = listRes.body.data[0].id;

      const res = await request(app).get(`/v2.0/Assets/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body).toHaveProperty('assetTag');
    });

    it('should return 404 for an unknown GUID', async () => {
      const res = await request(app).get('/v2.0/Assets/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
    });

    it('should return 400 for an invalid GUID format', async () => {
      const res = await request(app).get('/v2.0/Assets/not-a-guid');
      expect(res.status).toBe(400);
      expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
    });
  });

  describe('DELETE /v2.0/Assets/:id', () => {
    it('should delete an asset and return HTTP 204', async () => {
      const createRes = await request(app)
        .post('/v2.0/Assets')
        .send({ assetTypeId: 'at-server-001', name: 'AST-DELETE-ME', ownerId: 'u-it-001', ownerType: 'User', assetTag: 'AST-DELETE-ME', type: 'Server' });

      const id = createRes.body.id;

      const deleteRes = await request(app).delete(`/v2.0/Assets/${id}`);
      expect(deleteRes.status).toBe(204);

      const listRes = await request(app).get('/v2.0/Assets');
      expect(listRes.body.totalItems).toBe(10);
    });
  });
});
