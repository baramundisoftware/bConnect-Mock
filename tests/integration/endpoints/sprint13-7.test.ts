/**
 * Sprint 13.7 — Server Management Singletons & Read-Only integration tests (P13.7.5)
 * Gateway, ManagementServer, VpnAppliance, Dips (P13.7.2)
 * CloudConnectors, PxeRelays (P13.7.3)
 * Objects PATCH + Rights GET (P13.7.4)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

// ─── Singleton routes (P13.7.2) ──────────────────────────────────────────────

describe('Server Management Singletons (P13.7.2)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/Gateway returns 200 with singleton data', async () => {
    const res = await request(app).get('/v2.0/Gateway').expect(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('state');
  });

  it('GET /v2.0/ManagementServer returns 200 with singleton data', async () => {
    const res = await request(app).get('/v2.0/ManagementServer').expect(200);
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('state');
  });

  it('GET /v2.0/VpnAppliance returns 200 with singleton data', async () => {
    const res = await request(app).get('/v2.0/VpnAppliance').expect(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('state');
  });

  it('GET /v2.0/Dips returns 200 with the DIPs as a plain array (spec: DipInfo[])', async () => {
    const res = await request(app).get('/v2.0/Dips').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('hostName');
    expect(res.body[0]).toHaveProperty('state');
  });
});

// ─── List routes (P13.7.3) ───────────────────────────────────────────────────

describe('CloudConnectors and PxeRelays (P13.7.3)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  // The spec answers CloudConnectors and PxeRelays as plain arrays, without paging or search
  it('GET /v2.0/CloudConnectors returns 200 with a plain array', async () => {
    const res = await request(app).get('/v2.0/CloudConnectors').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('CloudConnectors have correct structure', async () => {
    const res = await request(app).get('/v2.0/CloudConnectors').expect(200);
    const item = res.body[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('state');
  });

  it('GET /v2.0/PxeRelays returns 200 with a plain array', async () => {
    const res = await request(app).get('/v2.0/PxeRelays').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('PxeRelays have correct structure', async () => {
    const res = await request(app).get('/v2.0/PxeRelays').expect(200);
    const item = res.body[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('ipAddress');
  });

  it('ignores SearchQuery on CloudConnectors (the spec has no parameters)', async () => {
    const all = await request(app).get('/v2.0/CloudConnectors').expect(200);
    const res = await request(app).get('/v2.0/CloudConnectors?SearchQuery=Primary').expect(200);
    expect(res.body).toEqual(all.body);
  });
});

// ─── Objects routes (P13.7.4) ────────────────────────────────────────────────

describe('Objects PATCH + Rights GET (P13.7.4)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  it('PATCH /v2.0/Objects/:id returns 200 with merged data', async () => {
    const id = 'test-object-id-0001';
    const res = await request(app)
      .patch(`/v2.0/Objects/${id}`)
      .send({ displayName: 'Updated Name' })
      .expect(200);
    expect(res.body).toHaveProperty('id', id);
    expect(res.body).toHaveProperty('displayName', 'Updated Name');
  });

  it('GET /v2.0/Objects/:id/Rights returns 200 with rights array', async () => {
    const res = await request(app)
      .get('/v2.0/Objects/some-object-id/Rights')
      .expect(200);
    expect(res.body).toHaveProperty('objectId');
    expect(Array.isArray(res.body.rights)).toBe(true);
    expect(res.body.rights.length).toBeGreaterThan(0);
    expect(res.body.rights[0]).toHaveProperty('principal');
    expect(res.body.rights[0]).toHaveProperty('permission');
  });
});
