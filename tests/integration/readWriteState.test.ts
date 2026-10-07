/**
 * Read-write profiles: every read sees the current state. Sub-resource lists and get-by-ID
 * read the entity's store once one exists, so created items are found under their parent,
 * deleted ones are gone everywhere, and new parents have sub-resources.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

const GROUP = 'd1000001-0002-0002-0002-000000000002';
const JOB = 'bb000001-0001-0001-0001-000000000002';

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('read-write state in sub-resources and get-by-ID', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1); });

  it('a created child is listed under its parent', async () => {
    const created = await request(app).post('/v2.0/KioskReleases').send({ jobDefinitionId: JOB, assignmentTargetId: GROUP }).expect(201);
    const underGroup = await request(app).get(`/v2.0/LogicalGroups/${GROUP}/KioskReleases`).expect(200);
    expect(underGroup.body.data.map((r: { id: string }) => r.id)).toContain(created.body.id);
    const underJob = await request(app).get(`/v2.0/JobDefinitions/${JOB}/KioskReleases`).expect(200);
    expect(underJob.body.data.map((r: { id: string }) => r.id)).toContain(created.body.id);
  });

  it('a deleted child is gone from its parent and by ID', async () => {
    const before = await request(app).get(`/v2.0/LogicalGroups/${GROUP}/KioskReleases`).expect(200);
    const id = before.body.data[0].id as string;
    await request(app).delete(`/v2.0/KioskReleases/${id}`).expect(204);
    const after = await request(app).get(`/v2.0/LogicalGroups/${GROUP}/KioskReleases`).expect(200);
    expect(after.body.totalItems).toBe(before.body.totalItems - 1);
    await request(app).get(`/v2.0/KioskReleases/${id}`).expect(404);
  });

  it('a created parent has (empty) sub-resources', async () => {
    const group = await request(app).post('/v2.0/LogicalGroups').send({ name: 'New group', parentId: null }).expect(201);
    const res = await request(app).get(`/v2.0/LogicalGroups/${group.body.id as string}/KioskReleases`).expect(200);
    expect(res.body.totalItems).toBe(0);
  });

  it('a created child of a created parent is listed', async () => {
    const group = await request(app).post('/v2.0/LogicalGroups').send({ name: 'Parent', parentId: null }).expect(201);
    const release = await request(app).post('/v2.0/KioskReleases').send({ jobDefinitionId: JOB, assignmentTargetId: group.body.id }).expect(201);
    const res = await request(app).get(`/v2.0/LogicalGroups/${group.body.id as string}/KioskReleases`).expect(200);
    expect(res.body.data.map((r: { id: string }) => r.id)).toEqual([release.body.id]);
  });
});
