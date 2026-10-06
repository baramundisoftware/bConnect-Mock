/**
 * Request logging and metrics see every response, including the ones the module routing
 * guard (#49) sends itself, and the log shows the path as requested, with its module prefix.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

function withEnv<T>(vars: Record<string, string>, fn: () => T): T {
  const previous = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  Object.assign(process.env, vars);
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(previous)) {
      if (v === undefined) { delete process.env[k]; } else { process.env[k] = v; }
    }
  }
}

/** Logged lines are written on 'finish', after supertest resolves; wait for the next tick. */
async function loggedLines(spy: ReturnType<typeof vi.spyOn>): Promise<string[]> {
  await new Promise((resolve) => setImmediate(resolve));
  return spy.mock.calls.map((args: unknown[]) => String(args[0]));
}

describe('Request logging (text format, strict routing)', () => {
  let app: Express;
  let info: ReturnType<typeof vi.spyOn>;

  beforeAll(() => {
    app = withEnv({ BCONNECT_MODULE_ROUTING: 'strict', LOG_FORMAT: 'text', LOG_LEVEL: 'info' },
      () => createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1));
    info = vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => { info.mockClear(); });
  afterAll(() => { info.mockRestore(); });

  it('logs the path with its module prefix, without the query string', async () => {
    await request(app).get('/bconnect/compliance/v2.0/Rules?PageSize=1');
    expect(await loggedLines(info)).toContainEqual(expect.stringMatching(/^\[LOG\] GET \/bconnect\/compliance\/v2\.0\/Rules 200 \d+ms$/));
  });

  it('logs requests the module routing guard rejects', async () => {
    await request(app).get('/bconnect/jobs/v2.0/Endpoints');
    await request(app).put('/bconnect/endpoints/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000').send({});
    const lines = await loggedLines(info);
    expect(lines).toContainEqual(expect.stringMatching(/^\[LOG\] GET \/bconnect\/jobs\/v2\.0\/Endpoints 404 /));
    expect(lines).toContainEqual(expect.stringMatching(/^\[LOG\] PUT \/bconnect\/endpoints\/v2\.0\/WindowsEndpoints\/0{8}-0{4}-0{4}-0{4}-0{12} 405 /));
  });

  it('counts guard rejections in /metrics', async () => {
    const before = (await request(app).get('/metrics')).body.requestsByStatus['404'] ?? 0;
    await request(app).get('/bconnect/nonsense/v2.0/Endpoints');
    await new Promise((resolve) => setImmediate(resolve));
    const after = (await request(app).get('/metrics')).body.requestsByStatus['404'];
    expect(after).toBe(before + 1);
  });
});

describe('Request logging (JSON format)', () => {
  it('writes the requested path into the path field', async () => {
    const app = withEnv({ BCONNECT_MODULE_ROUTING: 'strict', LOG_FORMAT: 'json', LOG_LEVEL: 'info' },
      () => createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1));
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await request(app).get('/bconnect/endpoints/v2.0/WindowsEndpoints?PageSize=1');
      const entries = (await loggedLines(info)).map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(entries).toContainEqual(expect.objectContaining({
        method: 'GET', path: '/bconnect/endpoints/v2.0/WindowsEndpoints', status: 200,
      }));
    } finally {
      info.mockRestore();
    }
  });
});
