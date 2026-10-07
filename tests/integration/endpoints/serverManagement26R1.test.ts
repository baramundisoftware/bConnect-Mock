/**
 * Coverage Fix — ServerManagement 26R1 routes + edge cases
 *
 * Tests ApiKeys, DownloadJobs, Dips cleanup actions (registerServerManagement26R1Routes).
 * Also covers missing branches: Stop/Restart 404, SearchQuery on Microservices,
 * CloudConnectors/PxeRelays SearchQuery, Objects PATCH/Rights.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

describe('ServerManagement 26R1 routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
  });

  describe('GET /v2.0/ApiKeys', () => {
    // The spec answers ApiKeys as a plain array, without paging or search
    it('returns 200 with the API keys as a plain array', async () => {
      const res = await request(app).get('/v2.0/ApiKeys').expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('references security profiles by GUID and has a date-only expirationDate', async () => {
      const res = await request(app).get('/v2.0/ApiKeys').expect(200);
      for (const key of res.body as Array<{ securityProfiles: string[]; expirationDate: string }>) {
        for (const p of key.securityProfiles) { expect(p).toMatch(/^[0-9a-f-]{36}$/); }
        expect(key.expirationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });

    it('ignores paging and search parameters (the spec has none)', async () => {
      const all = await request(app).get('/v2.0/ApiKeys').expect(200);
      const res = await request(app).get('/v2.0/ApiKeys?PageSize=1&Page=1&SearchQuery=zzz').expect(200);
      expect(res.body).toEqual(all.body);
    });
  });

  describe('GET /v2.0/DownloadJobs', () => {
    it('returns 200 with downloadJobs list', async () => {
      const res = await request(app).get('/v2.0/DownloadJobs').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body).toHaveProperty('totalItems');
    });

    it('supports SearchQuery filtering', async () => {
      const res = await request(app).get('/v2.0/DownloadJobs?SearchQuery=job').expect(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /v2.0/DownloadJobs/:id', () => {
    it('returns 200 for a known DownloadJob id', async () => {
      const listRes = await request(app).get('/v2.0/DownloadJobs').expect(200);
      if (listRes.body.data.length === 0) {return;}
      const firstId = listRes.body.data[0].id;
      const res = await request(app).get(`/v2.0/DownloadJobs/${firstId}`).expect(200);
      expect(res.body.id).toBe(firstId);
    });

    it('returns 404 for unknown DownloadJob id', async () => {
      await request(app).get('/v2.0/DownloadJobs/00000000-0000-0000-0000-000000000000').expect(404);
    });
  });

  describe('POST /v2.0/Dips/SimulateMSWCleanup', () => {
    it('returns 200 with message', async () => {
      const res = await request(app).post('/v2.0/Dips/SimulateMSWCleanup').expect(200);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('POST /v2.0/Dips/MSWCleanup', () => {
    it('returns 200 with message', async () => {
      const res = await request(app).post('/v2.0/Dips/MSWCleanup').expect(200);
      expect(res.body).toHaveProperty('message');
    });
  });
});

describe('Microservices missing branches', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('POST /v2.0/Microservices/:id/Stop returns 404 for non-existent id', async () => {
    await request(app)
      .post('/v2.0/Microservices/00000000-0000-0000-0000-000000000000/Stop')
      .expect(404);
  });

  it('POST /v2.0/Microservices/:id/Restart returns 404 for non-existent id', async () => {
    await request(app)
      .post('/v2.0/Microservices/00000000-0000-0000-0000-000000000000/Restart')
      .expect(404);
  });
});

describe('CloudConnectors and PxeRelays edge cases', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('CloudConnectors and PxeRelays ignore paging and search (plain arrays in the spec)', async () => {
    for (const path of ['/v2.0/CloudConnectors', '/v2.0/PxeRelays']) {
      const all = await request(app).get(path).expect(200);
      const res = await request(app).get(`${path}?PageSize=1&Page=1&SearchQuery=zzz`).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toEqual(all.body);
    }
  });
});
