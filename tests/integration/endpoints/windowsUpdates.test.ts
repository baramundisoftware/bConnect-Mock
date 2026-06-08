import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KB_REGEX = /^KB\d{7}$/;

const VALID_CLASSIFICATIONS = new Set([
  'Security Updates', 'Critical Updates', 'Definition Updates',
  'Feature Packs', 'Service Packs', 'Update Rollups', 'Updates', 'Drivers',
]);

const CVE_FIELDS = ['cveId', 'cvssScore', 'affectedProducts', 'requiredBy', 'cve'];

describe('GET /v2.0/WindowsUpdates', () => {
  let minApp: Express;
  let stdRoApp: Express;
  let stdRwApp: Express;

  beforeAll(() => {
    minApp = createApp(ProfileMode.MINIMAL_READONLY);
    stdRoApp = createApp(ProfileMode.STANDARD_READONLY);
    stdRwApp = createApp(ProfileMode.STANDARD_READWRITE);
  });

  describe('Windows Update schema validation (REQ-22.1.1)', () => {
    it.each([
      ['minimal-readonly', () => minApp, 1],
      ['standard-readonly', () => stdRoApp, 10],
      ['standard-readwrite', () => stdRwApp, 10],
    ])('%s — returns correct Windows Update fields', async (_name, getApp, expectedCount) => {
      const response = await request(getApp())
        .get('/v2.0/WindowsUpdates')
        .expect(200);

      expect(response.body.data).toHaveLength(expectedCount);

      for (const update of response.body.data) {
        // Required fields present
        expect(update).toHaveProperty('id');
        expect(update).toHaveProperty('title');
        expect(update).toHaveProperty('kbArticle');
        expect(update).toHaveProperty('classification');
        expect(update).toHaveProperty('severity');
        expect(update).toHaveProperty('installed');
        expect(update).toHaveProperty('endpointId');
        expect(update).toHaveProperty('releaseDate');
        expect(update).toHaveProperty('downloadSize');
        expect(update).toHaveProperty('description');

        // No CVE fields (REQ-22.1.2)
        for (const field of CVE_FIELDS) {
          expect(update).not.toHaveProperty(field);
        }

        // Field format validations
        expect(update.id).toMatch(GUID_REGEX);
        expect(update.kbArticle).toMatch(KB_REGEX);
        expect(VALID_CLASSIFICATIONS.has(update.classification)).toBe(true);
        expect(update.endpointId).toMatch(GUID_REGEX);
        expect(update.title).not.toMatch(/vulnerability/i);
      }
    });
  });

  describe('installDate conditional logic (REQ-22.1.7)', () => {
    it('installDate is set only when installed is true', async () => {
      const response = await request(stdRoApp)
        .get('/v2.0/WindowsUpdates')
        .expect(200);

      for (const update of response.body.data) {
        if (update.installed) {
          expect(update.installDate).toBeTruthy();
          expect(update.installDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        } else {
          expect(update.installDate).toBeNull();
        }
      }
    });
  });

  describe('pagination (REQ-22.5.3)', () => {
    it('returns pagination metadata', async () => {
      const response = await request(minApp)
        .get('/v2.0/WindowsUpdates')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pageSize');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('totalItems');
      expect(response.body.totalItems).toBe(1);
    });

    it('respects PageSize and Page', async () => {
      const response = await request(stdRoApp)
        .get('/v2.0/WindowsUpdates?PageSize=3&Page=0')
        .expect(200);

      expect(response.body.pageSize).toBe(3);
      expect(response.body.page).toBe(0);
      expect(response.body.data).toHaveLength(3);
      expect(response.body.totalItems).toBe(10);
    });
  });

  describe('SearchQuery filtering', () => {
    it('filters by KB article', async () => {
      const all = await request(stdRoApp).get('/v2.0/WindowsUpdates').expect(200);
      const kb = all.body.data[0].kbArticle;

      const response = await request(stdRoApp)
        .get(`/v2.0/WindowsUpdates?SearchQuery=${kb}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].kbArticle).toBe(kb);
    });

    it('returns empty for non-matching query', async () => {
      const response = await request(stdRoApp)
        .get('/v2.0/WindowsUpdates?SearchQuery=ZZZZZ_NONEXISTENT')
        .expect(200);

      expect(response.body.data).toHaveLength(0);
    });
  });

  describe('read-only guard', () => {
    it('returns 403 for POST on readonly profile', async () => {
      const response = await request(minApp)
        .post('/v2.0/WindowsUpdates')
        .send({ title: 'Test' })
        .expect('Content-Type', /json/)
        .expect(403);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('deterministic responses', () => {
    it('returns same data on consecutive requests', async () => {
      const r1 = await request(minApp).get('/v2.0/WindowsUpdates');
      const r2 = await request(minApp).get('/v2.0/WindowsUpdates');
      expect(r1.body).toEqual(r2.body);
    });
  });
});
