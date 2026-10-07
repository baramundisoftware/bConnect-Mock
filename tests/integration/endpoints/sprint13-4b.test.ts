/**
 * Sprint 13.4 (part B) — KioskReleases, SecurityGroups, SecurityProfiles, AssetTypes
 * P13.4.5, P13.4.7, P13.4.8, P13.4.9
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

// ─── KioskReleases (P13.4.5) ────────────────────────────────────────────────

describe('KioskReleases (standard-readonly)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/KioskReleases returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/KioskReleases').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('returns items with correct structure', async () => {
    const res = await request(app).get('/v2.0/KioskReleases').expect(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('version');
  });

  it('GET /v2.0/KioskReleases/:id returns single item', async () => {
    const listRes = await request(app).get('/v2.0/KioskReleases').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/KioskReleases/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/KioskReleases/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/v2.0/KioskReleases/00000000-0000-0000-0000-000000000000').expect(404);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('supports SearchQuery filtering', async () => {
    const res = await request(app).get('/v2.0/KioskReleases?SearchQuery=Kiosk').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('KioskReleases CRUD (standard-readwrite)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });

  it('POST /v2.0/KioskReleases creates a new release', async () => {
    const res = await request(app)
      .post('/v2.0/KioskReleases')
      .send({ name: 'Test Kiosk v1.0', version: '1.0.0', status: 'Active' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Kiosk v1.0');
  });

  it('DELETE /v2.0/KioskReleases/:id removes release', async () => {
    const listRes = await request(app).get('/v2.0/KioskReleases').expect(200);
    const id = listRes.body.data[listRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/KioskReleases/${id}`).expect(204);
    await request(app).get(`/v2.0/KioskReleases/${id}`).expect(404);
  });

  it('DELETE /v2.0/KioskReleases/:id returns 404 for unknown id', async () => {
    const res = await request(app).delete('/v2.0/KioskReleases/00000000-0000-0000-0000-000000000000').expect(404);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });
});

// ─── SecurityGroups (P13.4.7) ────────────────────────────────────────────────

describe('SecurityGroups (standard-readonly)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/SecurityGroups returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/SecurityGroups').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns items with correct structure', async () => {
    const res = await request(app).get('/v2.0/SecurityGroups').expect(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
  });

  it('GET /v2.0/SecurityGroups/:id returns single item', async () => {
    const listRes = await request(app).get('/v2.0/SecurityGroups').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/SecurityGroups/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/SecurityGroups/:id returns 404 for unknown id', async () => {
    await request(app).get('/v2.0/SecurityGroups/00000000-0000-0000-0000-000000000000').expect(404);
  });
});

describe('SecurityGroups CRUD (standard-readwrite)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });

  it('POST /v2.0/SecurityGroups creates a new group', async () => {
    const res = await request(app)
      .post('/v2.0/SecurityGroups')
      .send({ name: 'Test Security Group', description: 'Test group' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Security Group');
  });

  it('PATCH /v2.0/SecurityGroups/:id updates a group', async () => {
    const listRes = await request(app).get('/v2.0/SecurityGroups').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app)
      .patch(`/v2.0/SecurityGroups/${id}`)
      .send({ description: 'Updated description' })
      .expect(200);
    expect(res.body.id).toBe(id);
  });

  it('DELETE /v2.0/SecurityGroups/:id removes group', async () => {
    const listRes = await request(app).get('/v2.0/SecurityGroups').expect(200);
    const id = listRes.body.data[listRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/SecurityGroups/${id}`).expect(204);
  });
});

// ─── SecurityProfiles (P13.4.8) ──────────────────────────────────────────────

describe('SecurityProfiles (standard-readonly)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/SecurityProfiles returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/SecurityProfiles').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns items with correct structure', async () => {
    const res = await request(app).get('/v2.0/SecurityProfiles').expect(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('level');
  });

  it('GET /v2.0/SecurityProfiles/:id returns single item', async () => {
    const listRes = await request(app).get('/v2.0/SecurityProfiles').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/SecurityProfiles/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/SecurityProfiles/:id returns 404 for unknown id', async () => {
    await request(app).get('/v2.0/SecurityProfiles/00000000-0000-0000-0000-000000000000').expect(404);
  });
});

describe('SecurityProfiles CRUD (standard-readwrite)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });

  it('POST /v2.0/SecurityProfiles creates a new profile', async () => {
    const res = await request(app)
      .post('/v2.0/SecurityProfiles')
      .send({ name: 'Custom Profile', level: 'High', description: 'Custom security' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Custom Profile');
  });

  it('PATCH /v2.0/SecurityProfiles/:id updates a profile', async () => {
    const listRes = await request(app).get('/v2.0/SecurityProfiles').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app)
      .patch(`/v2.0/SecurityProfiles/${id}`)
      .send({ level: 'Critical' })
      .expect(200);
    expect(res.body.id).toBe(id);
  });

  it('DELETE /v2.0/SecurityProfiles/:id removes profile', async () => {
    const listRes = await request(app).get('/v2.0/SecurityProfiles').expect(200);
    const id = listRes.body.data[listRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/SecurityProfiles/${id}`).expect(204);
  });
});

// ─── AssetTypes (P13.4.9) ─────────────────────────────────────────────────────

describe('AssetTypes (standard-readonly)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY); });

  it('GET /v2.0/AssetTypes returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/AssetTypes').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('returns items with correct structure', async () => {
    const res = await request(app).get('/v2.0/AssetTypes').expect(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
  });

  it('GET /v2.0/AssetTypes/:id returns single item', async () => {
    const listRes = await request(app).get('/v2.0/AssetTypes').expect(200);
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/AssetTypes/${id}`).expect(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/AssetTypes/:id returns 404 for unknown id', async () => {
    await request(app).get('/v2.0/AssetTypes/00000000-0000-0000-0000-000000000000').expect(404);
  });

  it('supports SearchQuery filtering', async () => {
    const res = await request(app).get('/v2.0/AssetTypes?SearchQuery=Laptop').expect(200);
    expect(res.body.data.some((item: Record<string, unknown>) => item['name'] === 'Laptop')).toBe(true);
  });
});

describe('AssetTypes CRUD (standard-readwrite)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE); });

  it('POST /v2.0/AssetTypes creates a new type', async () => {
    const res = await request(app)
      .post('/v2.0/AssetTypes')
      .send({ name: 'Tablet', description: 'Tablet devices' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Tablet');
  });

  it('DELETE /v2.0/AssetTypes/:id removes type', async () => {
    const listRes = await request(app).get('/v2.0/AssetTypes').expect(200);
    const id = listRes.body.data[listRes.body.data.length - 1].id;
    await request(app).delete(`/v2.0/AssetTypes/${id}`).expect(204);
  });

  it('DELETE /v2.0/AssetTypes/:id returns 404 for unknown id', async () => {
    const res = await request(app).delete('/v2.0/AssetTypes/00000000-0000-0000-0000-000000000000').expect(404);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });
});
