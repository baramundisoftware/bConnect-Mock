import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('ActiveDirectory Module', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  describe('GET /v2.0/ADGroups', () => {
    it('should return 200 with AD groups list', async () => {
      const response = await request(app)
        .get('/v2.0/ADGroups')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return AD groups with required fields', async () => {
      const response = await request(app).get('/v2.0/ADGroups').expect(200);

      const group = response.body.data[0];
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name');
    });

    it('should return pagination metadata', async () => {
      const response = await request(app).get('/v2.0/ADGroups').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalItems');
    });

    it('should support SearchQuery filtering', async () => {
      const response = await request(app)
        .get('/v2.0/ADGroups?SearchQuery=Admin')
        .expect(200);

      expect(
        response.body.data.some((g: { name: string }) =>
          g.name.toLowerCase().includes('admin')
        )
      ).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/v2.0/ADGroups?PageSize=2&Page=0')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pageSize).toBe(2);
    });

    it('should support OrderBy sorting', async () => {
      const response = await request(app)
        .get('/v2.0/ADGroups?OrderBy=name asc')
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /v2.0/ADGroups/:id', () => {
    it('should return a single AD group by ID', async () => {
      const listResponse = await request(app).get('/v2.0/ADGroups').expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .get(`/v2.0/ADGroups/${firstId}`)
        .expect(200);

      expect(response.body.id).toBe(firstId);
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for non-existent AD group ID', async () => {
      await request(app)
        .get('/v2.0/ADGroups/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /v2.0/ADObjects', () => {
    it('should return 200 with AD objects (users) list', async () => {
      const response = await request(app)
        .get('/v2.0/ADObjects')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return AD objects with required fields', async () => {
      const response = await request(app).get('/v2.0/ADObjects').expect(200);

      const obj = response.body.data[0];
      expect(obj).toHaveProperty('id');
      expect(obj).toHaveProperty('name');
    });

    it('should return pagination metadata', async () => {
      const response = await request(app).get('/v2.0/ADObjects').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalItems');
    });

    it('should support SearchQuery filtering', async () => {
      const response = await request(app)
        .get('/v2.0/ADObjects?SearchQuery=Smith')
        .expect(200);

      expect(
        response.body.data.some((o: { name: string }) =>
          o.name.toLowerCase().includes('smith')
        )
      ).toBe(true);
    });

    it('should support OrderBy sorting', async () => {
      const response = await request(app)
        .get('/v2.0/ADObjects?OrderBy=name asc')
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /v2.0/ADObjects/:id', () => {
    it('should return a single AD object by valid ID', async () => {
      const listResponse = await request(app).get('/v2.0/ADObjects').expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .get(`/v2.0/ADObjects/${firstId}`)
        .expect(200);

      expect(response.body.id ?? response.body.guid).toBeTruthy();
    });

    it('should return 400 for non-GUID id', async () => {
      await request(app)
        .get('/v2.0/ADObjects/not-a-guid')
        .expect(400);
    });

    it('should return 404 for unknown GUID', async () => {
      await request(app)
        .get('/v2.0/ADObjects/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
