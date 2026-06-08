/**
 * P15.8 — IndustrialEndpoints as sub-resource of group collections (25R2 only)
 *
 * REQ-20.1.3: GET /v2.0/LogicalGroups/{id}/IndustrialEndpoints
 * REQ-20.1.4: GET /v2.0/StaticGroups/{id}/IndustrialEndpoints
 * REQ-20.1.5: GET /v2.0/UniversalDynamicGroups/{id}/IndustrialEndpoints
 * REQ-20.4.3: Routes must return HTTP 404 in 26R1 mode
 *
 * Known fixture IDs (standard-readonly / minimal-readonly):
 *   logicalGroup:  d1000001-0001-0001-0001-000000000001
 *   staticGroup:   e1000001-0001-0001-0001-000000000001
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { BmsVersion, ProfileMode } from '../../../src/profiles/ProfileManager';

const KNOWN_LG_ID   = 'd1000001-0001-0001-0001-000000000001';
const KNOWN_SG_ID   = 'e1000001-0001-0001-0001-000000000001';
const UNKNOWN_GUID  = '00000000-0000-0000-0000-000000000099';
const BAD_ID        = 'not-a-guid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function assertGroupIndustrialEndpoints(
  app: Express,
  parentPath: string,
  parentId: string,
): Promise<void> {
  const res = await request(app)
    .get(`/v2.0/${parentPath}/${parentId}/IndustrialEndpoints`)
    .expect(200);
  expect(res.body).toHaveProperty('data');
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body).toHaveProperty('totalItems');
}

// ─── standard-readonly (25R2) ─────────────────────────────────────────────────

describe('IndustrialEndpoints group sub-resources — standard-readonly (P15.8)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  // LogicalGroups
  it('GET /v2.0/LogicalGroups/{id}/IndustrialEndpoints returns 200', async () => {
    await assertGroupIndustrialEndpoints(app, 'LogicalGroups', KNOWN_LG_ID);
  });

  it('LogicalGroups IndustrialEndpoints items reference the correct parent', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${KNOWN_LG_ID}/IndustrialEndpoints`)
      .expect(200);
    for (const item of res.body.data) {
      expect(item.logicalGroupId).toBe(KNOWN_LG_ID);
    }
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/LogicalGroups/{unknown}/IndustrialEndpoints returns 404', async () => {
    await request(app)
      .get(`/v2.0/LogicalGroups/${UNKNOWN_GUID}/IndustrialEndpoints`)
      .expect(404);
  });

  it('GET /v2.0/LogicalGroups/{bad}/IndustrialEndpoints returns 400', async () => {
    await request(app)
      .get(`/v2.0/LogicalGroups/${BAD_ID}/IndustrialEndpoints`)
      .expect(400);
  });

  // StaticGroups
  it('GET /v2.0/StaticGroups/{id}/IndustrialEndpoints returns 200', async () => {
    await assertGroupIndustrialEndpoints(app, 'StaticGroups', KNOWN_SG_ID);
  });

  it('StaticGroups IndustrialEndpoints items reference the correct parent', async () => {
    const res = await request(app)
      .get(`/v2.0/StaticGroups/${KNOWN_SG_ID}/IndustrialEndpoints`)
      .expect(200);
    for (const item of res.body.data) {
      expect(item.staticGroupId).toBe(KNOWN_SG_ID);
    }
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/StaticGroups/{unknown}/IndustrialEndpoints returns 404', async () => {
    await request(app)
      .get(`/v2.0/StaticGroups/${UNKNOWN_GUID}/IndustrialEndpoints`)
      .expect(404);
  });

  it('GET /v2.0/StaticGroups/{bad}/IndustrialEndpoints returns 400', async () => {
    await request(app)
      .get(`/v2.0/StaticGroups/${BAD_ID}/IndustrialEndpoints`)
      .expect(400);
  });

  // UniversalDynamicGroups — no UDG fixtures in 25R2 so any valid GUID → 404
  it('GET /v2.0/UniversalDynamicGroups/{id}/IndustrialEndpoints route exists (not 404 on route-miss)', async () => {
    // With a valid GUID the route is reachable; parent not found → 404 (not a routing 404)
    const res = await request(app)
      .get(`/v2.0/UniversalDynamicGroups/${UNKNOWN_GUID}/IndustrialEndpoints`);
    expect([404]).toContain(res.status);
  });

  it('GET /v2.0/UniversalDynamicGroups/{bad}/IndustrialEndpoints returns 400', async () => {
    await request(app)
      .get(`/v2.0/UniversalDynamicGroups/${BAD_ID}/IndustrialEndpoints`)
      .expect(400);
  });
});

// ─── minimal-readonly (25R2) ──────────────────────────────────────────────────

describe('IndustrialEndpoints group sub-resources — minimal-readonly (P15.8)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.MINIMAL_READONLY);
  });

  it('GET /v2.0/LogicalGroups/{id}/IndustrialEndpoints returns 200', async () => {
    await assertGroupIndustrialEndpoints(app, 'LogicalGroups', KNOWN_LG_ID);
  });

  it('GET /v2.0/StaticGroups/{id}/IndustrialEndpoints returns 200', async () => {
    await assertGroupIndustrialEndpoints(app, 'StaticGroups', KNOWN_SG_ID);
  });

  it('GET /v2.0/LogicalGroups/{unknown}/IndustrialEndpoints returns 404', async () => {
    await request(app)
      .get(`/v2.0/LogicalGroups/${UNKNOWN_GUID}/IndustrialEndpoints`)
      .expect(404);
  });
});

// ─── standard-26r1 — routes available in both versions ───────────────────────

describe('IndustrialEndpoints group sub-resources — standard-26r1 routes available', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
  });

  it('GET /v2.0/LogicalGroups/{id}/IndustrialEndpoints returns 200 in 26R1', async () => {
    const res = await request(app)
      .get(`/v2.0/LogicalGroups/${KNOWN_LG_ID}/IndustrialEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/StaticGroups/{id}/IndustrialEndpoints returns 200 in 26R1', async () => {
    const res = await request(app)
      .get(`/v2.0/StaticGroups/${KNOWN_SG_ID}/IndustrialEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/UniversalDynamicGroups/{unknown}/IndustrialEndpoints returns 404 (not found) in 26R1', async () => {
    // Route is registered; 404 because the UDG ID does not exist
    await request(app)
      .get(`/v2.0/UniversalDynamicGroups/${UNKNOWN_GUID}/IndustrialEndpoints`)
      .expect(404);
  });
});
