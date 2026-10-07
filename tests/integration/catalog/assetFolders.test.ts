/**
 * AssetTypes/Folders (P13.4.10), AssetStock/Folders + Assets (P13.4.11),
 * Bundle/Folders mutations (P13.4.17) integration tests.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('AssetTypes/Folders (P13.4.10)', () => {
  let appRo: Express;
  let appRw: Express;

  beforeAll(() => {
    appRo = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    appRw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
  });

  it('GET /v2.0/AssetTypes/Folders returns list with correct structure', async () => {
    const res = await request(appRo).get('/v2.0/AssetTypes/Folders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('name');
  });

  it('GET /v2.0/AssetTypes/Folders/:id returns single folder', async () => {
    const listRes = await request(appRo).get('/v2.0/AssetTypes/Folders');
    const id = listRes.body.data[0].id;
    const res = await request(appRo).get(`/v2.0/AssetTypes/Folders/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/AssetTypes/Folders/:id returns 404 for unknown id', async () => {
    const res = await request(appRo).get('/v2.0/AssetTypes/Folders/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/AssetTypes/Folders/:folderId/Folders returns children', async () => {
    const listRes = await request(appRo).get('/v2.0/AssetTypes/Folders');
    const parentId = listRes.body.data.find((f: Record<string, unknown>) => f['parentId'] !== null)?.parentId as string;
    if (parentId) {
      const res = await request(appRo).get(`/v2.0/AssetTypes/Folders/${parentId}/Folders`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('GET /v2.0/AssetTypes/Folders/:folderId/Folders returns 400 for malformed folderId', async () => {
    const res = await request(appRo).get('/v2.0/AssetTypes/Folders/not-a-guid/Folders');
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('GET /v2.0/AssetTypes/Folders/:folderId/Folders returns 400 for SQL-injection-style folderId', async () => {
    const res = await request(appRo).get("/v2.0/AssetTypes/Folders/1' OR '1'='1/Folders");
    expect(res.status).toBe(400);
  });

  it('POST /v2.0/AssetTypes/Folders creates folder in readwrite', async () => {
    const res = await request(appRw).post('/v2.0/AssetTypes/Folders').send({ name: 'Test Folder' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Folder');
  });

  it('POST /v2.0/AssetTypes/Folders returns 403 in readonly', async () => {
    const res = await request(appRo).post('/v2.0/AssetTypes/Folders').send({ name: 'Test' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/AssetTypes/Folders/:id updates folder in readwrite', async () => {
    const listRes = await request(appRw).get('/v2.0/AssetTypes/Folders');
    const id = listRes.body.data[0].id;
    const res = await request(appRw).patch(`/v2.0/AssetTypes/Folders/${id}`).send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('DELETE /v2.0/AssetTypes/Folders/:id deletes folder in readwrite', async () => {
    const createRes = await request(appRw).post('/v2.0/AssetTypes/Folders').send({ name: 'To Delete' });
    const id = createRes.body.id;
    const res = await request(appRw).delete(`/v2.0/AssetTypes/Folders/${id}`);
    expect(res.status).toBe(204);
  });

  it('DELETE /v2.0/AssetTypes/Folders/:id returns 404 for unknown id', async () => {
    const res = await request(appRw).delete('/v2.0/AssetTypes/Folders/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});

describe('AssetStock/Folders + Assets (P13.4.11)', () => {
  let appRo: Express;
  let appRw: Express;

  beforeAll(() => {
    appRo = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
    appRw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2);
  });

  it('GET /v2.0/AssetStock/Assets returns list', async () => {
    const res = await request(appRo).get('/v2.0/AssetStock/Assets');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/AssetStock/Folders returns list with correct structure', async () => {
    const res = await request(appRo).get('/v2.0/AssetStock/Folders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('name');
  });

  it('GET /v2.0/AssetStock/Folders/:id returns single folder', async () => {
    const listRes = await request(appRo).get('/v2.0/AssetStock/Folders');
    const id = listRes.body.data[0].id;
    const res = await request(appRo).get(`/v2.0/AssetStock/Folders/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/AssetStock/Folders/:id returns 404 for unknown id', async () => {
    const res = await request(appRo).get('/v2.0/AssetStock/Folders/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/AssetStock/Folders/:folderId/Folders returns children', async () => {
    const listRes = await request(appRo).get('/v2.0/AssetStock/Folders');
    const parentId = listRes.body.data.find((f: Record<string, unknown>) => f['parentId'] !== null)?.parentId as string;
    if (parentId) {
      const res = await request(appRo).get(`/v2.0/AssetStock/Folders/${parentId}/Folders`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    }
  });

  it('POST /v2.0/AssetStock/Folders creates folder in readwrite', async () => {
    const res = await request(appRw).post('/v2.0/AssetStock/Folders').send({ name: 'Stock Folder' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  it('POST /v2.0/AssetStock/Folders returns 403 in readonly', async () => {
    const res = await request(appRo).post('/v2.0/AssetStock/Folders').send({ name: 'Test' });
    expect(res.status).toBe(403);
  });

  it('PATCH /v2.0/AssetStock/Folders/:id updates folder in readwrite', async () => {
    const listRes = await request(appRw).get('/v2.0/AssetStock/Folders');
    const id = listRes.body.data[0].id;
    const res = await request(appRw).patch(`/v2.0/AssetStock/Folders/${id}`).send({ name: 'Updated Stock' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Stock');
  });

  it('DELETE /v2.0/AssetStock/Folders/:id deletes folder in readwrite', async () => {
    const createRes = await request(appRw).post('/v2.0/AssetStock/Folders').send({ name: 'To Delete' });
    const id = createRes.body.id;
    const res = await request(appRw).delete(`/v2.0/AssetStock/Folders/${id}`);
    expect(res.status).toBe(204);
  });
});

describe('Bundle/Folders mutations (P13.4.17)', () => {
  let appRo: Express;
  let appRw: Express;

  beforeAll(() => {
    appRo = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    appRw = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
  });

  it('POST /v2.0/Bundle/Folders creates folder in readwrite', async () => {
    const res = await request(appRw).post('/v2.0/Bundle/Folders').send({ name: 'New Bundle Folder' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('New Bundle Folder');
  });

  it('POST /v2.0/Bundle/Folders returns 403 in readonly', async () => {
    const res = await request(appRo).post('/v2.0/Bundle/Folders').send({ name: 'Test' });
    expect(res.status).toBe(403);
  });

  it('POST /v2.0/Bundle/Folders returns 400 when name is missing', async () => {
    const res = await request(appRw).post('/v2.0/Bundle/Folders').send({});
    expect(res.status).toBe(400);
  });

  it('PATCH /v2.0/Bundle/Folders/:id updates folder in readwrite', async () => {
    const listRes = await request(appRw).get('/v2.0/Bundle/Folders');
    const id = listRes.body.data[0].id;
    const res = await request(appRw).patch(`/v2.0/Bundle/Folders/${id}`).send({ name: 'Renamed Folder' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Folder');
  });

  it('PATCH /v2.0/Bundle/Folders/:id returns 403 in readonly', async () => {
    const listRes = await request(appRw).get('/v2.0/Bundle/Folders');
    const id = listRes.body.data[0].id;
    const res = await request(appRo).patch(`/v2.0/Bundle/Folders/${id}`).send({ name: 'x' });
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/Bundle/Folders/:id deletes folder in readwrite', async () => {
    const createRes = await request(appRw).post('/v2.0/Bundle/Folders').send({ name: 'Deletable' });
    const id = createRes.body.id;
    const res = await request(appRw).delete(`/v2.0/Bundle/Folders/${id}`);
    expect(res.status).toBe(204);
  });

  it('DELETE /v2.0/Bundle/Folders/:id returns 403 in readonly', async () => {
    const res = await request(appRo).delete('/v2.0/Bundle/Folders/f0000001-0001-0001-0001-000000000001');
    expect(res.status).toBe(403);
  });

  it('DELETE /v2.0/Bundle/Folders/:id returns 404 for unknown id', async () => {
    const res = await request(appRw).delete('/v2.0/Bundle/Folders/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
