/**
 * Sprint 13.6 — Defense Control Extended integration tests (P13.6.5)
 * BitLocker Secrets (P13.6.2), LocalAdministrativeAccounts (P13.6.3),
 * MicrosoftDefender (P13.6.4)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

// ─── BitLocker Secrets (P13.6.2, 26R1 only) ──────────────────────────────────

describe('BitLocker Secrets (P13.6.2)', () => {
  let app: Express;
  let endpointId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app).get('/v2.0/BitLocker/WindowsEndpoints');
    endpointId = res.body.data[0].endpointId as string;
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints/:id/Secrets returns 200', async () => {
    const res = await request(app)
      .get(`/v2.0/BitLocker/WindowsEndpoints/${endpointId}/Secrets`)
      .expect(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('endpointId', endpointId);
    expect(res.body).toHaveProperty('recoveryPassword');
  });

  it('GET BitLocker Secrets returns 404 for unknown endpoint', async () => {
    const res = await request(app)
      .get('/v2.0/BitLocker/WindowsEndpoints/00000000-0000-0000-0000-000000000000/Secrets')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── LocalAdministrativeAccounts (P13.6.3) ───────────────────────────────────

describe('LocalAdministrativeAccounts (P13.6.3)', () => {
  let app: Express;
  let endpointId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    // Use the first Windows endpoint that has a local admin account
    const blRes = await request(app).get('/v2.0/BitLocker/WindowsEndpoints');
    endpointId = blRes.body.data[0].endpointId as string;
  });

  it('GET /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id returns 200', async () => {
    const res = await request(app)
      .get(`/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/${endpointId}`)
      .expect(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('endpointId', endpointId);
    expect(res.body).toHaveProperty('accountName');
    expect(res.body).toHaveProperty('isEnabled');
  });

  it('GET LocalAdministrativeAccounts returns 404 for unknown endpoint', async () => {
    const res = await request(app)
      .get('/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── MicrosoftDefender Threats (P13.6.4) ─────────────────────────────────────

describe('MicrosoftDefender Threats (P13.6.4)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/MicrosoftDefender/Threats returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/MicrosoftDefender/Threats').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('returns threats with correct structure', async () => {
    const res = await request(app).get('/v2.0/MicrosoftDefender/Threats').expect(200);
    const threat = res.body.data[0];
    expect(threat).toHaveProperty('id');
    expect(threat).toHaveProperty('name');
    expect(threat).toHaveProperty('severity');
    expect(threat).toHaveProperty('category');
    expect(threat).toHaveProperty('status');
  });

  it('GET /v2.0/MicrosoftDefender/Threats/:id returns single threat', async () => {
    const listRes = await request(app).get('/v2.0/MicrosoftDefender/Threats').expect(200);
    const id = listRes.body.data[0].id as string;
    const res = await request(app).get(`/v2.0/MicrosoftDefender/Threats/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/MicrosoftDefender/Threats/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/MicrosoftDefender/Threats/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('supports SearchQuery filtering on threats', async () => {
    const res = await request(app)
      .get('/v2.0/MicrosoftDefender/Threats?SearchQuery=Trojan')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── MicrosoftDefender WindowsEndpoints (P13.6.4) ────────────────────────────

describe('MicrosoftDefender WindowsEndpoints (P13.6.4)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/MicrosoftDefender/WindowsEndpoints').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('returns defender states with correct structure', async () => {
    const res = await request(app).get('/v2.0/MicrosoftDefender/WindowsEndpoints').expect(200);
    const state = res.body.data[0];
    expect(state).toHaveProperty('id');
    expect(state).toHaveProperty('endpointId');
    expect(state).toHaveProperty('defenderStatus');
    expect(state).toHaveProperty('realTimeProtection');
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints/:id returns by endpointId', async () => {
    const listRes = await request(app).get('/v2.0/MicrosoftDefender/WindowsEndpoints').expect(200);
    const endpointId = listRes.body.data[0].endpointId as string;
    const res = await request(app)
      .get(`/v2.0/MicrosoftDefender/WindowsEndpoints/${endpointId}`)
      .expect(200);
    expect(res.body.endpointId).toBe(endpointId);
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/MicrosoftDefender/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('supports SearchQuery filtering on defender states', async () => {
    const res = await request(app)
      .get('/v2.0/MicrosoftDefender/WindowsEndpoints?SearchQuery=Enabled')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
