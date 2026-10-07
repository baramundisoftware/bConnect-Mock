/**
 * Answers carry exactly the spec's fields in strict routing, as a live bMS does (26R1 probe,
 * 2026-10-07: the items of all 39 list routes with data have exactly the spec's fields).
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { projectOntoShape } from '../../src/middleware/specProjection';
import { RESPONSE_SHAPES, type ResponseShape } from '../../src/generated/moduleRoutes';
import type { Express } from 'express';

function strictApp(mode: ProfileMode, version = BmsVersion.BMS_26R1): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, version); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('projectOntoShape', () => {
  const shape: ResponseShape = { o: { id: 0, name: 0, comment: 0, nested: { o: { a: 0 }, z: [] }, list: { a: { o: { x: 0 }, z: ['x'] } } }, z: ['comment'] };

  it('drops fields the shape lacks, adds missing nullable fields as null', () => {
    expect(projectOntoShape({ id: 1, name: 'n', extra: true, nested: { a: 1, b: 2 }, list: [{ y: 1 }] }, shape))
      .toEqual({ id: 1, name: 'n', comment: null, nested: { a: 1 }, list: [{ x: null }] });
  });

  it('leaves a missing non-nullable field missing, and keeps null values', () => {
    expect(projectOntoShape({ id: null }, shape)).toEqual({ id: null, comment: null });
  });

  it('keeps leaves and non-objects as they are', () => {
    expect(projectOntoShape({ id: { deep: 1 } }, shape)).toMatchObject({ id: { deep: 1 } });
    expect(projectOntoShape('text', shape)).toBe('text');
    expect(projectOntoShape(null, shape)).toBeNull();
  });
});

describe('strict routing projects answers onto the spec', () => {
  let app: Express;
  beforeAll(() => { app = strictApp(ProfileMode.STANDARD_READWRITE); });

  it('a list item has exactly the spec\'s fields; missing nullable ones are null', async () => {
    const res = await request(app).get('/bconnect/endpoints/v2.0/LogicalGroups?PageSize=1');
    expect(Object.keys(res.body).sort()).toEqual(['currentPage', 'data', 'hasNextPage', 'hasPreviousPage', 'pageSize', 'totalItems', 'totalPages']);
    const group = res.body.data[0] as Record<string, unknown>;
    const spec = RESPONSE_SHAPES['26r1']?.['endpoints']?.['GET /v2.0/LogicalGroups'] as unknown as { o: { data: { a: { o: Record<string, unknown> } } } };
    const specFields = Object.keys(spec.o.data.a.o);
    for (const key of Object.keys(group)) { expect(specFields).toContain(key); }
    expect(group).not.toHaveProperty('displayName');
    expect(group).toMatchObject({ comment: null, dip: null, defaultDomain: null });
  });

  it('a single item is projected too', async () => {
    const list = await request(app).get('/bconnect/endpoints/v2.0/WindowsEndpoints?PageSize=1');
    const id = list.body.data[0].id as string;
    const res = await request(app).get(`/bconnect/endpoints/v2.0/WindowsEndpoints/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body).not.toHaveProperty('dynamicGroupId'); // mock-only relation field
  });

  it('relations and search still work on the internal data', async () => {
    const groups = await request(app).get('/bconnect/endpoints/v2.0/LogicalGroups?PageSize=20');
    const withMembers = (groups.body.data as Array<{ id: string }>).map((g) => g.id);
    let members = 0;
    for (const id of withMembers) {
      members += (await request(app).get(`/bconnect/endpoints/v2.0/LogicalGroups/${id}/WindowsEndpoints`)).body.totalItems as number;
    }
    expect(members).toBeGreaterThan(0);
    const search = await request(app).get('/bconnect/endpoints/v2.0/WindowsEndpoints?SearchQuery=NYC');
    expect(search.body.totalItems).toBeGreaterThan(0);
  });

  it('a created item comes back projected', async () => {
    const res = await request(app).post('/bconnect/endpoints/v2.0/LogicalGroups').send({ name: 'Projected', parentId: null });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Projected' });
    expect(res.body).not.toHaveProperty('displayName');
    expect(res.body).not.toHaveProperty('guid');
  });

  it('errors are not projected', async () => {
    const res = await request(app).get('/bconnect/endpoints/v2.0/LogicalGroups/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
    expect(JSON.parse(res.text)).toHaveProperty('traceId');
  });
});

describe('lenient routing answers unprojected', () => {
  it('keeps the mock\'s extra fields', async () => {
    const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); // suite default: lenient
    const res = await request(app).get('/v2.0/LogicalGroups?PageSize=1');
    expect(res.body.data[0]).toHaveProperty('displayName');
  });
});
