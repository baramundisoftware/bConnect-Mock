import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('ServerManagement - Microservices', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  describe('GET /v2.0/Microservices', () => {
    it('should return 200 with microservices list', async () => {
      const response = await request(app)
        .get('/v2.0/Microservices')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return microservices with required fields', async () => {
      const response = await request(app).get('/v2.0/Microservices').expect(200);

      const ms = response.body.data[0];
      expect(ms).toHaveProperty('id');
      expect(ms).toHaveProperty('name');
      expect(ms).toHaveProperty('state');
    });

    it('should return pagination metadata', async () => {
      const response = await request(app).get('/v2.0/Microservices').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalItems');
    });

    it('should support SearchQuery filtering', async () => {
      const response = await request(app)
        .get('/v2.0/Microservices?SearchQuery=Agent')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(
        response.body.data.some((ms: { name: string }) =>
          ms.name.toLowerCase().includes('agent')
        )
      ).toBe(true);
    });

    it('should support pagination with PageSize and Page', async () => {
      const response = await request(app)
        .get('/v2.0/Microservices?PageSize=2&Page=0')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pageSize).toBe(2);
      expect(response.body.currentPage).toBe(0);
    });
  });

  describe('GET /v2.0/Microservices/:id', () => {
    it('should return a single microservice by ID', async () => {
      const listResponse = await request(app).get('/v2.0/Microservices').expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .get(`/v2.0/Microservices/${firstId}`)
        .expect(200);

      expect(response.body.id).toBe(firstId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('state');
    });

    it('should return 404 for non-existent microservice ID', async () => {
      await request(app)
        .get('/v2.0/Microservices/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('POST /v2.0/Microservices/:id/Start', () => {
    it('should return 200 when starting a microservice', async () => {
      const listResponse = await request(app).get('/v2.0/Microservices').expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .post(`/v2.0/Microservices/${firstId}/Start`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });

    it('should return 404 when starting non-existent microservice', async () => {
      await request(app)
        .post('/v2.0/Microservices/00000000-0000-0000-0000-000000000000/Start')
        .expect(404);
    });
  });

  describe('POST /v2.0/Microservices/:id/Stop', () => {
    it('should return 200 when stopping a microservice', async () => {
      const listResponse = await request(app).get('/v2.0/Microservices').expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .post(`/v2.0/Microservices/${firstId}/Stop`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /v2.0/Microservices/:id/Restart', () => {
    it('should return 200 when restarting a microservice', async () => {
      const listResponse = await request(app).get('/v2.0/Microservices').expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .post(`/v2.0/Microservices/${firstId}/Restart`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });
});
