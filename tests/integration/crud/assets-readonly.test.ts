/**
 * Coverage Fix — assets.ts and variables routes in read-only profile
 *
 * Tests 403 responses and PATCH /v2.0/VariableInstances/:id route.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

const VALID_GUID = '00000000-0000-0000-0000-000000000001';

describe('Assets read-only 403 paths', () => {
  let appRO: Express;
  let appRW: Express;

  beforeAll(() => {
    appRO = createApp(ProfileMode.STANDARD_READONLY);
    appRW = createApp(ProfileMode.STANDARD_READWRITE);
  });

  // ─── Assets GET list (readwrite profile, no stateManager guard) ──────────

  it('GET /v2.0/Assets returns 200 in read-only profile', async () => {
    const res = await request(appRO).get('/v2.0/Assets').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Assets supports SearchQuery in readwrite', async () => {
    const res = await request(appRW).get('/v2.0/Assets?SearchQuery=Asset').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ─── Variables readwrite CRUD ─────────────────────────────────────────────

  it('PUT /v2.0/Variables/:id returns 404 for non-existent id', async () => {
    const res = await request(appRW)
      .put(`/v2.0/Variables/${VALID_GUID}`)
      .send({ name: 'TestVar', value: 'newValue' });
    expect(res.status).toBe(404);
  });

  it('PATCH /v2.0/Variables/:id returns 404 for non-existent id', async () => {
    const res = await request(appRW)
      .patch(`/v2.0/Variables/${VALID_GUID}`)
      .send({ value: 'newValue' });
    expect(res.status).toBe(404);
  });

  it('DELETE /v2.0/Variables/:id returns 404 for non-existent id', async () => {
    const res = await request(appRW).delete(`/v2.0/Variables/${VALID_GUID}`);
    expect(res.status).toBe(404);
  });

  // ─── VariableDefinitions readwrite CRUD ───────────────────────────────────

  it('PATCH /v2.0/VariableDefinitions/:id returns 404 for non-existent id', async () => {
    const res = await request(appRW)
      .patch(`/v2.0/VariableDefinitions/${VALID_GUID}`)
      .send({ value: 'newValue' });
    expect(res.status).toBe(404);
  });

  it('DELETE /v2.0/VariableDefinitions/:id returns 404 for non-existent id', async () => {
    const res = await request(appRW).delete(`/v2.0/VariableDefinitions/${VALID_GUID}`);
    expect(res.status).toBe(404);
  });

  // ─── VariableInstances PATCH ──────────────────────────────────────────────

  it('PATCH /v2.0/VariableInstances/:id returns 404 for non-existent id in readwrite', async () => {
    const res = await request(appRW)
      .patch(`/v2.0/VariableInstances/${VALID_GUID}`)
      .send({ value: 'newValue' });
    expect(res.status).toBe(404);
  });

  it('PATCH /v2.0/VariableInstances/:id returns 403 in read-only mode', async () => {
    const res = await request(appRO)
      .patch(`/v2.0/VariableInstances/${VALID_GUID}`)
      .send({ value: 'newValue' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/VariableInstances/:id returns 400 for invalid GUID', async () => {
    const res = await request(appRW)
      .patch('/v2.0/VariableInstances/not-a-guid')
      .send({ value: 'newValue' });
    expect(res.status).toBe(400);
  });

  // ─── AssetStock Folders - read-only GET list ──────────────────────────────

  it('GET /v2.0/AssetStock/Folders returns 200 in read-only mode', async () => {
    const res = await request(appRO).get('/v2.0/AssetStock/Folders').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('DELETE /v2.0/AssetStock/Folders/:id returns 404 for non-existent id', async () => {
    const res = await request(appRW).delete(`/v2.0/AssetStock/Folders/${VALID_GUID}`);
    expect(res.status).toBe(404);
  });
});
