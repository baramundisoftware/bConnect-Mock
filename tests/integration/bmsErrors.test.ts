/**
 * Error answers in the shape a live bMS sends (26R1, read-only probe on 2026-10-07):
 * problem details, a 400 validation shape with errors per field, no WWW-Authenticate on 401.
 * The mock's own message travels in the X-BConnect-Mock-Reason header.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { notFoundTitle, bodyParameterName, bodyErrors } from '../../src/middleware/bmsErrors';
import type { Express } from 'express';

const REASON = 'x-bconnect-mock-reason';
const TRACE_ID = /^00-[0-9a-f]{32}-[0-9a-f]{16}-00$/;
const UNKNOWN = '00000000-0000-0000-0000-000000000000';
const VALIDATION = { type: 'https://httpstatuses.io/400', title: 'One or more validation errors occurred.', status: 400 };

function strictApp(mode: ProfileMode): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, BmsVersion.BMS_26R1); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

function json(res: request.Response): Record<string, unknown> {
  return JSON.parse(res.text) as Record<string, unknown>;
}

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('helpers', () => {
  it('names the last GUID of the path in the 404 title', () => {
    expect(notFoundTitle(`/v2.0/LogicalGroups/${UNKNOWN}/Endpoints`))
      .toBe(`Object [${UNKNOWN}] not found or not visible due to missing rights.`);
    expect(notFoundTitle('/v2.0/ManagementServer')).toBe('Not Found');
  });

  it('derives the body parameter from the schema, as the bMS action does', () => {
    expect(bodyParameterName('LogicalGroupForCreation')).toBe('logicalGroup');
    expect(bodyParameterName('MaintenanceWindowForUpdate')).toBe('maintenanceWindow');
    expect(bodyErrors('x', 'JsonPatchDocument')).toEqual({ $: ['x'] });
  });
});

describe('error answers (strict, read-write)', () => {
  let app: Express;
  beforeAll(() => { app = strictApp(ProfileMode.STANDARD_READWRITE); });

  it('unknown ID: 404 problem details naming the ID', async () => {
    const res = await request(app).get(`/bconnect/jobs/v2.0/JobDefinitions/${UNKNOWN}`);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const body = json(res);
    expect(body).toMatchObject({
      type: 'https://httpstatuses.io/404',
      title: `Object [${UNKNOWN}] not found or not visible due to missing rights.`,
      status: 404,
    });
    expect(body['traceId']).toMatch(TRACE_ID);
    expect(Object.keys(body).sort()).toEqual(['status', 'title', 'traceId', 'type']);
    expect(res.headers[REASON]).toMatch(/not found/i);
  });

  it('ID that is not a GUID: 400 with the spec\'s parameter name', async () => {
    const res = await request(app).get('/bconnect/jobs/v2.0/JobDefinitions/not-a-guid');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(json(res)).toMatchObject({ ...VALIDATION, errors: { id: ["The value 'not-a-guid' is not valid."] } });
    expect(json(res)['traceId']).toMatch(TRACE_ID);
  });

  it('uses the parameter name of a sub-resource route', async () => {
    const res = await request(app).get('/bconnect/endpoints/v2.0/LogicalGroups/bad/WindowsEndpoints');
    expect(res.status).toBe(400);
    expect(json(res)['errors']).toEqual({ logicalGroupId: ["The value 'bad' is not valid."] });
  });

  it('invalid JSON: 400, not 500, with the body parameter as required', async () => {
    const res = await request(app).post('/bconnect/endpoints/v2.0/LogicalGroups')
      .set('Content-Type', 'application/json').send('{');
    expect(res.status).toBe(400);
    const body = json(res);
    expect(body).toMatchObject(VALIDATION);
    const errors = body['errors'] as Record<string, string[]>;
    expect(errors['$']?.[0]).toEqual(expect.any(String));
    expect(errors['logicalGroup']).toEqual(['The logicalGroup field is required.']);
    expect(res.headers[REASON]).toMatch(/invalid JSON body/);
  });

  it('required field missing: 400 naming the type and the field', async () => {
    const res = await request(app).post('/bconnect/endpoints/v2.0/LogicalGroups').send({});
    expect(res.status).toBe(400);
    expect(json(res)['errors']).toEqual({
      $: ["JSON deserialization for type 'LogicalGroupForCreation' was missing required properties including: 'name'."],
      logicalGroup: ['The logicalGroup field is required.'],
    });
    expect(res.headers[REASON]).toBe('Missing required field: name');
  });

  it('a wrong method stays a 405 problem', async () => {
    const res = await request(app).post('/bconnect/jobs/v2.0/JobDefinitions').send({});
    expect(res.status).toBe(405);
    expect(json(res)).toMatchObject({ type: 'https://httpstatuses.io/405', title: 'Method Not Allowed', status: 405 });
  });
});

describe('error answers (strict, read-only)', () => {
  it('a write in a read-only profile: 403 problem details', async () => {
    const app = strictApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).post('/bconnect/endpoints/v2.0/LogicalGroups').send({ name: 'x' });
    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(json(res)).toMatchObject({ type: 'https://httpstatuses.io/403', title: 'Forbidden', status: 403 });
    expect(res.headers[REASON]).toMatch(/read-only/);
  });
});

describe('401 without login', () => {
  afterEach(() => { delete process.env.REQUIRE_BASIC_AUTH; });

  it('is problem details without a WWW-Authenticate header', async () => {
    process.env.REQUIRE_BASIC_AUTH = 'probe:secret';
    const app = strictApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/bconnect/jobs/v2.0/JobDefinitions');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(json(res)).toMatchObject({ type: 'https://httpstatuses.io/401', title: 'Unauthorized', status: 401 });
    expect(res.headers['www-authenticate']).toBeUndefined();
    const ok = await request(app).get('/bconnect/jobs/v2.0/JobDefinitions').auth('probe', 'secret');
    expect(ok.status).toBe(200);
  });
});

describe('lenient routing', () => {
  it('converts handler errors too, with "id" for an invalid ID', async () => {
    const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); // suite default: lenient
    const res = await request(app).get('/v2.0/WindowsEndpoints/not-a-guid');
    expect(res.status).toBe(400);
    expect(json(res)['errors']).toEqual({ id: ["The value 'not-a-guid' is not valid."] });
    const missing = await request(app).get(`/v2.0/WindowsEndpoints/${UNKNOWN}`);
    expect(missing.status).toBe(404);
    expect(json(missing)['title']).toBe(`Object [${UNKNOWN}] not found or not visible due to missing rights.`);
  });
});
