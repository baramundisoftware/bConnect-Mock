/**
 * P10.5 — Zod body validation tests
 *
 * Verifies that write endpoints (POST/PUT/PATCH) validate request bodies
 * with Zod schemas: required fields, prototype pollution rejection,
 * malformed body types, and type coercion resistance.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('Zod validation — write endpoints (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  // --- Malformed body types ---

  it('POST /v2.0/WindowsEndpoints — rejects array body with 400', async () => {
    // Send a raw JSON array (express.json strict mode rejects arrays as top-level)
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .set('Content-Type', 'application/json')
      .send('[{"displayName":"test"}]');
    // express.json strict mode rejects arrays → body becomes {} → displayName missing → 400
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  // --- Prototype pollution (must use raw JSON strings — JSON.stringify strips __proto__) ---

  it('POST /v2.0/WindowsEndpoints — rejects __proto__ key in raw JSON with 400', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .set('Content-Type', 'application/json')
      .send('{"displayName":"test","__proto__":{"isAdmin":true}}');
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('POST /v2.0/AndroidEndpoints — rejects constructor key in raw JSON with 400', async () => {
    const res = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .set('Content-Type', 'application/json')
      .send('{"displayName":"test","constructor":{"name":"pwned"}}');
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('POST /v2.0/LinuxEndpoints — rejects prototype key in raw JSON with 400', async () => {
    const res = await request(app)
      .post('/v2.0/LinuxEndpoints')
      .set('Content-Type', 'application/json')
      .send('{"displayName":"test","prototype":{"isAdmin":true}}');
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('PATCH /v2.0/AndroidEndpoints/:id — rejects __proto__ in raw JSON patch body with 400', async () => {
    const createRes = await request(app)
      .post('/v2.0/AndroidEndpoints')
      .send({ displayName: 'android-test' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id as string;

    const res = await request(app)
      .patch(`/v2.0/AndroidEndpoints/${id}`)
      .set('Content-Type', 'application/json')
      .send('{"__proto__":{"isAdmin":true}}');
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  // --- Required field validation ---

  it('POST /v2.0/JobInstances — rejects body missing jobDefinitionId with 400', async () => {
    const res = await request(app)
      .post('/v2.0/JobInstances')
      .send({ endpointId: 'some-id' });
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/jobDefinitionId/i);
  });

  it('POST /v2.0/JobInstances — rejects body missing endpointId with 400', async () => {
    const res = await request(app)
      .post('/v2.0/JobInstances')
      .send({ jobDefinitionId: 'some-id' });
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/endpointId/i);
  });

  it('POST /v2.0/Assets — rejects body missing assetTypeId with 400', async () => {
    const res = await request(app)
      .post('/v2.0/Assets')
      .send({ department: 'IT' });
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/assetTypeId/i);
  });

  it('POST /v2.0/Variables — rejects body missing name with 400', async () => {
    const res = await request(app)
      .post('/v2.0/Variables')
      .send({ value: 'something' });
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/name/i);
  });

  it('POST /v2.0/JobDefinitions — rejects body missing name with 400', async () => {
    const res = await request(app)
      .post('/v2.0/JobDefinitions')
      .send({ type: 'Script' });
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/name/i);
  });

  it('POST /v2.0/LogicalGroups — rejects body missing name with 400', async () => {
    const res = await request(app)
      .post('/v2.0/LogicalGroups')
      .send({ comment: 'test' });
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/\bname\b/);
  });

  // --- Type coercion resistance ---

  it('POST /v2.0/WindowsEndpoints — rejects displayName as number with 400', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({ displayName: 12345 });
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('POST /v2.0/WindowsEndpoints — rejects displayName as boolean with 400', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({ displayName: true });
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  it('POST /v2.0/WindowsEndpoints — rejects empty displayName string with 400', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({ displayName: '' });
    expect(res.status).toBe(400);
    expect(res.headers).toHaveProperty('x-bconnect-mock-reason');
  });

  // --- Valid payloads still work ---

  it('POST /v2.0/WindowsEndpoints — accepts valid body with extra fields', async () => {
    const res = await request(app)
      .post('/v2.0/WindowsEndpoints')
      .send({
        displayName: 'WIN-VALID-001',
        operatingSystem: 'Windows 11',
        department: 'IT',
        customTag: 'test',
      });
    expect(res.status).toBe(201);
    expect(res.body.displayName).toBe('WIN-VALID-001');
  });

  it('PATCH /v2.0/MacEndpoints/:id — accepts partial body (just operatingSystem)', async () => {
    const createRes = await request(app)
      .post('/v2.0/MacEndpoints')
      .send({ displayName: 'MAC-PATCH-TEST' });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id as string;

    const res = await request(app)
      .patch(`/v2.0/MacEndpoints/${id}`)
      .send({ operatingSystem: 'macOS 15' });
    expect(res.status).toBe(200);
  });
});
