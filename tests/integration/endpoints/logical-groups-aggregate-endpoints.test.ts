/**
 * GET /v2.0/LogicalGroups/:parentId/Endpoints — aggregated endpoint tests
 *
 * The /Endpoints sub-resource aggregates all endpoint types (Windows, Android,
 * Linux, Mac, iOS, Network, Industrial) filtered by logicalGroupId FK.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

// Group with Windows endpoints (d1000001-0002-...) — all 6 windows fixtures share this ID
const LG_WINDOWS_ID = 'd1000001-0002-0002-0002-000000000002';
// Group with Mobile endpoints (Android + iOS)
const LG_MOBILE_ID = 'd1000001-0003-0003-0003-000000000003';
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000099';
const BAD_ID = 'not-a-guid';

describe('GET /v2.0/LogicalGroups/:parentId/Endpoints (aggregate, standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  it('returns 200 with data array for a valid parent', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/Endpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('page', 0);
  });

  it('returns endpoints that all belong to the requested parent', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/Endpoints`)
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const ep of res.body.data) {
      expect(ep.logicalGroupId).toBe(LG_WINDOWS_ID);
    }
  });

  it('can return endpoints of multiple types for a mixed group', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_MOBILE_ID}/Endpoints`)
      .expect(200);
    // Mobile group has both Android and iOS endpoints
    const types = new Set(res.body.data.map((e: { endpointType?: string }) => e.endpointType));
    expect(types.size).toBeGreaterThanOrEqual(2);
  });

  it('returns 404 for unknown parent ID', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${UNKNOWN_ID}/Endpoints`)
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for malformed parent ID', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${BAD_ID}/Endpoints`)
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('supports PageSize pagination', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/Endpoints?PageSize=2&Page=1`)
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pageSize).toBe(2);
  });

  it('supports SearchQuery filtering', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/Endpoints?SearchQuery=NYC`)
      .expect(200);
    for (const ep of res.body.data) {
      expect(JSON.stringify(ep)).toMatch(/NYC/i);
    }
  });
});

describe('GET /v2.0/LogicalGroups/:parentId/Endpoints (aggregate, standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('returns 200 for standard-readonly profile', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/Endpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
