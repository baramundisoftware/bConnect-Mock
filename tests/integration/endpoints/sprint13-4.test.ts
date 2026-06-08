/**
 * Sprint 13.4 — New entity collections integration tests (P13.4.3, P13.4.12, P13.4.15)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

// ─── ADUsers (P13.4.3) ──────────────────────────────────────────────────────

describe('GET /v2.0/ADUsers (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/ADUsers returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/ADUsers').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('page', 0);
  });

  it('returns users with correct structure', async () => {
    const res = await request(app).get('/v2.0/ADUsers').expect(200);
    const user = res.body.data[0];
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('displayName');
    expect(user).toHaveProperty('samAccountName');
    expect(user).toHaveProperty('userPrincipalName');
  });

  it('GET /v2.0/ADUsers/:id returns single user', async () => {
    const listRes = await request(app).get('/v2.0/ADUsers').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/ADUsers/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/ADUsers/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/ADUsers/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /v2.0/ADUsers/:id returns 400 for malformed id', async () => {
    const res = await request(app).get('/v2.0/ADUsers/not-a-guid').expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('supports SearchQuery filtering', async () => {
    const res = await request(app)
      .get('/v2.0/ADUsers?SearchQuery=Engineering')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── Endpoints/{id} GET/DELETE (P13.4.12) ───────────────────────────────────

describe('GET/DELETE /v2.0/Endpoints/:id (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  it('GET /v2.0/Endpoints/:id returns a windows endpoint by ID', async () => {
    // Get a valid endpoint ID via the list
    const listRes = await request(app).get('/v2.0/WindowsEndpoints').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/Endpoints/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/Endpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/Endpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /v2.0/Endpoints/:id returns 400 for malformed id', async () => {
    const res = await request(app).get('/v2.0/Endpoints/not-a-guid').expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('DELETE /v2.0/Endpoints/:id deletes a windows endpoint', async () => {
    const listRes = await request(app).get('/v2.0/WindowsEndpoints').expect(200);
    const id = listRes.body.data[listRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/Endpoints/${id}`).expect(204);
    // Verify it's gone
    await request(app).get(`/v2.0/Endpoints/${id}`).expect(404);
  });

  it('DELETE /v2.0/Endpoints/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .delete('/v2.0/Endpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── InstalledWindowsSoftware (P13.4.15) ─────────────────────────────────────

describe('GET /v2.0/InstalledWindowsSoftware (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/InstalledWindowsSoftware returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/InstalledWindowsSoftware').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('returns items with correct structure', async () => {
    const res = await request(app).get('/v2.0/InstalledWindowsSoftware').expect(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('displayName');
    expect(item).toHaveProperty('version');
    expect(item).toHaveProperty('publisher');
  });

  it('supports SearchQuery filtering', async () => {
    const res = await request(app)
      .get('/v2.0/InstalledWindowsSoftware?SearchQuery=Microsoft')
      .expect(200);
    for (const item of res.body.data) {
      expect(JSON.stringify(item)).toMatch(/Microsoft/i);
    }
  });
});

// ─── OrgUnits (P13.4.4) ──────────────────────────────────────────────────────

describe('GET /v2.0/OrgUnits (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/OrgUnits returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/OrgUnits').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('page', 0);
  });

  it('returns org units with correct structure', async () => {
    const res = await request(app).get('/v2.0/OrgUnits').expect(200);
    const unit = res.body.data[0];
    expect(unit).toHaveProperty('id');
    expect(unit).toHaveProperty('name');
    expect(unit).toHaveProperty('distinguishedName');
  });

  it('GET /v2.0/OrgUnits/:id returns single org unit', async () => {
    const listRes = await request(app).get('/v2.0/OrgUnits').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/OrgUnits/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/OrgUnits/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/OrgUnits/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /v2.0/OrgUnits/:id returns 400 for malformed id', async () => {
    const res = await request(app).get('/v2.0/OrgUnits/not-a-guid').expect(400);
    expect(res.body).toHaveProperty('error');
  });

  it('supports SearchQuery filtering', async () => {
    const res = await request(app).get('/v2.0/OrgUnits?SearchQuery=IT').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('minimal profile returns at least 1 org unit', async () => {
    const minApp = createApp(ProfileMode.MINIMAL_READONLY);
    const res = await request(minApp).get('/v2.0/OrgUnits').expect(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('standard profile returns 3 nested org units', async () => {
    const res = await request(app).get('/v2.0/OrgUnits').expect(200);
    expect(res.body.totalItems).toBe(3);
  });
});

// ─── VariableDefinitions (P13.4.1) ───────────────────────────────────────────

describe('GET /v2.0/VariableDefinitions (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/VariableDefinitions returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/VariableDefinitions').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('GET /v2.0/VariableDefinitions/:id returns single definition', async () => {
    const listRes = await request(app).get('/v2.0/VariableDefinitions').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/VariableDefinitions/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/VariableDefinitions/:id returns 404 for unknown id', async () => {
    const res = await request(app)
      .get('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─── VariableInstances (P13.4.2) ────────────────────────────────────────────

describe('GET /v2.0/VariableInstances (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/VariableInstances returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/VariableInstances').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('returns instances with correct structure', async () => {
    const res = await request(app).get('/v2.0/VariableInstances').expect(200);
    const instance = res.body.data[0];
    expect(instance).toHaveProperty('id');
    expect(instance).toHaveProperty('variableDefinitionId');
    expect(instance).toHaveProperty('value');
  });

  it('GET /v2.0/VariableInstances/:id returns single instance', async () => {
    const listRes = await request(app).get('/v2.0/VariableInstances').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/VariableInstances/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });
});
