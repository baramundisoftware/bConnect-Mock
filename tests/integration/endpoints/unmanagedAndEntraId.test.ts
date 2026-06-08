/**
 * UnmanagedEndpoints + EntraIdData Integration Tests (Phase 11)
 * Tests that these endpoints return data in 26R1 and 404 in 25R2.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('UnmanagedEndpoints (26R1)', () => {
  let app26r1: Express;
  let app25r2: Express;

  beforeAll(() => {
    app26r1 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    app25r2 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  });

  it('GET /v2.0/UnmanagedEndpoints returns 200 in 26R1 mode', async () => {
    const res = await request(app26r1).get('/v2.0/UnmanagedEndpoints');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET /v2.0/UnmanagedEndpoints returns endpoints with correct structure', async () => {
    const res = await request(app26r1).get('/v2.0/UnmanagedEndpoints');
    const endpoint = res.body.data[0];
    expect(endpoint).toHaveProperty('id');
    expect(endpoint).toHaveProperty('displayName');
    expect(endpoint).toHaveProperty('type', 'UnmanagedEndpoint');
    expect(endpoint).toHaveProperty('isManaged', false);
    expect(endpoint).toHaveProperty('primaryIP');
  });

  it('GET /v2.0/UnmanagedEndpoints/:id returns single unmanaged endpoint in 26R1', async () => {
    const listRes = await request(app26r1).get('/v2.0/UnmanagedEndpoints');
    const id = listRes.body.data[0].id;
    const res = await request(app26r1).get(`/v2.0/UnmanagedEndpoints/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/UnmanagedEndpoints/:id returns 404 for unknown id in 26R1', async () => {
    const res = await request(app26r1).get('/v2.0/UnmanagedEndpoints/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/UnmanagedEndpoints returns 404 in 25R2 mode', async () => {
    const res = await request(app25r2).get('/v2.0/UnmanagedEndpoints');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/UnmanagedEndpoints/:id returns 404 in 25R2 mode', async () => {
    const res = await request(app25r2).get('/v2.0/UnmanagedEndpoints/some-id');
    expect(res.status).toBe(404);
  });

  // P13.4.14 — DELETE /v2.0/UnmanagedEndpoints/:id
  // Note: readonly profiles block all DELETE via middleware (403). Use readwrite to test version gating.
  it('DELETE /v2.0/UnmanagedEndpoints/:id returns 404 in 25R2 readwrite (version not available)', async () => {
    const app25r2rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
    const res = await request(app25r2rw).delete('/v2.0/UnmanagedEndpoints/f0000001-0001-0001-0001-000000000001');
    expect(res.status).toBe(404);
  });

  it('DELETE /v2.0/UnmanagedEndpoints/:id returns 403 in 26R1 readwrite (mock does not delete)', async () => {
    const app26r1rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
    const listRes = await request(app26r1rw).get('/v2.0/UnmanagedEndpoints');
    const id = listRes.body.data[0].id;
    const res = await request(app26r1rw).delete(`/v2.0/UnmanagedEndpoints/${id}`);
    expect(res.status).toBe(403);
  });
});

describe('EntraIdData (26R1)', () => {
  let app26r1: Express;
  let app25r2: Express;

  beforeAll(() => {
    app26r1 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    app25r2 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  });

  it('GET /v2.0/EntraIdData returns 200 in 26R1 mode', async () => {
    const res = await request(app26r1).get('/v2.0/EntraIdData');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/EntraIdData returns entries with correct structure', async () => {
    const res = await request(app26r1).get('/v2.0/EntraIdData');
    const entry = res.body.data[0];
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('deviceId');
    expect(entry).toHaveProperty('entraObjectId');
    expect(entry).toHaveProperty('complianceState');
    expect(entry).toHaveProperty('intuneManaged');
  });

  it('GET /v2.0/EntraIdData/:deviceId returns entry by deviceId in 26R1', async () => {
    const listRes = await request(app26r1).get('/v2.0/EntraIdData');
    const deviceId = listRes.body.data[0].deviceId;
    const res = await request(app26r1).get(`/v2.0/EntraIdData/${deviceId}`);
    expect(res.status).toBe(200);
    expect(res.body.deviceId).toBe(deviceId);
  });

  it('GET /v2.0/EntraIdData/:deviceId returns 404 for unknown deviceId', async () => {
    const res = await request(app26r1).get('/v2.0/EntraIdData/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/EntraIdData returns 404 in 25R2 mode', async () => {
    const res = await request(app25r2).get('/v2.0/EntraIdData');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/EntraIdData/:deviceId returns 404 in 25R2 mode', async () => {
    const res = await request(app25r2).get('/v2.0/EntraIdData/some-id');
    expect(res.status).toBe(404);
  });
});

describe('Endpoints/{id}/EntraIdData (P13.4.13)', () => {
  let app26r1rw: Express;
  let app25r2rw: Express;
  let app26r1ro: Express;

  beforeAll(() => {
    app26r1rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
    app25r2rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
    app26r1ro = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
  });

  it('POST /v2.0/Endpoints/:id/EntraIdData returns 201 in 26R1 readwrite', async () => {
    const res = await request(app26r1rw)
      .post('/v2.0/Endpoints/a0000001-0001-0001-0001-000000000001/EntraIdData')
      .send({ deviceId: 'dev-001', entraObjectId: 'entra-001', complianceState: 'Compliant', intuneManaged: true });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('endpointId');
  });

  it('POST /v2.0/Endpoints/:id/EntraIdData returns 403 in 26R1 readonly', async () => {
    const res = await request(app26r1ro)
      .post('/v2.0/Endpoints/a0000001-0001-0001-0001-000000000001/EntraIdData')
      .send({ deviceId: 'dev-001' });
    expect(res.status).toBe(403);
  });

  it('POST /v2.0/Endpoints/:id/EntraIdData returns 404 in 25R2', async () => {
    const res = await request(app25r2rw)
      .post('/v2.0/Endpoints/a0000001-0001-0001-0001-000000000001/EntraIdData')
      .send({ deviceId: 'dev-001' });
    expect(res.status).toBe(404);
  });

  it('DELETE /v2.0/Endpoints/:id/EntraIdData returns 204 in 26R1 readwrite', async () => {
    // First POST to create
    await request(app26r1rw)
      .post('/v2.0/Endpoints/a0000001-0001-0001-0001-000000000002/EntraIdData')
      .send({ deviceId: 'dev-002' });
    const res = await request(app26r1rw)
      .delete('/v2.0/Endpoints/a0000001-0001-0001-0001-000000000002/EntraIdData');
    expect(res.status).toBe(204);
  });

  it('DELETE /v2.0/Endpoints/:id/EntraIdData returns 403 in 26R1 readonly', async () => {
    const res = await request(app26r1ro)
      .delete('/v2.0/Endpoints/a0000001-0001-0001-0001-000000000001/EntraIdData');
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/Endpoints/:id/EntraIdData returns 404 in 25R2', async () => {
    const res = await request(app25r2rw)
      .delete('/v2.0/Endpoints/a0000001-0001-0001-0001-000000000001/EntraIdData');
    expect(res.status).toBe(404);
  });
});
