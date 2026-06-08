/**
 * Generic /v2.0/Endpoints aggregate endpoint tests (Phase 11)
 *
 * Verifies the polymorphic Endpoints route combines all endpoint types.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('GET /v2.0/Endpoints (aggregate)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('returns 200 with a combined data array', async () => {
    const res = await request(app).get('/v2.0/Endpoints');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('page', 0);
  });

  it('contains endpoints from multiple types', async () => {
    const res = await request(app).get('/v2.0/Endpoints');
    const types = new Set(res.body.data.map((e: { type?: string }) => e.type));
    // At least Windows and iOS endpoint types should be present
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('returns more items than any single endpoint type alone', async () => {
    const [aggRes, winRes] = await Promise.all([
      request(app).get('/v2.0/Endpoints'),
      request(app).get('/v2.0/WindowsEndpoints'),
    ]);
    expect(aggRes.body.totalItems).toBeGreaterThan(winRes.body.totalItems);
  });

  it('supports pagination', async () => {
    const res = await request(app).get('/v2.0/Endpoints?PageSize=5&Page=0');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeLessThanOrEqual(5);
    expect(res.body.pageSize).toBe(5);
  });

  it('supports SearchQuery filtering', async () => {
    const listRes = await request(app).get('/v2.0/Endpoints');
    if (listRes.body.data.length === 0) {return;}

    const firstName = listRes.body.data[0].displayName as string;
    const keyword = firstName.split('-')[0];
    const searchRes = await request(app).get(`/v2.0/Endpoints?SearchQuery=${keyword}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThan(0);
  });

  it('all items have required id and displayName fields', async () => {
    const res = await request(app).get('/v2.0/Endpoints');
    res.body.data.forEach((item: Record<string, unknown>) => {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('displayName');
    });
  });
});
