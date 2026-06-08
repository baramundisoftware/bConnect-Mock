import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('GET /v2.0/MacEndpoints', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('should return 200 and exactly 2 endpoints', async () => {
    const response = await request(app)
      .get('/v2.0/MacEndpoints')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(2);
    expect(response.body.totalItems).toBe(2);
  });

  it('should return endpoints with valid structure', async () => {
    const response = await request(app).get('/v2.0/MacEndpoints').expect(200);

    const endpoint = response.body.data[0];
    expect(endpoint).toHaveProperty('id');
    expect(endpoint).toHaveProperty('displayName');
    expect(endpoint).toHaveProperty('endpointType', 'MacEndpoint');
    expect(endpoint).toHaveProperty('operatingSystem');
  });

  it('should return pagination metadata', async () => {
    const response = await request(app).get('/v2.0/MacEndpoints').expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pageSize');
    expect(response.body).toHaveProperty('page', 0);
    expect(response.body).toHaveProperty('totalItems', 2);
  });

  it('should have realistic macOS data', async () => {
    const response = await request(app).get('/v2.0/MacEndpoints').expect(200);

    response.body.data.forEach((endpoint: { operatingSystem: string }) => {
      expect(endpoint.operatingSystem).toMatch(/macOS|Mac OS/i);
    });
  });

  it('should support SearchQuery filtering', async () => {
    const response = await request(app)
      .get('/v2.0/MacEndpoints?SearchQuery=MAC-EXEC')
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((endpoint: { displayName: string }) => {
      expect(endpoint.displayName).toContain('MAC-EXEC');
    });
  });

  it('should support OrderBy sorting', async () => {
    const response = await request(app)
      .get('/v2.0/MacEndpoints?OrderBy=DisplayName desc')
      .expect(200);

    const names = response.body.data.map((e: { displayName: string }) => e.displayName);
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i].localeCompare(names[i + 1])).toBeGreaterThanOrEqual(0);
    }
  });

  it('should return 200 with empty array for no SearchQuery matches', async () => {
    const response = await request(app)
      .get('/v2.0/MacEndpoints?SearchQuery=NonExistentHost')
      .expect(200);

    expect(response.body.data).toHaveLength(0);
    expect(response.body.totalItems).toBe(0);
  });

  it('should return consistent data across multiple requests', async () => {
    const r1 = await request(app).get('/v2.0/MacEndpoints');
    const r2 = await request(app).get('/v2.0/MacEndpoints');
    expect(r1.body).toEqual(r2.body);
  });

  // P13.1.3 — GET /v2.0/MacEndpoints/:id
  describe('GET /v2.0/MacEndpoints/:id', () => {
    it('should return 200 with a single endpoint for a valid ID', async () => {
      const listRes = await request(app).get('/v2.0/MacEndpoints');
      const id = listRes.body.data[0].id;

      const res = await request(app).get(`/v2.0/MacEndpoints/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body).toHaveProperty('displayName');
      expect(res.body).toHaveProperty('endpointType', 'MacEndpoint');
    });

    it('should return 404 for an unknown GUID', async () => {
      const res = await request(app).get('/v2.0/MacEndpoints/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for an invalid GUID format', async () => {
      const res = await request(app).get('/v2.0/MacEndpoints/not-a-guid');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
