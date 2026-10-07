/**
 * Read-write profiles: every read sees the current state. Sub-resource lists and get-by-ID
 * read the entity's store once one exists, so created items are found under their parent,
 * deleted ones are gone everywhere, and new parents have sub-resources. Every list and
 * get-by-ID sees every DELETE, and each read-write profile starts with the data of its
 * read-only twin.
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

type Routed = { router: { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> } };

/** Every `DELETE <list>/:id` route whose list is served by a `GET <list>` route */
function deletableLists(app: Express): string[] {
  const routes = new Set((app as unknown as Routed).router.stack.flatMap((l) =>
    l.route ? Object.keys(l.route.methods).map((m) => `${m.toUpperCase()} ${l.route?.path ?? ''}`) : []));
  return [...routes]
    .filter((r) => /^DELETE [^:]+\/:\w+$/.test(r))
    .map((r) => r.slice('DELETE '.length).replace(/\/:\w+$/, ''))
    .filter((base) => routes.has(`GET ${base}`) && routes.has(`GET ${base}/:id`));
}

const listItems = (body: unknown): Array<Record<string, unknown>> =>
  (Array.isArray(body) ? body : (body as { data?: unknown[] }).data ?? []) as Array<Record<string, unknown>>;

describe.each([
  [ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_25R2],
  [ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1],
  [ProfileMode.LARGESCALE_READWRITE, BmsVersion.BMS_26R1],
])('every DELETE is seen by the list and get-by-ID (%s, %s)', (mode, version) => {
  const lists = deletableLists(createApp(mode, version));

  it('finds the DELETE routes', () => { expect(lists.length).toBeGreaterThan(20); });

  it.each(lists)('%s', async (base) => {
    const app = createApp(mode, version);
    const item = listItems((await request(app).get(`${base}?PageSize=1000`)).body).at(-1);
    expect(item, 'the list has an item to delete').toBeDefined();
    const id = (item?.['id'] ?? item?.['guid']) as string;
    await request(app).get(`${base}/${id}`).expect(200);
    await request(app).delete(`${base}/${id}`).expect(204);
    const after = listItems((await request(app).get(`${base}?PageSize=1000`)).body);
    expect(after.some((x) => (x['id'] ?? x['guid']) === id), 'still in the list').toBe(false);
    await request(app).get(`${base}/${id}`).expect(404);
  });
});

describe.each([
  [ProfileMode.MINIMAL_READONLY, ProfileMode.MINIMAL_READWRITE],
  [ProfileMode.LARGESCALE_READONLY, ProfileMode.LARGESCALE_READWRITE],
])('%s and %s start with the same data', (readonly, readwrite) => {
  it.each(['WindowsEndpoints', 'AndroidEndpoints', 'IosEndpoints', 'NetworkEndpoints', 'LogicalGroups', 'JobDefinitions', 'JobInstances', 'Assets', 'Bundles'])('%s', async (entity) => {
    const ro = await request(createApp(readonly, BmsVersion.BMS_26R1)).get(`/v2.0/${entity}?PageSize=1`);
    const rw = await request(createApp(readwrite, BmsVersion.BMS_26R1)).get(`/v2.0/${entity}?PageSize=1`);
    expect(rw.body.totalItems ?? 0).toBe(ro.body.totalItems ?? 0);
    expect(rw.body.data?.[0]?.id).toBe(ro.body.data?.[0]?.id);
  });
});

describe.each([ProfileMode.MINIMAL_READONLY, ProfileMode.MINIMAL_READWRITE])('empty lists answer an empty page (%s)', (mode) => {
  it.each([
    '/bconnect/endpoints/v2.0/AndroidEndpoints',
    '/bconnect/servermanagement/v2.0/SecurityGroups',
    '/bconnect/servermanagement/v2.0/SecurityProfiles',
    '/bconnect/software/v2.0/InstalledWindowsSoftware',
    '/bconnect/variables/v2.0/VariableInstances',
  ])('%s', async (path) => {
    const res = await request(createApp(mode, BmsVersion.BMS_26R1)).get(path).expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
