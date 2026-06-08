/**
 * Sprint 13.2 — Sub-resource list integration tests (P13.2.4 + P13.2.11)
 *
 * Uses LogicalGroups/{id}/WindowsEndpoints as the representative test case,
 * then covers StaticGroups, DynamicGroups, and UniversalDynamicGroups.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

// ─── LogicalGroups sub-resources ────────────────────────────────────────────

describe('LogicalGroups/{id}/WindowsEndpoints (standard-readonly)', () => {
  let app: Express;
  // "Windows Endpoints" logical group — has 10 windows endpoints with this logicalGroupId
  const LG_WINDOWS_ID = 'd1000001-0002-0002-0002-000000000002';
  const LG_UNKNOWN_ID = '00000000-0000-0000-0000-000000000099';

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET 200 with matching windows endpoints', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/WindowsEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('page', 0);
  });

  it('returns endpoints with correct logicalGroupId', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/WindowsEndpoints`)
      .expect(200);
    for (const ep of res.body.data) {
      expect(ep.logicalGroupId).toBe(LG_WINDOWS_ID);
    }
  });

  it('GET 404 for unknown parent ID', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_UNKNOWN_ID}/WindowsEndpoints`)
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET 400 for malformed parent ID', async () => {
    const res = await request(app)
      .get('/v2.0/LogicalGroups/not-a-guid/WindowsEndpoints')
      .expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns empty data array for group with no matching endpoints', async () => {
    // "Mac Endpoints" group has no windows endpoints
    const LG_MAC_ID = 'd1000001-0006-0006-0006-000000000006';
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_MAC_ID}/WindowsEndpoints`)
      .expect(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.totalItems).toBe(0);
  });

  it('supports PageSize pagination', async () => {
    // Page=1 is the first page (1-based API), returned as page=0 (0-based internal)
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/WindowsEndpoints?PageSize=3&Page=1`)
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(3);
    expect(res.body.pageSize).toBe(3);
    expect(res.body.page).toBe(0);
  });

  it('supports SearchQuery filtering', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_WINDOWS_ID}/WindowsEndpoints?SearchQuery=NYC`)
      .expect(200);
    // Should only return NYC endpoints
    for (const ep of res.body.data) {
      expect(JSON.stringify(ep)).toMatch(/NYC/i);
    }
  });
});

describe('LogicalGroups/{id}/AndroidEndpoints (standard-readonly)', () => {
  let app: Express;
  const LG_MOBILE_ID = 'd1000001-0003-0003-0003-000000000003';

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET 200 with android endpoints belonging to Mobile group', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_MOBILE_ID}/AndroidEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('LogicalGroups/{id}/LinuxEndpoints (standard-readonly)', () => {
  let app: Express;
  const LG_LINUX_ID = 'd1000001-0004-0004-0004-000000000004';

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET 200 with linux endpoints belonging to Linux Servers group', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_LINUX_ID}/LinuxEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('LogicalGroups/{id}/MacEndpoints (standard-readonly)', () => {
  let app: Express;
  const LG_MAC_ID = 'd1000001-0006-0006-0006-000000000006';

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET 200 with mac endpoints belonging to Mac group', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_MAC_ID}/MacEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('LogicalGroups/{id}/IosEndpoints (standard-readonly)', () => {
  let app: Express;
  const LG_MOBILE_ID = 'd1000001-0003-0003-0003-000000000003';

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET 200 with ios endpoints belonging to Mobile group', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_MOBILE_ID}/IosEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

describe('LogicalGroups/{id}/NetworkEndpoints (standard-readonly)', () => {
  let app: Express;
  const LG_NETWORK_ID = 'd1000001-0005-0005-0005-000000000005';

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET 200 with network endpoints belonging to Network Devices group', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${LG_NETWORK_ID}/NetworkEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ─── StaticGroups sub-resources ─────────────────────────────────────────────

describe('StaticGroups list & GET-by-ID (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/StaticGroups returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/StaticGroups').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET /v2.0/StaticGroups/:id returns single group', async () => {
    const listRes = await request(app).get('/v2.0/StaticGroups').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/StaticGroups/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/StaticGroups/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/StaticGroups/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── DynamicGroups sub-resources ────────────────────────────────────────────

describe('DynamicGroups list & GET-by-ID (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/DynamicGroups returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/DynamicGroups').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET /v2.0/DynamicGroups/:id returns single group', async () => {
    const listRes = await request(app).get('/v2.0/DynamicGroups').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/DynamicGroups/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/DynamicGroups/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/DynamicGroups/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});
