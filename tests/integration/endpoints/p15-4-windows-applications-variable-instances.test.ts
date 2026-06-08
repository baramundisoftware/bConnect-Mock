/**
 * P15.4 — GET /v2.0/WindowsApplications/{id}/VariableInstances
 *
 * REQ-21.3.1: Route must be reachable for all profiles; returns paginated list
 * with proper 404 for unknown parent and 400 for invalid GUID.
 *
 * Known fixture IDs (from fixtures/<profile>/windowsApplications.json):
 *   standard-readonly / standard-readwrite (fallback): wa000001-0001-0001-0001-000000000001
 *   minimal-readonly:                                   wa000001-0001-0001-0001-000000000001
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

const KNOWN_APP_ID = 'ca000001-0001-0001-0001-000000000001';
const UNKNOWN_GUID = '00000000-0000-0000-0000-000000000099';
const BAD_ID = 'not-a-guid';

async function assertSubResource(app: Express, appId: string): Promise<void> {
  const res = await request(app)
    .get(`/v2.0/WindowsApplications/${appId}/VariableInstances`)
    .expect(200);
  expect(res.body).toHaveProperty('data');
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body).toHaveProperty('totalItems');
}

describe('GET /v2.0/WindowsApplications/{id}/VariableInstances (P15.4)', () => {
  describe('standard-readonly profile', () => {
    let app: Express;

    beforeAll(() => {
      app = createApp(ProfileMode.STANDARD_READONLY);
    });

    it('returns 200 with paginated list for a known WindowsApplication', async () => {
      await assertSubResource(app, KNOWN_APP_ID);
    });

    it('returns linked VariableInstances when windowsApplicationId matches', async () => {
      const res = await request(app)
        .get(`/v2.0/WindowsApplications/${KNOWN_APP_ID}/VariableInstances`)
        .expect(200);
      // All returned items must reference the correct parent
      for (const item of res.body.data) {
        expect(item.windowsApplicationId).toBe(KNOWN_APP_ID);
      }
    });

    it('returns 404 for an unknown WindowsApplication GUID', async () => {
      await request(app)
        .get(`/v2.0/WindowsApplications/${UNKNOWN_GUID}/VariableInstances`)
        .expect(404);
    });

    it('returns 400 for an invalid (non-GUID) parent id', async () => {
      await request(app)
        .get(`/v2.0/WindowsApplications/${BAD_ID}/VariableInstances`)
        .expect(400);
    });
  });

  describe('minimal-readonly profile', () => {
    let app: Express;

    beforeAll(() => {
      app = createApp(ProfileMode.MINIMAL_READONLY);
    });

    it('returns 200 with paginated list', async () => {
      await assertSubResource(app, KNOWN_APP_ID);
    });

    it('returns 404 for unknown parent', async () => {
      await request(app)
        .get(`/v2.0/WindowsApplications/${UNKNOWN_GUID}/VariableInstances`)
        .expect(404);
    });

    it('returns 400 for invalid parent id', async () => {
      await request(app)
        .get(`/v2.0/WindowsApplications/${BAD_ID}/VariableInstances`)
        .expect(400);
    });
  });

  describe('standard-readwrite profile (falls back to standard-readonly fixtures)', () => {
    let app: Express;

    beforeAll(() => {
      app = createApp(ProfileMode.STANDARD_READWRITE);
    });

    it('returns 200 with paginated list', async () => {
      await assertSubResource(app, KNOWN_APP_ID);
    });

    it('returns 404 for unknown parent', async () => {
      await request(app)
        .get(`/v2.0/WindowsApplications/${UNKNOWN_GUID}/VariableInstances`)
        .expect(404);
    });

    it('returns 400 for invalid parent id', async () => {
      await request(app)
        .get(`/v2.0/WindowsApplications/${BAD_ID}/VariableInstances`)
        .expect(400);
    });
  });
});
