import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('OperatingSystems - Folders', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  describe('GET /v2.0/OSFolders', () => {
    it('should return 200 with OS folders list', async () => {
      const response = await request(app)
        .get('/v2.0/OSFolders')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return OS folders with required fields', async () => {
      const response = await request(app).get('/v2.0/OSFolders').expect(200);

      const folder = response.body.data[0];
      expect(folder).toHaveProperty('id');
      expect(folder).toHaveProperty('name');
    });

    it('should return pagination metadata', async () => {
      const response = await request(app).get('/v2.0/OSFolders').expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('currentPage');
      expect(response.body).toHaveProperty('totalItems');
    });

    it('should support SearchQuery filtering', async () => {
      const response = await request(app)
        .get('/v2.0/OSFolders?SearchQuery=Windows 10')
        .expect(200);

      expect(
        response.body.data.some((f: { name: string }) =>
          f.name.toLowerCase().includes('windows 10')
        )
      ).toBe(true);
    });

    it('should support pagination with PageSize', async () => {
      const response = await request(app)
        .get('/v2.0/OSFolders?PageSize=2&Page=0')
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pageSize).toBe(2);
    });
  });

  describe('GET /v2.0/OSFolders/:id', () => {
    it('should return an OS folder by ID', async () => {
      const listResponse = await request(app).get('/v2.0/OSFolders').expect(200);
      const firstId = listResponse.body.data[0].id;

      const response = await request(app)
        .get(`/v2.0/OSFolders/${firstId}`)
        .expect(200);

      expect(response.body.id).toBe(firstId);
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for non-existent folder ID', async () => {
      await request(app)
        .get('/v2.0/OSFolders/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
