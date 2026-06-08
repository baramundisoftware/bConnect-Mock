/**
 * P9.13 — Integration tests: Compliance routes
 *
 * Verify:
 * - Compliance routes return data in 26R1 mode
 * - Compliance routes return HTTP 404 in 25R2 mode (routes not registered)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { BmsVersion, ProfileMode } from '../../../src/profiles/ProfileManager';

describe('Compliance API (26R1 routes)', () => {
  let app26r1: Express;
  let app25r2: Express;

  beforeAll(() => {
    app26r1 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    app25r2 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  });

  // --- Rules ---

  describe('GET /v2.0/Rules', () => {
    it('should return 200 with rules array in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/Rules')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.totalItems).toBeGreaterThan(0);
    });

    it('should return rule objects with required fields in 26R1 mode', async () => {
      const response = await request(app26r1).get('/v2.0/Rules').expect(200);
      const rule = response.body.data[0];
      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('ruleName');
      expect(rule).toHaveProperty('type');
      expect(rule).toHaveProperty('severity');
    });

    it('should support SearchQuery filtering in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/Rules?SearchQuery=Password')
        .expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].ruleName).toContain('Password');
    });

    it('should support pagination in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/Rules?PageSize=2&Page=0')
        .expect(200);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pageSize).toBe(2);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/Rules').expect(404);
    });
  });

  describe('GET /v2.0/Rules/:id', () => {
    it('should return a rule by ID in 26R1 mode', async () => {
      const listResponse = await request(app26r1).get('/v2.0/Rules').expect(200);
      const id = listResponse.body.data[0].id;
      const response = await request(app26r1).get(`/v2.0/Rules/${id}`).expect(200);
      expect(response.body.id).toBe(id);
      expect(response.body).toHaveProperty('ruleName');
    });

    it('should return 404 for unknown rule ID in 26R1 mode', async () => {
      await request(app26r1).get('/v2.0/Rules/non-existent-id').expect(404);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/Rules/some-id').expect(404);
    });
  });

  // --- Vulnerabilities ---

  describe('GET /v2.0/Vulnerabilities', () => {
    it('should return 200 with vulnerabilities in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/Vulnerabilities')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return vulnerability objects with required fields in 26R1 mode', async () => {
      const response = await request(app26r1).get('/v2.0/Vulnerabilities').expect(200);
      const vuln = response.body.data[0];
      expect(vuln).toHaveProperty('id');
      expect(vuln).toHaveProperty('cveId');
      expect(vuln).toHaveProperty('cvssScore');
      expect(vuln).toHaveProperty('severity');
    });

    it('should support SearchQuery filtering by cveId in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/Vulnerabilities?SearchQuery=CVE-2024')
        .expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/Vulnerabilities').expect(404);
    });
  });

  describe('GET /v2.0/Vulnerabilities/:id', () => {
    it('should return a vulnerability by ID in 26R1 mode', async () => {
      const listResponse = await request(app26r1).get('/v2.0/Vulnerabilities').expect(200);
      const id = listResponse.body.data[0].id;
      const response = await request(app26r1).get(`/v2.0/Vulnerabilities/${id}`).expect(200);
      expect(response.body.id).toBe(id);
      expect(response.body).toHaveProperty('cveId');
    });

    it('should return 404 for unknown vulnerability ID in 26R1 mode', async () => {
      await request(app26r1).get('/v2.0/Vulnerabilities/non-existent-id').expect(404);
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/Vulnerabilities/some-id').expect(404);
    });
  });

  // --- DetectedVulnerabilities ---

  describe('GET /v2.0/DetectedVulnerabilities', () => {
    it('should return 200 with detected vulnerabilities in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/DetectedVulnerabilities')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return detected vulnerability objects with required fields', async () => {
      const response = await request(app26r1).get('/v2.0/DetectedVulnerabilities').expect(200);
      const item = response.body.data[0];
      expect(item).toHaveProperty('endpointName');
      expect(item).toHaveProperty('cveId');
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/DetectedVulnerabilities').expect(404);
    });
  });

  // --- DetectedRuleViolations ---

  describe('GET /v2.0/DetectedRuleViolations', () => {
    it('should return 200 with rule violations in 26R1 mode', async () => {
      const response = await request(app26r1)
        .get('/v2.0/DetectedRuleViolations')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should return rule violation objects with required fields', async () => {
      const response = await request(app26r1).get('/v2.0/DetectedRuleViolations').expect(200);
      const item = response.body.data[0];
      expect(item).toHaveProperty('endpointName');
      expect(item).toHaveProperty('ruleName');
    });

    it('should return 404 in 25R2 mode', async () => {
      await request(app25r2).get('/v2.0/DetectedRuleViolations').expect(404);
    });
  });
});
