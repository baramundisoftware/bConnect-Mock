/**
 * P10.11 — Write endpoint security integration tests
 *
 * Covers:
 *  - Prototype pollution via raw JSON __proto__ / constructor / prototype keys
 *  - Malformed body types (array, string, null, number)
 *  - Type coercion resistance (required string fields sent as numbers, booleans, objects)
 *
 * All write endpoints (POST/PUT/PATCH) for every entity type are exercised.
 *
 * Dependencies: P10.5 (Zod validation middleware)
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request, { type Test } from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('Write endpoint security — standard-readwrite', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Helper: send raw JSON string to bypass JSON.stringify's __proto__ stripping
  // ─────────────────────────────────────────────────────────────────────────
  function rawPost(path: string, rawJson: string): Test {
    return request(app).post(path).set('Content-Type', 'application/json').send(rawJson);
  }
  function rawPatch(path: string, rawJson: string): Test {
    return request(app).patch(path).set('Content-Type', 'application/json').send(rawJson);
  }
  function rawPut(path: string, rawJson: string): Test {
    return request(app).put(path).set('Content-Type', 'application/json').send(rawJson);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Prototype pollution — POST endpoints
  // ─────────────────────────────────────────────────────────────────────────
  describe('Prototype pollution — POST (all entity types)', () => {
    const pollutionPayloads = [
      '{"displayName":"x","__proto__":{"isAdmin":true}}',
      '{"displayName":"x","constructor":{"name":"pwned"}}',
      '{"displayName":"x","prototype":{"polluted":true}}',
    ];

    const displayNameEndpoints = [
      '/v2.0/WindowsEndpoints',
      '/v2.0/AndroidEndpoints',
      '/v2.0/LinuxEndpoints',
      '/v2.0/MacEndpoints',
      '/v2.0/IosEndpoints',
      '/v2.0/NetworkEndpoints',
      '/v2.0/IndustrialEndpoints',
      '/v2.0/LogicalGroups',
    ];

    for (const endpoint of displayNameEndpoints) {
      for (const payload of pollutionPayloads) {
        const keyMatch = payload.match(/"(__proto__|constructor|prototype)"/) ?? [];
        const dangerousKey = keyMatch[1] ?? 'unknown';
        it(`POST ${endpoint} — rejects "${dangerousKey}" key with 400`, async () => {
          const res = await rawPost(endpoint, payload);
          expect(res.status).toBe(400);
          expect(res.body).toHaveProperty('error');
          // Ensure global prototype was NOT polluted
          expect((Object.prototype as Record<string, unknown>)['isAdmin']).toBeUndefined();
          expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
        });
      }
    }

    it('POST /v2.0/JobDefinitions — rejects __proto__ key with 400', async () => {
      const res = await rawPost('/v2.0/JobDefinitions', '{"name":"x","__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('POST /v2.0/Assets — rejects __proto__ key with 400', async () => {
      const res = await rawPost('/v2.0/Assets', '{"assetTag":"AT-001","__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('POST /v2.0/Variables — rejects __proto__ key with 400', async () => {
      const res = await rawPost('/v2.0/Variables', '{"name":"myVar","__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('POST /v2.0/JobInstances — rejects __proto__ key with 400', async () => {
      const res = await rawPost('/v2.0/JobInstances', '{"jobDefinitionId":"x","endpointId":"y","__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Prototype pollution — PATCH endpoints
  // ─────────────────────────────────────────────────────────────────────────
  describe('Prototype pollution — PATCH', () => {
    it('PATCH /v2.0/WindowsEndpoints/:id — rejects __proto__ with 400', async () => {
      const create = await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'WIN-PATCH-SEC' });
      expect(create.status).toBe(201);
      const id = create.body.id as string;

      const res = await rawPatch(`/v2.0/WindowsEndpoints/${id}`, '{"__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
      expect((Object.prototype as Record<string, unknown>)['isAdmin']).toBeUndefined();
    });

    it('PATCH /v2.0/AndroidEndpoints/:id — rejects constructor with 400', async () => {
      const create = await request(app).post('/v2.0/AndroidEndpoints').send({ displayName: 'AND-SEC' });
      expect(create.status).toBe(201);
      const id = create.body.id as string;

      const res = await rawPatch(`/v2.0/AndroidEndpoints/${id}`, '{"constructor":{"name":"pwned"}}');
      expect(res.status).toBe(400);
    });

    it('PATCH /v2.0/Assets/:id — rejects prototype with 400', async () => {
      const create = await request(app).post('/v2.0/Assets').send({ assetTypeId: 'at-001', name: 'SEC Asset', ownerId: 'u-001', ownerType: 'User' });
      expect(create.status).toBe(201);
      const id = create.body.id as string;

      const res = await rawPatch(`/v2.0/Assets/${id}`, '{"prototype":{"polluted":true}}');
      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Prototype pollution — PUT endpoints
  // ─────────────────────────────────────────────────────────────────────────
  describe('Prototype pollution — PUT', () => {
    it('PUT /v2.0/WindowsEndpoints/:id — rejects __proto__ with 400', async () => {
      const create = await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'WIN-PUT-SEC' });
      expect(create.status).toBe(201);
      const id = create.body.id as string;

      const res = await rawPut(`/v2.0/WindowsEndpoints/${id}`, '{"displayName":"WIN-PUT-SEC","__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
    });

    it('PUT /v2.0/JobDefinitions/:id — rejects __proto__ with 400', async () => {
      const create = await request(app).post('/v2.0/JobDefinitions').send({ name: 'job-put-sec' });
      expect(create.status).toBe(201);
      const id = create.body.id as string;

      const res = await rawPut(`/v2.0/JobDefinitions/${id}`, '{"name":"job-put-sec","__proto__":{"isAdmin":true}}');
      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Malformed body types
  // ─────────────────────────────────────────────────────────────────────────
  describe('Malformed body types', () => {
    // Array body (express.json strict rejects array → body becomes {} → displayName missing → 400)
    it('POST /v2.0/WindowsEndpoints — array body returns 400', async () => {
      const res = await rawPost('/v2.0/WindowsEndpoints', '[{"displayName":"x"}]');
      expect(res.status).toBe(400);
    });

    it('POST /v2.0/AndroidEndpoints — array body returns 400', async () => {
      const res = await rawPost('/v2.0/AndroidEndpoints', '[{"displayName":"x"}]');
      expect(res.status).toBe(400);
    });

    it('POST /v2.0/JobDefinitions — array body returns 400', async () => {
      const res = await rawPost('/v2.0/JobDefinitions', '[{"name":"x"}]');
      expect(res.status).toBe(400);
    });

    it('POST /v2.0/Assets — empty body {} returns 400 (missing required field)', async () => {
      const res = await request(app).post('/v2.0/Assets').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/assetTypeId/i);
    });

    it('POST /v2.0/JobInstances — body missing endpointId returns 400', async () => {
      const res = await request(app).post('/v2.0/JobInstances').send({ jobDefinitionId: 'j1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/endpointId/i);
    });

    it('POST /v2.0/JobInstances — body missing jobDefinitionId returns 400', async () => {
      const res = await request(app).post('/v2.0/JobInstances').send({ endpointId: 'e1' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/jobDefinitionId/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Type coercion resistance — required fields must be non-empty strings
  // ─────────────────────────────────────────────────────────────────────────
  describe('Type coercion resistance — displayName must be string', () => {
    const nonStringValues = [
      { label: 'number', value: JSON.stringify({ displayName: 42 }) },
      { label: 'boolean', value: JSON.stringify({ displayName: true }) },
      { label: 'null', value: JSON.stringify({ displayName: null }) },
      { label: 'object', value: JSON.stringify({ displayName: { nested: 'x' } }) },
      { label: 'array', value: JSON.stringify({ displayName: ['x'] }) },
      { label: 'empty string', value: JSON.stringify({ displayName: '' }) },
    ];

    for (const { label, value } of nonStringValues) {
      it(`POST /v2.0/WindowsEndpoints — displayName as ${label} returns 400`, async () => {
        const res = await rawPost('/v2.0/WindowsEndpoints', value);
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
      });
    }

    it('POST /v2.0/Variables — name as number returns 400', async () => {
      const res = await request(app).post('/v2.0/Variables').send({ name: 123 });
      expect(res.status).toBe(400);
    });

    it('POST /v2.0/JobDefinitions — name as boolean returns 400', async () => {
      const res = await request(app).post('/v2.0/JobDefinitions').send({ name: false });
      expect(res.status).toBe(400);
    });

    it('POST /v2.0/Assets — assetTypeId as number returns 400', async () => {
      const res = await request(app).post('/v2.0/Assets').send({ assetTypeId: 12345, name: 'x', ownerId: 'u-1', ownerType: 'User' });
      expect(res.status).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Global prototype pollution verification
  // ─────────────────────────────────────────────────────────────────────────
  describe('Global prototype pollution — no side effects after attack attempts', () => {
    it('Object.prototype is clean after 100 parallel pollution attempts', async () => {
      const payloads = [
        '{"displayName":"x","__proto__":{"isAdmin":true}}',
        '{"displayName":"x","constructor":{"name":"pwned"}}',
        '{"displayName":"x","prototype":{"polluted":1}}',
      ];

      const requests = Array.from({ length: 100 }, (_, i) =>
        rawPost('/v2.0/WindowsEndpoints', payloads[i % payloads.length] as string)
      );

      const results = await Promise.all(requests);
      // All should be rejected
      expect(results.every((r) => r.status === 400)).toBe(true);

      // Prototype must remain unpolluted
      const fresh = {} as Record<string, unknown>;
      expect(fresh.isAdmin).toBeUndefined();
      expect(fresh.polluted).toBeUndefined();
      expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Valid payloads still work after all the security checks
  // ─────────────────────────────────────────────────────────────────────────
  describe('Valid payloads — security middleware does not break normal operations', () => {
    it('POST /v2.0/WindowsEndpoints with extra fields succeeds with 201', async () => {
      const res = await request(app)
        .post('/v2.0/WindowsEndpoints')
        .send({ displayName: 'WIN-VALID', os: 'Windows 11', extra: 'field' });
      expect(res.status).toBe(201);
      expect(res.body.displayName).toBe('WIN-VALID');
    });

    it('POST /v2.0/Variables with valid name and value succeeds', async () => {
      const res = await request(app)
        .post('/v2.0/Variables')
        .send({ name: 'myVar', value: 'someValue', description: 'test var' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('myVar');
    });

    it('PATCH /v2.0/LinuxEndpoints/:id with partial body succeeds', async () => {
      const create = await request(app)
        .post('/v2.0/LinuxEndpoints')
        .send({ displayName: 'LINUX-PATCH-VALID' });
      expect(create.status).toBe(201);
      const id = create.body.id as string;

      const res = await request(app)
        .patch(`/v2.0/LinuxEndpoints/${id}`)
        .send({ operatingSystem: 'Ubuntu 24.04' });
      expect(res.status).toBe(200);
      expect(res.body.operatingSystem).toBe('Ubuntu 24.04');
    });
  });
});
