/**
 * Sprint 13.2.9 — ADUsers sub-resource route integration tests.
 *
 * Covers: ADUsers/{id}/[Windows|Android|Ios|Linux|Mac]Endpoints + /Endpoints
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';

const UNKNOWN_GUID = '00000000-0000-0000-0000-000000000099';
const BAD_ID = 'not-a-guid';

describe('ADUsers sub-resource routes (P13.2.9)', () => {
  let app: Express;
  let adUserId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/v2.0/ADUsers');
    adUserId = res.body.data[0].id;
  });

  const endpointTypes = ['WindowsEndpoints', 'AndroidEndpoints', 'IosEndpoints', 'LinuxEndpoints', 'MacEndpoints', 'Endpoints'];

  for (const ep of endpointTypes) {
    describe(`GET /v2.0/ADUsers/:id/${ep}`, () => {
      it('returns 200 with data array for known ADUser', async () => {
        const res = await request(app)
          .get(`/v2.0/ADUsers/${adUserId}/${ep}`)
          .expect(200);
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
        expect(res.body).toHaveProperty('totalItems');
      });

      it('returns 404 for unknown parent ADUser id', async () => {
        await request(app)
          .get(`/v2.0/ADUsers/${UNKNOWN_GUID}/${ep}`)
          .expect(404);
      });

      it('returns 400 for bad GUID format', async () => {
        await request(app)
          .get(`/v2.0/ADUsers/${BAD_ID}/${ep}`)
          .expect(400);
      });

      it('filters results to only those belonging to the ADUser', async () => {
        const res = await request(app)
          .get(`/v2.0/ADUsers/${adUserId}/${ep}`)
          .expect(200);
        for (const item of res.body.data as Record<string, unknown>[]) {
          expect(item['adUserId']).toBe(adUserId);
        }
      });
    });
  }

  it('each ADUser has at least some endpoints across all types', async () => {
    const totals: number[] = [];
    for (const ep of endpointTypes.filter(e => e !== 'Endpoints')) {
      const res = await request(app).get(`/v2.0/ADUsers/${adUserId}/${ep}`);
      totals.push(res.body.totalItems as number);
    }
    // At least one endpoint type has data for the first user
    expect(totals.some(t => t > 0)).toBe(true);
  });

  it('supports pagination via PageSize', async () => {
    // Use WindowsEndpoints which has the most fixtures
    const res = await request(app)
      .get(`/v2.0/ADUsers/${adUserId}/WindowsEndpoints?PageSize=1&Page=1`)
      .expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });
});
