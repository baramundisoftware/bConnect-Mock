/**
 * P9.14 — Integration tests: UniversalDynamicGroups routes
 *
 * Verify:
 * - UniversalDynamicGroups routes return data in 26R1 mode
 * - UniversalDynamicGroups routes return HTTP 404 in 25R2 mode
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { BmsVersion, ProfileMode } from '../../../src/profiles/ProfileManager';

describe('UniversalDynamicGroups API (26R1 routes)', () => {
  let app26r1: Express;
  let app25r2: Express;

  beforeAll(() => {
    app26r1 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    app25r2 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  });

  // --- UniversalDynamicGroups ---

  describe('GET /v2.0/UniversalDynamicGroups', () => {
    it('should return 200 with groups array in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/UniversalDynamicGroups')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.totalItems).toBeGreaterThan(0);
    });

    it('should return group objects with required fields in 26R1 mode', async () => {
      const response = await request(app26r1).get('/v2.0/UniversalDynamicGroups').expect(200);
      const group = response.body.data[0];
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('folderName');
      expect(group).toHaveProperty('folderId');
    });

    it('should support SearchQuery filtering by name in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/UniversalDynamicGroups?SearchQuery=Windows')
        .expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      const names = response.body.data.map((g: Record<string, unknown>) => g['name'] as string);
      expect(names.some((n) => n.includes('Windows'))).toBe(true);
    });

    it('should support pagination in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/UniversalDynamicGroups?PageSize=2&Page=0')
        .expect(200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pageSize).toBe(2);
      expect(response.body.page).toBe(0);
    });

    it('should support OrderBy sorting in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/UniversalDynamicGroups?OrderBy=name asc')
        .expect(200);
      const names = response.body.data.map((g: Record<string, unknown>) => g['name'] as string);
      const sorted = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/UniversalDynamicGroups').expect(404);
    });
  });

  describe('GET /v2.0/UniversalDynamicGroups/:id', () => {
    it('should return a group by ID in 26R1 mode', async () => {
      const listResponse = await request(app26r1).get('/v2.0/UniversalDynamicGroups').expect(200);
      const id = listResponse.body.data[0].id;
      const response = await request(app26r1)
        .get(`/v2.0/UniversalDynamicGroups/${id}`)
        .expect(200);
      expect(response.body.id).toBe(id);
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for unknown group ID in 26R1 mode', async () => {
      await request(app26r1).get('/v2.0/UniversalDynamicGroups/non-existent-id').expect(404);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/UniversalDynamicGroups/some-id').expect(404);
    });
  });

  // --- UniversalDynamicGroupsFolder ---

  describe('GET /v2.0/UniversalDynamicGroupsFolder', () => {
    it('should return 200 with folders array in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/UniversalDynamicGroupsFolder')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return folder objects with required fields in 26R1 mode', async () => {
      const response = await request(app26r1).get('/v2.0/UniversalDynamicGroupsFolder').expect(200);
      const folder = response.body.data[0];
      expect(folder).toHaveProperty('id');
      expect(folder).toHaveProperty('name');
    });

    it('should support SearchQuery filtering in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/UniversalDynamicGroupsFolder?SearchQuery=Security')
        .expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/UniversalDynamicGroupsFolder').expect(404);
    });
  });

  describe('GET /v2.0/UniversalDynamicGroupsFolder/:id', () => {
    it('should return a folder by ID in 26R1 mode', async () => {
      const listResponse = await request(app26r1)
        .get('/v2.0/UniversalDynamicGroupsFolder')
        .expect(200);
      const id = listResponse.body.data[0].id;
      const response = await request(app26r1)
        .get(`/v2.0/UniversalDynamicGroupsFolder/${id}`)
        .expect(200);
      expect(response.body.id).toBe(id);
      expect(response.body).toHaveProperty('name');
    });

    it('should return 404 for unknown folder ID in 26R1 mode', async () => {
      await request(app26r1)
        .get('/v2.0/UniversalDynamicGroupsFolder/non-existent-id')
        .expect(404);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/UniversalDynamicGroupsFolder/some-id').expect(404);
    });
  });
});
