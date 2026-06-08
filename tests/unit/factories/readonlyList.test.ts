/**
 * Coverage Fix — readonlyList.ts uncovered branches
 *
 * Tests:
 *  - resolved=null → 404 (line 56-57)
 *  - catch block → 500 (line 68-69)
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { registerReadonlyList } from '../../../src/routes/factories/readonlyList';
import type { IProfile } from '../../../src/profiles/ProfileManager';

function makeReadonlyApp(fixtureValue: unknown, throws = false): express.Express {
  const app = express();
  const profile: IProfile = {
    getFixture: () => {
      if (throws) {throw new Error('fixture error');}
      return fixtureValue as never;
    },
    getGenerator: () => null,
  } as unknown as IProfile;

  registerReadonlyList(app, profile, {
    path: '/v2.0/Items',
    entityType: 'items',
    searchFields: ['name'],
    entityName: 'Items',
  });
  return app;
}

describe('registerReadonlyList', () => {
  it('returns 404 when resolved data is null (empty fixture array)', async () => {
    const app = makeReadonlyApp([]);
    const res = await request(app).get('/v2.0/Items');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not available/i);
  });

  it('returns 404 when fixture is not an array', async () => {
    const app = makeReadonlyApp({ notArray: true });
    const res = await request(app).get('/v2.0/Items');
    expect(res.status).toBe(404);
  });

  it('returns 500 when getFixture throws', async () => {
    const app = makeReadonlyApp(null, true);
    const res = await request(app).get('/v2.0/Items');
    expect(res.status).toBe(500);
  });

  it('returns 200 with data for non-empty fixture', async () => {
    const app = makeReadonlyApp([{ id: '1', name: 'Alpha' }]);
    const res = await request(app).get('/v2.0/Items');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
