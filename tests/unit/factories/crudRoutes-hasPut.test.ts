/**
 * Coverage Fix — crudRoutes.ts hasPut branch + fixture fallback tests
 *
 * The registerCrudRoutes factory's hasPut=true path is only exercised through
 * direct unit testing since no app-level route currently calls it with hasPut.
 * Lines 139-140 (fixture GET by id non-array), 154-161 (hasPut PUT handler).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express, { type Express } from 'express';
import request from 'supertest';
import { registerCrudRoutes } from '../../../src/routes/factories/crudRoutes';
import { validateWriteBody } from '../../../src/middleware/validateBody';
import type { IProfile } from '../../../src/profiles/ProfileManager';
import type { StateManager } from '../../../src/state/StateManager';

const VALID_GUID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

interface TestItem { id: string; name: string; [k: string]: unknown; }

function makeApp(options: {
  items?: TestItem[];
  fixtureOverride?: unknown;
  hasPut?: boolean;
  withStateManager?: boolean;
}): Express {
  const items: TestItem[] = options.items ?? [{ id: VALID_GUID, name: 'Item1' }];
  const store = [...items];

  const app = express();
  app.use(express.json());

  const profile: IProfile = {
    getFixture: (_key: string) => (options.fixtureOverride !== undefined ? options.fixtureOverride : items) as never,
    getGenerator: () => null,
  } as unknown as IProfile;

  const entityStore = {
    getAll: () => store,
    getById: (id: string) => store.find((i) => i.id === id),
    create: (d: Record<string, unknown>) => { const n = { ...d, id: 'new-id-001' }; store.push(n as TestItem); return n; },
    update: (id: string, d: Record<string, unknown>) => {
      const idx = store.findIndex((i) => i.id === id);
      if (idx === -1) {return undefined;}
      store[idx] = { ...store[idx], ...d };
      return store[idx];
    },
    patch: (id: string, d: Record<string, unknown>) => {
      const idx = store.findIndex((i) => i.id === id);
      if (idx === -1) {return undefined;}
      store[idx] = { ...store[idx], ...d };
      return store[idx];
    },
    delete: (id: string) => {
      const idx = store.findIndex((i) => i.id === id);
      if (idx === -1) {return false;}
      store.splice(idx, 1);
      return true;
    },
  };

  if (options.withStateManager) {
    app.locals.stateManager = { getStore: () => entityStore, addStore: () => entityStore } as unknown as StateManager;
  }

  registerCrudRoutes(app, profile, {
    basePath: '/v2.0/TestItems',
    entityType: 'testItems',
    entityName: 'Test item',
    requiredField: 'name',
    searchFields: ['name'],
    getStore: () => entityStore,
    validateCreate: validateWriteBody(['name']),
    validatePatch: (req, res, next) => next(),
    hasPut: options.hasPut ?? false,
  });

  return app;
}

describe('crudRoutes — hasPut=true PUT handler', () => {
  let app: ReturnType<typeof makeApp>;

  beforeAll(() => {
    app = makeApp({ hasPut: true, withStateManager: true });
  });

  it('PUT existing item returns 200', async () => {
    const res = await request(app)
      .put(`/v2.0/TestItems/${VALID_GUID}`)
      .send({ name: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated');
  });

  it('PUT non-existent item returns 404', async () => {
    const res = await request(app)
      .put('/v2.0/TestItems/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
      .send({ name: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('PUT invalid GUID returns 400', async () => {
    const res = await request(app)
      .put('/v2.0/TestItems/not-a-guid')
      .send({ name: 'Bad' });
    expect(res.status).toBe(400);
  });
});

describe('crudRoutes — hasPut=true, no stateManager returns 403', () => {
  it('PUT returns 403 in read-only mode', async () => {
    const app = makeApp({ hasPut: true, withStateManager: false });
    const res = await request(app)
      .put(`/v2.0/TestItems/${VALID_GUID}`)
      .send({ name: 'ShouldFail' });
    expect(res.status).toBe(403);
  });
});

describe('crudRoutes — GET by id from fixture when no stateManager', () => {
  it('GET /:id returns 404 when fixture is not an array', async () => {
    const app = makeApp({ fixtureOverride: { notAnArray: true }, withStateManager: false });
    const res = await request(app).get(`/v2.0/TestItems/${VALID_GUID}`);
    expect(res.status).toBe(404);
  });

  it('GET /:id returns 200 from fixture array', async () => {
    const app = makeApp({ withStateManager: false });
    const res = await request(app).get(`/v2.0/TestItems/${VALID_GUID}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Item1');
  });

  it('GET /:id returns 404 for unknown id from fixture', async () => {
    const app = makeApp({ withStateManager: false });
    const res = await request(app).get('/v2.0/TestItems/cccccccc-cccc-cccc-cccc-cccccccccccc');
    expect(res.status).toBe(404);
  });

  it('POST returns 403 without stateManager', async () => {
    const app = makeApp({ withStateManager: false });
    const res = await request(app).post('/v2.0/TestItems').send({ name: 'Test' });
    expect(res.status).toBe(403);
  });
});
