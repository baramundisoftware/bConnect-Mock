/**
 * Module-prefix routing (issue #49)
 *
 * A real bMS answers each route only under the module prefix whose spec declares it.
 * The suite-wide default is BCONNECT_MODULE_ROUTING=lenient (vitest.config.ts);
 * these tests opt in to strict mode explicitly.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { execFileSync } from 'child_process';
import path from 'path';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { getModuleRoutingMode } from '../../src/middleware/moduleRouting';
import { MODULE_ROUTES } from '../../src/generated/moduleRoutes';
import type { Express } from 'express';

const ROUTING_ENV = 'BCONNECT_MODULE_ROUTING';

function setRoutingEnv(value: string | undefined): void {
  if (value === undefined) { delete process.env[ROUTING_ENV]; } else { process.env[ROUTING_ENV] = value; }
}

function withRoutingMode<T>(mode: string | undefined, fn: () => T): T {
  const previous = process.env[ROUTING_ENV];
  setRoutingEnv(mode);
  try { return fn(); } finally { setRoutingEnv(previous); }
}

describe('Module routing — strict (26R1)', () => {
  let app: Express;

  beforeAll(() => {
    app = withRoutingMode('strict', () => createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1));
  });

  afterAll(async () => {
    await request(app).post('/api/reset');
  });

  // The table from the issue
  it.each([
    ['/bconnect/endpoints/v2.0/WindowsEndpoints', 200],
    ['/bconnect/v2.0/WindowsEndpoints', 404],
    ['/bconnect/compliance/v2.0/WindowsEndpoints', 404],
    ['/bconnect/jobs/v2.0/Endpoints', 404],
    ['/bconnect/nonsense/v2.0/Endpoints', 404],
  ])('GET %s?PageSize=1 → %i', async (url, status) => {
    const res = await request(app).get(`${url}?PageSize=1`);
    expect(res.status).toBe(status);
  });

  it('accepts the module prefix without /bconnect', async () => {
    expect((await request(app).get('/endpoints/v2.0/WindowsEndpoints')).status).toBe(200);
  });

  it('rejects unprefixed root paths', async () => {
    const res = await request(app).get('/v2.0/WindowsEndpoints');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/no module prefix/);
  });

  it('names the unknown module in the 404', async () => {
    const res = await request(app).get('/bconnect/nonsense/v2.0/Endpoints');
    expect(res.body.error).toMatch(/unknown module "nonsense"/);
  });

  it('answers a route under its own module', async () => {
    expect((await request(app).get('/bconnect/compliance/v2.0/Rules')).status).toBe(200);
  });

  it('answers shared paths under every module that declares them', async () => {
    expect((await request(app).get('/bconnect/operatingsystems/v2.0/WindowsEndpoints')).status).toBe(200);
    expect((await request(app).get('/bconnect/updatemanagement/v2.0/WindowsEndpoints')).status).toBe(200);
    expect((await request(app).get('/bconnect/jobs/v2.0/Folders')).status).toBe(200);
    expect((await request(app).get('/bconnect/operatingsystems/v2.0/Folders')).status).toBe(200);
  });

  it('resolves path parameters', async () => {
    const list = await request(app).get('/bconnect/endpoints/v2.0/WindowsEndpoints?PageSize=1');
    const id = list.body.data[0].id as string;
    expect((await request(app).get(`/bconnect/endpoints/v2.0/WindowsEndpoints/${id}`)).status).toBe(200);
  });

  it('matches paths case-insensitively and ignores a trailing slash', async () => {
    expect((await request(app).get('/bconnect/endpoints/v2.0/windowsendpoints')).status).toBe(200);
    expect((await request(app).get('/bconnect/endpoints/v2.0/WindowsEndpoints/')).status).toBe(200);
  });

  it('rejects mock-only routes that no spec declares', async () => {
    expect((await request(app).get('/bconnect/endpoints/v2.0/StaticGroups')).status).toBe(404);
    expect((await request(app).get('/bconnect/variables/v2.0/Variables')).status).toBe(404);
  });

  it('rejects IndustrialEndpoints, which the 26R1 spec no longer declares', async () => {
    expect((await request(app).get('/bconnect/endpoints/v2.0/IndustrialEndpoints')).status).toBe(404);
  });

  it('returns 405 with Allow when the module declares the path but not the method', async () => {
    const res = await request(app)
      .put('/bconnect/endpoints/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
      .send({ displayName: 'x' });
    expect(res.status).toBe(405);
    expect(res.headers['allow']).toBe('DELETE, GET, PATCH');
  });

  it('lets declared write routes through', async () => {
    const res = await request(app).post('/bconnect/endpoints/v2.0/LogicalGroups').send({ name: 'Strict Group' });
    expect(res.status).toBe(201);
  });

  it('does not affect non-API paths', async () => {
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/metrics')).status).toBe(200);
    expect((await request(app).post('/api/reset')).status).toBe(200);
  });

  it('does not block CORS preflight', async () => {
    const res = await request(app)
      .options('/bconnect/endpoints/v2.0/WindowsEndpoints')
      .set('Origin', 'http://example.com')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.status).toBeLessThan(300);
  });
});

describe('Module routing — strict (25R2)', () => {
  let app: Express;

  beforeAll(() => {
    app = withRoutingMode('strict', () => createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2));
  });

  it('serves IndustrialEndpoints, which the 25R2 spec declares', async () => {
    expect((await request(app).get('/bconnect/endpoints/v2.0/IndustrialEndpoints')).status).toBe(200);
  });

  it('rejects the compliance module, which 25R2 does not have', async () => {
    const res = await request(app).get('/bconnect/compliance/v2.0/Rules');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/unknown module "compliance" for bMS 25r2/);
  });
});

describe.each([BmsVersion.BMS_25R2, BmsVersion.BMS_26R1])('Module routing — every spec route is served (%s)', (version) => {
  let app: Express;

  beforeAll(() => {
    app = withRoutingMode('strict', () => createApp(ProfileMode.STANDARD_READWRITE, version));
  });

  it('answers each parameter-free GET route under its own module', async () => {
    const rejected: string[] = [];
    for (const [moduleName, routes] of Object.entries(MODULE_ROUTES[version] ?? {})) {
      for (const route of routes) {
        if (!route.startsWith('GET ') || route.includes('{}')) { continue; }
        const res = await request(app).get(`/bconnect/${moduleName}${route.slice(4)}`);
        if (res.status === 404 || res.status === 405) { rejected.push(`${res.status} ${moduleName} ${route}`); }
      }
    }
    expect(rejected).toEqual([]);
  });
});

describe('Module routing — lenient', () => {
  let app: Express;

  beforeAll(() => {
    app = withRoutingMode('lenient', () => createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1));
  });

  it.each([
    '/v2.0/WindowsEndpoints',
    '/bconnect/v2.0/WindowsEndpoints',
    '/bconnect/compliance/v2.0/WindowsEndpoints',
    '/bconnect/nonsense/v2.0/Endpoints',
  ])('GET %s → 200 (previous behaviour)', async (url) => {
    expect((await request(app).get(url)).status).toBe(200);
  });
});

describe('getModuleRoutingMode', () => {
  it.each([
    [undefined, 'strict'],
    ['', 'strict'],
    ['strict', 'strict'],
    ['LENIENT', 'lenient'],
    [' lenient ', 'lenient'],
  ])('%j → %s', (value, expected) => {
    expect(withRoutingMode(value, getModuleRoutingMode)).toBe(expected);
  });

  it('falls back to strict with a warning for an invalid value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(withRoutingMode('loose', getModuleRoutingMode)).toBe('strict');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('BCONNECT_MODULE_ROUTING="loose"'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('Generated module route table', () => {
  it('is in sync with the OpenAPI specs', () => {
    const script = path.resolve(__dirname, '../../scripts/generate-module-routes.js');
    expect(() => execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' })).not.toThrow();
  });
});
