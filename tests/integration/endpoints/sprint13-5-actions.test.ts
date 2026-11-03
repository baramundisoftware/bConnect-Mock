/**
 * Sprint 13.5 — Action route integration tests (P13.5.5)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

describe('Enrollment action routes (P13.5.1)', () => {
  let app: Express;
  let windowsId: string;
  let androidId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const wRes = await request(app).get('/v2.0/WindowsEndpoints');
    windowsId = wRes.body.data[0].id;
    const aRes = await request(app).get('/v2.0/AndroidEndpoints');
    androidId = aRes.body.data[0].id;
  });

  it('POST WindowsEndpoints/:id/StartEnrollment returns 200', async () => {
    const res = await request(app)
      .post(`/v2.0/WindowsEndpoints/${windowsId}/StartEnrollment`)
      .expect(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('status', 'pending');
  });

  it('POST AndroidEndpoints/:id/StartEnrollment returns 200', async () => {
    const res = await request(app)
      .post(`/v2.0/AndroidEndpoints/${androidId}/StartEnrollment`)
      .expect(200);
    expect(res.body).toHaveProperty('message');
  });

  it('POST StartEnrollment returns 404 for unknown id', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000/StartEnrollment')
      .expect(404);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('POST StartEnrollment returns 400 for malformed id', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints/not-a-guid/StartEnrollment')
      .expect(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });
});

describe('TriggerInstallationViaIntune (P13.5.2)', () => {
  it.each([BmsVersion.BMS_25R2, BmsVersion.BMS_26R1, BmsVersion.BMS_26R2])('%s: 200 true for an Intune endpoint, 409 otherwise, 404 unknown, 400 malformed', async (version) => {
    for (const mode of [ProfileMode.STANDARD_READONLY, ProfileMode.STANDARD_READWRITE]) {
      const app = createApp(mode, version);
      const endpoints = (await request(app).get('/v2.0/WindowsEndpoints?PageSize=500')).body.data as Array<Record<string, unknown>>;
      const intune = endpoints.find((e) => e['coManagement'] === 'Intune')?.['id'] as string;
      const local = endpoints.find((e) => e['coManagement'] !== 'Intune')?.['id'] as string;
      const res = await request(app).post(`/v2.0/WindowsEndpoints/${intune}/TriggerInstallationViaIntune`).expect(200);
      expect(res.body).toBe(true);
      await request(app).post(`/v2.0/WindowsEndpoints/${local}/TriggerInstallationViaIntune`).expect(409);
      await request(app).post('/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000/TriggerInstallationViaIntune').expect(404);
      await request(app).post('/v2.0/WindowsEndpoints/not-a-guid/TriggerInstallationViaIntune').expect(400);
    }
  });
});

describe('Group AssignJobDefinition actions (P13.5.3)', () => {
  let app: Express;
  let lgId: string;
  let sgId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const lgRes = await request(app).get('/v2.0/LogicalGroups');
    lgId = lgRes.body.data[0].id;
    const sgRes = await request(app).get('/v2.0/StaticGroups');
    sgId = sgRes.body.data[0].id;
  });

  it('POST LogicalGroups/:id/AssignJobDefinition returns 200', async () => {
    const res = await request(app)
      .post(`/v2.0/LogicalGroups/${lgId}/AssignJobDefinition`)
      .expect(200);
    expect(res.body).toHaveProperty('message');
  });

  it('POST StaticGroups/:id/AssignJobDefinition returns 200', async () => {
    const res = await request(app)
      .post(`/v2.0/StaticGroups/${sgId}/AssignJobDefinition`)
      .expect(200);
    expect(res.body).toHaveProperty('message');
  });

  it('POST LogicalGroups/:id/AssignJobDefinition returns 404 for unknown group', async () => {
    const res = await request(app)
      .post('/v2.0/LogicalGroups/00000000-0000-0000-0000-000000000000/AssignJobDefinition')
      .expect(404);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });
});

describe('Server action routes (P13.5.4)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('POST /v2.0/Restart returns 204', async () => {
    await request(app).post('/v2.0/Restart').expect(204);
  });

  it('POST /v2.0/CancelScheduledRestart returns 204', async () => {
    await request(app).post('/v2.0/CancelScheduledRestart').expect(204);
  });
});
