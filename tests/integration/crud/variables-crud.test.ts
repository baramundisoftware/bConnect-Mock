/**
 * Variables CRUD Integration Tests (Phase 4)
 *
 * Tests CREATE/READ/UPDATE/DELETE lifecycle for Variables
 * in the standard-readwrite profile.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('Variables CRUD (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  describe('GET /v2.0/Variables', () => {
    it('should return 5 variables from standard-readwrite fixture', async () => {
      const res = await request(app).get('/v2.0/Variables');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.totalItems).toBe(5);
    });
  });

  describe('POST /v2.0/Variables', () => {
    it('should create a new variable definition with HTTP 201', async () => {
      const res = await request(app)
        .post('/v2.0/Variables')
        .send({
          name: 'BuildingFloor',
          type: 'String',
          description: 'Physical building floor',
          values: ['1', '2', '3', '4', '5'],
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('BuildingFloor');
      expect(res.body.values).toEqual(['1', '2', '3', '4', '5']);
    });

    it('should return HTTP 400 when name is missing', async () => {
      const res = await request(app)
        .post('/v2.0/Variables')
        .send({ type: 'String', values: ['A', 'B'] });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /v2.0/Variables/:id', () => {
    it('should update variable values', async () => {
      const createRes = await request(app)
        .post('/v2.0/Variables')
        .send({ name: 'Priority', type: 'String', values: ['Low', 'Medium'] });

      const id = createRes.body.id;

      const updateRes = await request(app)
        .put(`/v2.0/Variables/${id}`)
        .send({ name: 'Priority', type: 'String', values: ['Low', 'Medium', 'High', 'Critical'] });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.values).toEqual(['Low', 'Medium', 'High', 'Critical']);
    });

    it('should return HTTP 404 for non-existent variable', async () => {
      const res = await request(app)
        .put('/v2.0/Variables/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Ghost' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /v2.0/Variables/:id', () => {
    it('should delete a variable and return HTTP 204', async () => {
      const createRes = await request(app)
        .post('/v2.0/Variables')
        .send({ name: 'TempVar', type: 'String', values: ['X'] });

      const id = createRes.body.id;

      const deleteRes = await request(app).delete(`/v2.0/Variables/${id}`);
      expect(deleteRes.status).toBe(204);

      const listRes = await request(app).get('/v2.0/Variables');
      expect(listRes.body.totalItems).toBe(5);
    });
  });
});
