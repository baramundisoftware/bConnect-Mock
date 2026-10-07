/**
 * Jobs CRUD Integration Tests (Phase 4)
 *
 * Tests CREATE/READ/UPDATE/DELETE lifecycle for JobDefinitions
 * in the standard-readwrite profile.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('Jobs CRUD (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  describe('GET /v2.0/JobDefinitions', () => {
    it('should return 5 jobs from standard-readwrite fixture', async () => {
      const res = await request(app).get('/v2.0/JobDefinitions');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      expect(res.body.totalItems).toBe(5);
    });
  });

  describe('POST /v2.0/JobDefinitions', () => {
    it('should create a new job with HTTP 201', async () => {
      const res = await request(app)
        .post('/v2.0/JobDefinitions')
        .send({
          name: 'Deploy New Software',
          type: 'SoftwareDeployment',
          targetGroup: 'All Endpoints',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Deploy New Software');
    });

    it('should return HTTP 400 when name is missing', async () => {
      const res = await request(app)
        .post('/v2.0/JobDefinitions')
        .send({ type: 'SoftwareDeployment' });

      expect(res.status).toBe(400);
      expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
    });

    it('should trigger a job (create with status Running)', async () => {
      const res = await request(app)
        .post('/v2.0/JobDefinitions')
        .send({
          name: 'Triggered Job',
          type: 'ComplianceScan',
          status: 'Running',
          targetGroup: 'All Windows Endpoints',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('Running');
    });
  });

  describe('PUT /v2.0/JobDefinitions/:id', () => {
    it('should update a job status (cancel)', async () => {
      const createRes = await request(app)
        .post('/v2.0/JobDefinitions')
        .send({ name: 'Job To Cancel', type: 'InventoryScan', status: 'Running' });

      const id = createRes.body.id;

      const updateRes = await request(app)
        .put(`/v2.0/JobDefinitions/${id}`)
        .send({ name: 'Job To Cancel', type: 'InventoryScan', status: 'Cancelled' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.status).toBe('Cancelled');
    });

    it('should return HTTP 404 for non-existent job', async () => {
      const res = await request(app)
        .put('/v2.0/JobDefinitions/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Ghost Job' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /v2.0/JobDefinitions/:id', () => {
    it('should delete a job and return HTTP 204', async () => {
      const createRes = await request(app)
        .post('/v2.0/JobDefinitions')
        .send({ name: 'Job To Delete', type: 'UpdateDeployment' });

      const id = createRes.body.id;

      const deleteRes = await request(app).delete(`/v2.0/JobDefinitions/${id}`);
      expect(deleteRes.status).toBe(204);

      const listRes = await request(app).get('/v2.0/JobDefinitions');
      expect(listRes.body.totalItems).toBe(5);
    });
  });
});
