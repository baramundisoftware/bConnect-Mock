import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('DefenseControl - BitLocker', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  describe('GET /v2.0/BitLocker/WindowsEndpoints', () => {
    it('should return 200 with BitLocker states list', async () => {
      const response = await request(app)
        .get('/v2.0/BitLocker/WindowsEndpoints')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return BitLocker states with required fields', async () => {
      const response = await request(app)
        .get('/v2.0/BitLocker/WindowsEndpoints')
        .expect(200);

      const state = response.body.data[0];
      expect(state).toHaveProperty('id');
      expect(state).toHaveProperty('endpointId');
      expect(state).toHaveProperty('endpointName');
    });

    it('should return pagination metadata', async () => {
      const response = await request(app)
        .get('/v2.0/BitLocker/WindowsEndpoints')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalItems');
    });

    it('should support pagination with PageSize', async () => {
      const response = await request(app)
        .get('/v2.0/BitLocker/WindowsEndpoints?PageSize=2&Page=0')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pageSize).toBe(2);
    });
  });

  describe('GET /v2.0/BitLocker/WindowsEndpoints/:id', () => {
    it('should return BitLocker state for a specific endpoint', async () => {
      const listResponse = await request(app)
        .get('/v2.0/BitLocker/WindowsEndpoints')
        .expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .get(`/v2.0/BitLocker/WindowsEndpoints/${firstId}`)
        .expect(200);

      expect(response.body.id).toBe(firstId);
      expect(response.body).toHaveProperty('endpointName');
    });

    it('should return 404 for non-existent ID', async () => {
      await request(app)
        .get('/v2.0/BitLocker/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
