/**
 * Coverage Fix — singleton factory unit tests
 *
 * Covers the branches missing from factories/singleton.ts:
 *  - empty array → 404
 *  - null/undefined fixture → 404
 *  - thrown error → 500
 *  - plain object → 200 (already exercised by integration tests, included for completeness)
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerSingleton } from '../../../src/routes/factories/singleton';
import type { IProfile } from '../../../src/profiles/ProfileManager';

function makeApp(fixtureValue: unknown): express.Express {
  const app = express();
  app.use(express.json());

  const profile = {
    getFixture: (_key: string) => fixtureValue as never,
    getGenerator: () => null,
  } as unknown as IProfile;

  registerSingleton(app, profile, {
    path: '/v2.0/TestSingleton',
    fixtureKey: 'testKey',
    entityName: 'TestEntity',
  });

  return app;
}

describe('registerSingleton factory', () => {
  it('returns 200 with first element when fixture is a non-empty array', async () => {
    const app = makeApp([{ id: 'abc', name: 'First' }, { id: 'def', name: 'Second' }]);
    const res = await request(app).get('/v2.0/TestSingleton');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('abc');
  });

  it('returns 404 when fixture is an empty array', async () => {
    const app = makeApp([]);
    const res = await request(app).get('/v2.0/TestSingleton');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/TestEntity not found/i);
  });

  it('returns 200 with object when fixture is a plain object', async () => {
    const app = makeApp({ id: 'obj-1', state: 'active' });
    const res = await request(app).get('/v2.0/TestSingleton');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('obj-1');
  });

  it('returns 404 when fixture is null', async () => {
    const app = makeApp(null);
    const res = await request(app).get('/v2.0/TestSingleton');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/TestEntity not found/i);
  });

  it('returns 404 when fixture is undefined', async () => {
    const app = makeApp(undefined);
    const res = await request(app).get('/v2.0/TestSingleton');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/TestEntity not found/i);
  });

  it('returns 500 when getFixture throws', async () => {
    const app = express();
    app.use(express.json());
    const profile = {
      getFixture: () => { throw new Error('DB exploded'); },
      getGenerator: () => null,
    } as unknown as IProfile;
    registerSingleton(app, profile, {
      path: '/v2.0/TestSingleton',
      fixtureKey: 'testKey',
      entityName: 'TestEntity',
    });
    const res = await request(app).get('/v2.0/TestSingleton');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/internal server error/i);
  });
});
