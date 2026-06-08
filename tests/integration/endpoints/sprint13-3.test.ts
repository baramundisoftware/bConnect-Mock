/**
 * Sprint 13.3 — MaintenanceWindow Sub-Resources integration tests (P13.3.3, P13.3.5)
 * Endpoints/{id}/MaintenanceWindow (P13.3.4)
 * LogicalGroups/{id}/MaintenanceWindow (P13.3.6)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

// ─── Endpoints/{id}/MaintenanceWindow (P13.3.3 + P13.3.4) ────────────────────

describe('Endpoints MaintenanceWindow — read-only GET (P13.3.4)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/Endpoints/:id/MaintenanceWindow returns 200 with default data', async () => {
    const res = await request(app)
      .get('/v2.0/Endpoints/endpoint-id-0001/MaintenanceWindow')
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType');
    expect(res.body).toHaveProperty('startTime');
    expect(res.body).toHaveProperty('durationInMinutes');
  });
});

describe('Endpoints MaintenanceWindow — write operations (P13.3.4)', () => {
  let app25: Express;  // 25R2 — PUT verb
  let app26: Express;  // 26R1 — PATCH verb
  const endpointId = 'test-endpoint-mw-id';

  beforeAll(() => {
    app25 = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
    app26 = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
  });

  it('GET /v2.0/Endpoints/:id/MaintenanceWindow returns default when not set', async () => {
    const res = await request(app25)
      .get(`/v2.0/Endpoints/${endpointId}/MaintenanceWindow`)
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'Everyday');
  });

  it('POST /v2.0/Endpoints/:id/MaintenanceWindow creates MaintenanceWindow', async () => {
    const res = await request(app25)
      .post(`/v2.0/Endpoints/${endpointId}/MaintenanceWindow`)
      .send({ maintenanceWindowDefinitionType: 'WorkdayWeekend', startTime: '23:00:00', durationInMinutes: 60 })
      .expect(201);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'WorkdayWeekend');
    expect(res.body).toHaveProperty('startTime', '23:00:00');
  });

  it('GET after POST returns updated MaintenanceWindow', async () => {
    const res = await request(app25)
      .get(`/v2.0/Endpoints/${endpointId}/MaintenanceWindow`)
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'WorkdayWeekend');
  });

  it('PATCH /v2.0/Endpoints/:id/MaintenanceWindow updates MaintenanceWindow (26R1 verb)', async () => {
    const res = await request(app26)
      .patch(`/v2.0/Endpoints/${endpointId}/MaintenanceWindow`)
      .send({ durationInMinutes: 180 })
      .expect(200);
    expect(res.body).toHaveProperty('durationInMinutes', 180);
  });

  it('PUT /v2.0/Endpoints/:id/MaintenanceWindow updates MaintenanceWindow (25R2 verb)', async () => {
    const res = await request(app25)
      .put(`/v2.0/Endpoints/${endpointId}/MaintenanceWindow`)
      .send({ maintenanceWindowDefinitionType: 'Unrestricted' })
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'Unrestricted');
  });

  it('DELETE /v2.0/Endpoints/:id/MaintenanceWindow removes MaintenanceWindow', async () => {
    await request(app25)
      .delete(`/v2.0/Endpoints/${endpointId}/MaintenanceWindow`)
      .expect(204);
  });

  it('POST returns 403 in read-only mode', async () => {
    const roApp = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    await request(roApp)
      .post(`/v2.0/Endpoints/${endpointId}/MaintenanceWindow`)
      .send({ maintenanceWindowDefinitionType: 'Everyday' })
      .expect(403);
  });
});

// ─── LogicalGroups/{id}/MaintenanceWindow (P13.3.5 + P13.3.6) ────────────────

describe('LogicalGroups MaintenanceWindow — read-only GET (P13.3.6)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/LogicalGroups/:id/MaintenanceWindow returns 200 with default data', async () => {
    const res = await request(app)
      .get('/v2.0/LogicalGroups/group-id-0001/MaintenanceWindow')
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType');
    expect(res.body).toHaveProperty('startTime');
    expect(res.body).toHaveProperty('durationInMinutes');
  });
});

describe('LogicalGroups MaintenanceWindow — write operations (P13.3.6)', () => {
  let app25: Express;  // 25R2 — PUT verb
  let app26: Express;  // 26R1 — PATCH verb
  const groupId = 'test-group-mw-id';

  beforeAll(() => {
    app25 = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
    app26 = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
  });

  it('POST /v2.0/LogicalGroups/:id/MaintenanceWindow creates MaintenanceWindow', async () => {
    const res = await request(app25)
      .post(`/v2.0/LogicalGroups/${groupId}/MaintenanceWindow`)
      .send({ maintenanceWindowDefinitionType: 'WorkdayWeekend', startTime: '21:00:00', durationInMinutes: 90 })
      .expect(201);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'WorkdayWeekend');
  });

  it('PATCH /v2.0/LogicalGroups/:id/MaintenanceWindow updates (26R1 verb)', async () => {
    const res = await request(app26)
      .patch(`/v2.0/LogicalGroups/${groupId}/MaintenanceWindow`)
      .send({ durationInMinutes: 60 })
      .expect(200);
    expect(res.body).toHaveProperty('durationInMinutes', 60);
  });

  it('PUT /v2.0/LogicalGroups/:id/MaintenanceWindow updates (25R2 verb)', async () => {
    const res = await request(app25)
      .put(`/v2.0/LogicalGroups/${groupId}/MaintenanceWindow`)
      .send({ maintenanceWindowDefinitionType: 'Unrestricted' })
      .expect(200);
    expect(res.body).toHaveProperty('maintenanceWindowDefinitionType', 'Unrestricted');
  });

  it('DELETE /v2.0/LogicalGroups/:id/MaintenanceWindow removes MaintenanceWindow', async () => {
    await request(app25)
      .delete(`/v2.0/LogicalGroups/${groupId}/MaintenanceWindow`)
      .expect(204);
  });

  it('POST returns 403 in read-only mode', async () => {
    const roApp = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    await request(roApp)
      .post(`/v2.0/LogicalGroups/${groupId}/MaintenanceWindow`)
      .send({ maintenanceWindowDefinitionType: 'Everyday' })
      .expect(403);
  });
});
