import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

describe('GET /v2.0/LinuxEndpoints', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('should return 200 and exactly 3 endpoints', async () => {
    const response = await request(app)
      .get('/v2.0/LinuxEndpoints')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.data).toHaveLength(3);
    expect(response.body.totalItems).toBe(3);
  });

  it('should return endpoints with valid structure', async () => {
    const response = await request(app).get('/v2.0/LinuxEndpoints').expect(200);

    const endpoint = response.body.data[0];
    expect(endpoint).toHaveProperty('id');
    expect(endpoint).toHaveProperty('displayName');
    expect(endpoint).toHaveProperty('endpointType', 'LinuxEndpoint');
    expect(endpoint).toHaveProperty('operatingSystem');
  });

  it('should return pagination metadata', async () => {
    const response = await request(app).get('/v2.0/LinuxEndpoints').expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pageSize');
    expect(response.body).toHaveProperty('page', 0);
    expect(response.body).toHaveProperty('totalItems', 3);
  });

  it('should have realistic Linux OS data', async () => {
    const response = await request(app).get('/v2.0/LinuxEndpoints').expect(200);

    response.body.data.forEach((endpoint: { operatingSystem: string }) => {
      expect(endpoint.operatingSystem).toMatch(/Ubuntu|Red Hat|Debian|CentOS|Rocky|SUSE/i);
    });
  });

  it('should support pagination (PageSize=2, Page=0)', async () => {
    const response = await request(app)
      .get('/v2.0/LinuxEndpoints?PageSize=2&Page=0')
      .expect(200);

    expect(response.body.data).toHaveLength(2);
    expect(response.body.pageSize).toBe(2);
    expect(response.body.page).toBe(0);
    expect(response.body.totalItems).toBe(3);
  });

  it('should support SearchQuery filtering', async () => {
    const response = await request(app)
      .get('/v2.0/LinuxEndpoints?SearchQuery=LNX-PROD')
      .expect(200);

    expect(response.body.data.length).toBeGreaterThan(0);
    response.body.data.forEach((endpoint: { displayName: string }) => {
      expect(endpoint.displayName).toContain('LNX-PROD');
    });
  });

  it('should support OrderBy sorting', async () => {
    const response = await request(app)
      .get('/v2.0/LinuxEndpoints?OrderBy=DisplayName asc')
      .expect(200);

    const names = response.body.data.map((e: { displayName: string }) => e.displayName);
    for (let i = 0; i < names.length - 1; i++) {
      expect(names[i].localeCompare(names[i + 1])).toBeLessThanOrEqual(0);
    }
  });

  it('should return 200 with empty array for no SearchQuery matches', async () => {
    const response = await request(app)
      .get('/v2.0/LinuxEndpoints?SearchQuery=NonExistentHost')
      .expect(200);

    expect(response.body.data).toHaveLength(0);
    expect(response.body.totalItems).toBe(0);
  });

  // P13.1.1 — GET /v2.0/LinuxEndpoints/:id
  describe('GET /v2.0/LinuxEndpoints/:id', () => {
    it('should return 200 with a single endpoint for a valid ID', async () => {
      const listRes = await request(app).get('/v2.0/LinuxEndpoints');
      const id = listRes.body.data[0].id;

      const res = await request(app).get(`/v2.0/LinuxEndpoints/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body).toHaveProperty('displayName');
      expect(res.body).toHaveProperty('endpointType', 'LinuxEndpoint');
    });

    it('should return 404 for an unknown GUID', async () => {
      const res = await request(app).get('/v2.0/LinuxEndpoints/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400 for an invalid GUID format', async () => {
      const res = await request(app).get('/v2.0/LinuxEndpoints/not-a-guid');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
