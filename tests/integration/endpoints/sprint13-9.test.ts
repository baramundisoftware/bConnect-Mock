/**
 * Sprint 13.9 — 25R2-only routes integration tests (P13.9.6)
 * Tests P13.9.3–P13.9.5: IndustrialEndpoints sub-resource for groups (25R2 only)
 * Tests P13.9.1–P13.9.2: PUT MaintenanceWindow (25R2 verb) for Endpoints and LogicalGroups
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

// ─── LogicalGroups/{id}/IndustrialEndpoints (P13.9.3) ────────────────────────

describe('LogicalGroups IndustrialEndpoints — 25R2 only (P13.9.3)', () => {
  let app25r2: Express;
  let app26r1: Express;
  let logicalGroupId: string;

  beforeAll(async () => {
    app25r2 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    app26r1 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app25r2).get('/v2.0/LogicalGroups');
    logicalGroupId = res.body.data[0].id as string;
  });

  it('GET LogicalGroups/:id/IndustrialEndpoints returns 200 in 25R2', async () => {
    const res = await request(app25r2)
      .get(`/v2.0/LogicalGroups/${logicalGroupId}/IndustrialEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET LogicalGroups/:id/IndustrialEndpoints returns 404 for unknown group', async () => {
    const res = await request(app25r2)
      .get('/v2.0/LogicalGroups/00000000-0000-0000-0000-000000000000/IndustrialEndpoints')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET LogicalGroups/:id/IndustrialEndpoints returns 200 in 26R1 (route available in both versions)', async () => {
    // IndustrialEndpoints sub-resources are now available in both 25R2 and 26R1
    const res26r1ListRes = await request(app26r1).get('/v2.0/LogicalGroups');
    const id = res26r1ListRes.body.data[0].id as string;
    const res = await request(app26r1)
      .get(`/v2.0/LogicalGroups/${id}/IndustrialEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── StaticGroups/{id}/IndustrialEndpoints (P13.9.4) ─────────────────────────

describe('StaticGroups IndustrialEndpoints — 25R2 only (P13.9.4)', () => {
  let app25r2: Express;
  let staticGroupId: string;

  beforeAll(async () => {
    app25r2 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    const res = await request(app25r2).get('/v2.0/StaticGroups');
    staticGroupId = res.body.data[0].id as string;
  });

  it('GET StaticGroups/:id/IndustrialEndpoints returns 200 in 25R2', async () => {
    const res = await request(app25r2)
      .get(`/v2.0/StaticGroups/${staticGroupId}/IndustrialEndpoints`)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET StaticGroups/:id/IndustrialEndpoints returns 404 for unknown group', async () => {
    const res = await request(app25r2)
      .get('/v2.0/StaticGroups/00000000-0000-0000-0000-000000000000/IndustrialEndpoints')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── PUT MaintenanceWindow — both modes (P13.9.1, P13.9.2) ───────────────────

describe('PUT Endpoints MaintenanceWindow — 25R2 verb (P13.9.1)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  it('PUT /v2.0/Endpoints/:id/MaintenanceWindow returns 200 in read-write mode', async () => {
    const res = await request(app)
      .put('/v2.0/Endpoints/some-endpoint-id/MaintenanceWindow')
      .send({ maintenanceWindowDefinitionType: 'WorkdayWeekend', durationInMinutes: 60 })
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'WorkdayWeekend');
  });

  it('PUT /v2.0/Endpoints/:id/MaintenanceWindow returns 403 in read-only mode', async () => {
    const roApp = createApp(ProfileMode.STANDARD_READONLY);
    await request(roApp)
      .put('/v2.0/Endpoints/some-endpoint-id/MaintenanceWindow')
      .send({ maintenanceWindowDefinitionType: 'Everyday' })
      .expect(403);
  });
});

describe('PUT LogicalGroups MaintenanceWindow — 25R2 verb (P13.9.2)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  it('PUT /v2.0/LogicalGroups/:id/MaintenanceWindow returns 200 in read-write mode', async () => {
    const res = await request(app)
      .put('/v2.0/LogicalGroups/some-group-id/MaintenanceWindow')
      .send({ maintenanceWindowDefinitionType: 'Everyday', durationInMinutes: 120 })
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'Everyday');
  });

  it('PUT /v2.0/LogicalGroups/:id/MaintenanceWindow returns 403 in read-only mode', async () => {
    const roApp = createApp(ProfileMode.STANDARD_READONLY);
    await request(roApp)
      .put('/v2.0/LogicalGroups/some-group-id/MaintenanceWindow')
      .send({ maintenanceWindowDefinitionType: 'Everyday' })
      .expect(403);
  });
});
