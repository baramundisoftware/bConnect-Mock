/**
 * Coverage Fix — Read-only profile 403 responses for write routes
 *
 * Tests that write operations on STANDARD_READONLY profile return 403.
 * These branches are heavily exercised in endpoints.ts, assets.ts, and crudRoutes.ts
 * but were missing coverage because most tests use STANDARD_READWRITE.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

const VALID_GUID = '00000000-0000-0000-0000-000000000001';

describe('Read-only profile 403 responses', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  // ─── Endpoints write routes ───────────────────────────────────────────────

  it('POST /v2.0/WindowsEndpoints returns 403 in read-only mode', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({ displayName: 'Test', type: 'WorkStation' });
    expect(res.status).toBe(403);
  });

  it('PUT /v2.0/WindowsEndpoints/:id returns 403 in read-only mode', async () => {
    const res = await request(app)
      .put(`/v2.0/WindowsEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Test', type: 'WorkStation' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/WindowsEndpoints/:id returns 403 in read-only mode', async () => {
    const res = await request(app)
      .patch(`/v2.0/WindowsEndpoints/${VALID_GUID}`)
      .send({ displayName: 'Updated' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/WindowsEndpoints/:id returns 403 in read-only mode', async () => {
    const res = await request(app).delete(`/v2.0/WindowsEndpoints/${VALID_GUID}`);
    expect(res.status).toBe(403);
  });

  it('POST /v2.0/AndroidEndpoints returns 403 in read-only mode', async () => {
    const res = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'Test', operatingSystem: 'Android 14' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/AndroidEndpoints/:id returns 403 in read-only mode', async () => {
    const res = await request(app).delete(`/v2.0/AndroidEndpoints/${VALID_GUID}`);
    expect(res.status).toBe(403);
  });

  // ─── Endpoints PATCH/MaintenanceWindow write routes ───────────────────────

  it('POST /v2.0/Endpoints/:id/MaintenanceWindow returns 403 in read-only mode', async () => {
    const res = await request(app)
      .post(`/v2.0/Endpoints/${VALID_GUID}/MaintenanceWindow`)
      .send({ scheduleType: 'Weekly' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/Endpoints/:id/MaintenanceWindow returns 403 in read-only mode (26R1)', async () => {
    const app26 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app26)
      .patch(`/v2.0/Endpoints/${VALID_GUID}/MaintenanceWindow`)
      .send({ scheduleType: 'Weekly' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/Endpoints/:id/MaintenanceWindow returns 403 in read-only mode', async () => {
    const res = await request(app)
      .delete(`/v2.0/Endpoints/${VALID_GUID}/MaintenanceWindow`);
    expect(res.status).toBe(403);
  });

  // ─── Assets write routes ──────────────────────────────────────────────────

  it('POST /v2.0/Assets returns 403 in read-only mode', async () => {
    const res = await request(app)
      .post('/v2.0/Assets')
      .send({ name: 'Test Asset', assetType: 'Hardware' });
    expect(res.status).toBe(403);
  });

  it('PUT /v2.0/Assets/:id returns 403 in read-only mode', async () => {
    const res = await request(app)
      .put(`/v2.0/Assets/${VALID_GUID}`)
      .send({ name: 'Updated Asset' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/Assets/:id returns 403 in read-only mode', async () => {
    const res = await request(app)
      .patch(`/v2.0/Assets/${VALID_GUID}`)
      .send({ name: 'Updated Asset' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/Assets/:id returns 403 in read-only mode', async () => {
    const res = await request(app).delete(`/v2.0/Assets/${VALID_GUID}`);
    expect(res.status).toBe(403);
  });

  // ─── Variables write routes ───────────────────────────────────────────────

  it('POST /v2.0/Variables returns 403 in read-only mode', async () => {
    const res = await request(app)
      .post('/v2.0/Variables')
      .send({ name: 'TestVar', value: 'test' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/Variables/:id returns 403 in read-only mode', async () => {
    const res = await request(app).delete(`/v2.0/Variables/${VALID_GUID}`);
    expect(res.status).toBe(403);
  });

  // ─── VariableDefinitions write routes ────────────────────────────────────

  it('POST /v2.0/VariableDefinitions returns 403 in read-only mode', async () => {
    const res = await request(app)
      .post('/v2.0/VariableDefinitions')
      .send({ name: 'TestVarDef', value: 'test' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/VariableDefinitions/:id returns 403 in read-only mode', async () => {
    const res = await request(app)
      .patch(`/v2.0/VariableDefinitions/${VALID_GUID}`)
      .send({ value: 'newValue' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/VariableDefinitions/:id returns 403 in read-only mode', async () => {
    const res = await request(app).delete(`/v2.0/VariableDefinitions/${VALID_GUID}`);
    expect(res.status).toBe(403);
  });

  // ─── AssetStock Folders write routes ─────────────────────────────────────

  it('POST /v2.0/AssetStock/Folders returns 403 in read-only mode', async () => {
    const res = await request(app)
      .post('/v2.0/AssetStock/Folders')
      .send({ name: 'TestFolder' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/AssetStock/Folders/:id returns 403 in read-only mode', async () => {
    const res = await request(app)
      .patch(`/v2.0/AssetStock/Folders/${VALID_GUID}`)
      .send({ name: 'UpdatedFolder' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/AssetStock/Folders/:id returns 403 in read-only mode', async () => {
    const res = await request(app).delete(`/v2.0/AssetStock/Folders/${VALID_GUID}`);
    expect(res.status).toBe(403);
  });
});

describe('Endpoints bad GUID 400 responses', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  it('DELETE /v2.0/Endpoints/:id returns 400 for invalid GUID', async () => {
    const res = await request(app).delete('/v2.0/Endpoints/not-a-guid');
    expect(res.status).toBe(400);
  });

  it('DELETE /v2.0/WindowsEndpoints/:id returns 400 for invalid GUID', async () => {
    const res = await request(app).delete('/v2.0/WindowsEndpoints/not-a-guid');
    expect(res.status).toBe(400);
  });

  it('PATCH /v2.0/WindowsEndpoints/:id returns 400 for invalid GUID', async () => {
    const res = await request(app)
      .patch('/v2.0/WindowsEndpoints/not-a-guid')
      .send({ displayName: 'X' });
    expect(res.status).toBe(400);
  });
});
