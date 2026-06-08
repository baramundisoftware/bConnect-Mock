/**
 * P15.5 — GET /v2.0/WindowsJobDefinitions/{id}/VariableInstances
 *
 * REQ-21.3.2: Route must be reachable for all profiles; returns paginated list
 * with proper 404 for unknown parent and 400 for invalid GUID.
 *
 * Known fixture IDs (from fixtures/<profile>/windowsJobDefinitions.json):
 *   standard-readonly / standard-readwrite (fallback): def00001-0001-0001-0001-000000000001
 *   minimal-readonly:                                   def00001-0001-0001-0001-000000000001
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

const KNOWN_JD_ID = 'def00001-0001-0001-0001-000000000001';
const UNKNOWN_GUID = '00000000-0000-0000-0000-000000000099';
const BAD_ID = 'not-a-guid';

async function assertSubResource(app: Express, jdId: string): Promise<void> {
  const res = await request(app)
    .get(`/v2.0/WindowsJobDefinitions/${jdId}/VariableInstances`)
    .expect(200);
  expect(res.body).toHaveProperty('data');
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body).toHaveProperty('totalItems');
}

describe('GET /v2.0/WindowsJobDefinitions/{id}/VariableInstances (P15.5)', () => {
  describe('standard-readonly profile', () => {
    let app: Express;

    beforeAll(() => {
      app = createApp(ProfileMode.STANDARD_READONLY);
    });

    it('returns 200 with paginated list for a known WindowsJobDefinition', async () => {
      await assertSubResource(app, KNOWN_JD_ID);
    });

    it('returns linked VariableInstances when windowsJobDefinitionId matches', async () => {
      const res = await request(app)
        .get(`/v2.0/WindowsJobDefinitions/${KNOWN_JD_ID}/VariableInstances`)
        .expect(200);
      for (const item of res.body.data) {
        expect(item.windowsJobDefinitionId).toBe(KNOWN_JD_ID);
      }
    });

    it('returns 404 for an unknown WindowsJobDefinition GUID', async () => {
      await request(app)
        .get(`/v2.0/WindowsJobDefinitions/${UNKNOWN_GUID}/VariableInstances`)
        .expect(404);
    });

    it('returns 400 for an invalid (non-GUID) parent id', async () => {
      await request(app)
        .get(`/v2.0/WindowsJobDefinitions/${BAD_ID}/VariableInstances`)
        .expect(400);
    });
  });

  describe('minimal-readonly profile', () => {
    let app: Express;

    beforeAll(() => {
      app = createApp(ProfileMode.MINIMAL_READONLY);
    });

    it('returns 200 with paginated list', async () => {
      await assertSubResource(app, KNOWN_JD_ID);
    });

    it('returns 404 for unknown parent', async () => {
      await request(app)
        .get(`/v2.0/WindowsJobDefinitions/${UNKNOWN_GUID}/VariableInstances`)
        .expect(404);
    });

    it('returns 400 for invalid parent id', async () => {
      await request(app)
        .get(`/v2.0/WindowsJobDefinitions/${BAD_ID}/VariableInstances`)
        .expect(400);
    });
  });

  describe('standard-readwrite profile (falls back to standard-readonly fixtures)', () => {
    let app: Express;

    beforeAll(() => {
      app = createApp(ProfileMode.STANDARD_READWRITE);
    });

    it('returns 200 with paginated list', async () => {
      await assertSubResource(app, KNOWN_JD_ID);
    });

    it('returns 404 for unknown parent', async () => {
      await request(app)
        .get(`/v2.0/WindowsJobDefinitions/${UNKNOWN_GUID}/VariableInstances`)
        .expect(404);
    });

    it('returns 400 for invalid parent id', async () => {
      await request(app)
        .get(`/v2.0/WindowsJobDefinitions/${BAD_ID}/VariableInstances`)
        .expect(400);
    });
  });
});
