/**
 * LogicalGroups Integration Tests (Phase 11)
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('LogicalGroups (standard-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY);
  });

  it('GET /v2.0/LogicalGroups returns 200 with data array', async () => {
    const res = await request(app).get('/v2.0/LogicalGroups');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('totalItems');
  });

  it('returns logical groups with correct structure', async () => {
    const res = await request(app).get('/v2.0/LogicalGroups');
    const group = res.body.data[0];
    expect(group).toHaveProperty('id');
    expect(group).toHaveProperty('displayName');
    expect(group).toHaveProperty('type', 'LogicalGroup');
  });

  it('GET /v2.0/LogicalGroups/:id returns single group', async () => {
    const listRes = await request(app).get('/v2.0/LogicalGroups');
    const id = listRes.body.data[0].id;
    const res = await request(app).get(`/v2.0/LogicalGroups/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
  });

  it('GET /v2.0/LogicalGroups/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/v2.0/LogicalGroups/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });

  it('returns hierarchical structure with root and children', async () => {
    const res = await request(app).get('/v2.0/LogicalGroups');
    const groups = res.body.data;
    // As on a live bMS, the top group's parent is the module's hidden root, not null
    const root = groups.find((g: { parentId: unknown }) => g.parentId === '299d0b30-d384-430c-875a-63c3ef73a150');
    expect(root).toMatchObject({ parent: '[environment]' });
    const children = groups.filter((g: { parentId: unknown }) => g.parentId === root.id);
    expect(children.length).toBeGreaterThan(0);
    for (const child of children) { expect(child.parent).toBe(root.name); }
  });

  it('POST /v2.0/LogicalGroups returns 403 in read-only profile', async () => {
    const res = await request(app)
      .post('/v2.0/LogicalGroups')
      .send({ name: 'Test Group' });
    expect(res.status).toBe(403);
  });
});

describe('LogicalGroups CRUD (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  afterEach(async () => {
    await request(app).post('/api/reset');
  });

  it('POST creates a new logical group from a spec body (name) with HTTP 201', async () => {
    const res = await request(app)
      .post('/v2.0/LogicalGroups')
      .send({ name: 'Test Group', comment: 'Test comment' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Test Group');
    expect(res.body.comment).toBe('Test comment');
    expect(res.body.displayName).toBe('Test Group');

    const listRes = await request(app).get('/v2.0/LogicalGroups?SearchQuery=Test Group');
    expect(listRes.body.data.map((g: { id: string }) => g.id)).toContain(res.body.id);
  });

  it('POST returns 400 naming `name` when name missing', async () => {
    const res = await request(app)
      .post('/v2.0/LogicalGroups')
      .send({ comment: 'No name' });
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/\bname\b/);
  });

  it('POST returns 400 when only displayName is sent (not a spec field)', async () => {
    const res = await request(app)
      .post('/v2.0/LogicalGroups')
      .send({ displayName: 'Legacy' });
    expect(res.status).toBe(400);
  });

  it('PATCH updates logical group fields', async () => {
    const createRes = await request(app)
      .post('/v2.0/LogicalGroups')
      .send({ name: 'Group to Patch' });
    const id = createRes.body.id;

    const patchRes = await request(app)
      .patch(`/v2.0/LogicalGroups/${id}`)
      .send({ description: 'Updated description' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.description).toBe('Updated description');
  });

  it('PATCH returns 404 for unknown id', async () => {
    const res = await request(app)
      .patch('/v2.0/LogicalGroups/00000000-0000-0000-0000-000000000000')
      .send({ displayName: 'X' });
    expect(res.status).toBe(404);
  });

  it('DELETE removes logical group with HTTP 204', async () => {
    const createRes = await request(app)
      .post('/v2.0/LogicalGroups')
      .send({ name: 'Group to Delete' });
    const id = createRes.body.id;

    expect((await request(app).delete(`/v2.0/LogicalGroups/${id}`)).status).toBe(204);
    expect((await request(app).get(`/v2.0/LogicalGroups/${id}`)).status).toBe(404);
  });
});
