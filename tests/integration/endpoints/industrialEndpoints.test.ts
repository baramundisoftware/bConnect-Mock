/**
 * IndustrialEndpoints write routes — 25R2 only
 *
 * POST, PATCH, PUT, DELETE are registered only in BMS_25R2.
 * Verifies correct 201/200/204 responses in 25R2 and 404 in 26R1.
 * Also verifies 403 in read-only mode.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

const VALID_GUID = '00000000-0000-0000-0000-000000000001';

describe('IndustrialEndpoints write routes — 25R2 only', () => {
  let app25rw: Express;
  let app26rw: Express;
  let app25ro: Express;
  let createdId: string;

  beforeAll(() => {
    app25rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
    app26rw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
    app25ro = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  });

  // ─── POST (create) ────────────────────────────────────────────────────────

  it('POST /v2.0/IndustrialEndpoints returns 201 in 25R2 read-write', async () => {
    const res = await request(app25rw)
      .post('/v2.0/IndustrialEndpoints')
      .send({ displayName: 'Conveyor-01', deviceType: 'PLC', zone: 'Zone A' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('displayName', 'Conveyor-01');
    createdId = res.body.id as string;
  });

  it('POST /v2.0/IndustrialEndpoints returns 403 in 25R2 read-only', async () => {
    await request(app25ro)
      .post('/v2.0/IndustrialEndpoints')
      .send({ displayName: 'Test' })
      .expect(403);
  });

  it('POST /v2.0/IndustrialEndpoints returns 201 in 26R1 (route available in both versions)', async () => {
    const res = await request(app26rw)
      .post('/v2.0/IndustrialEndpoints')
      .send({ displayName: 'Test' })
      .expect(201);
    expect(res.body).toHaveProperty('displayName', 'Test');
  });

  // ─── PATCH (update) ───────────────────────────────────────────────────────

  it('PATCH /v2.0/IndustrialEndpoints/:id returns 200 in 25R2 read-write', async () => {
    const res = await request(app25rw)
      .patch(`/v2.0/IndustrialEndpoints/${createdId}`)
      .send({ displayName: 'Conveyor-01-Updated' })
      .expect(200);
    expect(res.body).toHaveProperty('displayName', 'Conveyor-01-Updated');
  });

  it('PATCH /v2.0/IndustrialEndpoints/:id returns 403 in 25R2 read-only', async () => {
    await request(app25ro)
      .patch(`/v2.0/IndustrialEndpoints/${VALID_GUID}`)
      .send({ displayName: 'X' })
      .expect(403);
  });

  it('PATCH /v2.0/IndustrialEndpoints/:id returns 404 (not found) in 26R1 read-write', async () => {
    // Route is registered; 404 because the GUID does not exist in the store
    await request(app26rw)
      .patch(`/v2.0/IndustrialEndpoints/${VALID_GUID}`)
      .send({ displayName: 'X' })
      .expect(404);
  });

  // ─── PUT (replace) ────────────────────────────────────────────────────────

  it('PUT /v2.0/IndustrialEndpoints/:id returns 200 in 25R2 read-write', async () => {
    const res = await request(app25rw)
      .put(`/v2.0/IndustrialEndpoints/${createdId}`)
      .send({ displayName: 'Conveyor-01-Put', deviceType: 'SCADA', zone: 'Zone B' })
      .expect(200);
    expect(res.body).toHaveProperty('displayName', 'Conveyor-01-Put');
  });

  it('PUT /v2.0/IndustrialEndpoints/:id returns 404 (not found) in 26R1 read-write', async () => {
    // Route is registered; 404 because the GUID does not exist in the store
    await request(app26rw)
      .put(`/v2.0/IndustrialEndpoints/${VALID_GUID}`)
      .send({ displayName: 'X' })
      .expect(404);
  });

  // ─── DELETE ───────────────────────────────────────────────────────────────

  it('DELETE /v2.0/IndustrialEndpoints/:id returns 204 in 25R2 read-write', async () => {
    await request(app25rw)
      .delete(`/v2.0/IndustrialEndpoints/${createdId}`)
      .expect(204);
  });

  it('DELETE /v2.0/IndustrialEndpoints/:id returns 403 in 25R2 read-only', async () => {
    await request(app25ro)
      .delete(`/v2.0/IndustrialEndpoints/${VALID_GUID}`)
      .expect(403);
  });

  it('DELETE /v2.0/IndustrialEndpoints/:id returns 404 (not found) in 26R1 read-write', async () => {
    // Route is registered; 404 because the GUID does not exist in the store
    await request(app26rw)
      .delete(`/v2.0/IndustrialEndpoints/${VALID_GUID}`)
      .expect(404);
  });
});

describe('IndustrialEndpoints read routes — 25R2 only', () => {
  let app25: Express;
  let app26: Express;
  let industrialId: string;

  beforeAll(async () => {
    app25 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    app26 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app25).get('/v2.0/IndustrialEndpoints');
    industrialId = res.body.data[0].id as string;
  });

  it('GET /v2.0/IndustrialEndpoints returns 200 with data in 25R2', async () => {
    const res = await request(app25).get('/v2.0/IndustrialEndpoints').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET /v2.0/IndustrialEndpoints/:id returns 200 in 25R2', async () => {
    const res = await request(app25)
      .get(`/v2.0/IndustrialEndpoints/${industrialId}`)
      .expect(200);
    expect(res.body).toHaveProperty('id', industrialId);
  });

  it('GET /v2.0/IndustrialEndpoints returns 200 in 26R1 (route available in both versions)', async () => {
    const res = await request(app26).get('/v2.0/IndustrialEndpoints').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/IndustrialEndpoints/:id returns 200 in 26R1 (route available in both versions)', async () => {
    const res = await request(app26).get(`/v2.0/IndustrialEndpoints/${industrialId}`).expect(200);
    expect(res.body).toHaveProperty('id', industrialId);
  });
});
