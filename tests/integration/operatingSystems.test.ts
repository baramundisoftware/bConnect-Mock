/**
 * operatingsystems module (#53): OS folders and the OS view of Windows endpoints, instead of
 * the jobs folders and the full endpoint object that share these paths in other modules.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

const OS = '/bconnect/operatingsystems/v2.0';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNKNOWN = '00000000-0000-0000-0000-000000000000';
const OS_VIEW_FIELDS = ['bootEnvironmentId', 'endpointId', 'endpointName', 'hardwareProfileId', 'inheritsAutoInstallation', 'isOSInstallAllowed', 'operatingSystem'];

function strictApp(mode: ProfileMode, version: BmsVersion): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, version); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe.each([BmsVersion.BMS_25R2, BmsVersion.BMS_26R1])('operatingsystems WindowsEndpoints (%s)', (version) => {
  let app: Express;
  beforeAll(() => { app = strictApp(ProfileMode.STANDARD_READWRITE, version); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('lists the OS view of every Windows endpoint, not the full endpoint', async () => {
    const os = await request(app).get(`${OS}/WindowsEndpoints`);
    const full = await request(app).get('/bconnect/endpoints/v2.0/WindowsEndpoints');
    expect(os.status).toBe(200);
    expect(os.body.totalItems).toBe(full.body.totalItems);
    expect(os.body.data.map((e: { endpointId: string }) => e.endpointId))
      .toEqual(full.body.data.map((e: { id: string }) => e.id));
    for (const ep of os.body.data) {
      expect(Object.keys(ep).sort()).toEqual(OS_VIEW_FIELDS);
      expect(typeof ep.isOSInstallAllowed).toBe('boolean');
      expect(typeof ep.inheritsAutoInstallation).toBe('boolean');
      for (const field of ['bootEnvironmentId', 'hardwareProfileId']) {
        if (ep[field] !== null) { expect(ep[field]).toMatch(GUID); }
      }
    }
    expect(Object.keys(full.body.data[0])).toContain('hostName');
  });

  it('derives the spec\'s WindowsOperatingSystem from the endpoint\'s OS name', async () => {
    const res = await request(app).get(`${OS}/WindowsEndpoints/d0000001-0001-0001-0001-000000000001`);
    expect(res.status).toBe(200);
    expect(res.body.operatingSystem).toMatchObject({
      name: 'Microsoft Windows 11 Enterprise 23H2',
      displayVersion: '23H2',
      releaseId: '23H2',
      version: { major: 10, minor: 0, build: 22631 },
    });
    expect(res.body.operatingSystem.version.full).toMatch(/^10\.0\.22631\.\d+$/);
  });

  it('pages and searches by endpoint name', async () => {
    const page = await request(app).get(`${OS}/WindowsEndpoints?PageSize=2&Page=1`);
    expect(page.body.data).toHaveLength(2);
    const search = await request(app).get(`${OS}/WindowsEndpoints?SearchQuery=PCDE001`);
    expect(search.body.data.map((e: { endpointName: string }) => e.endpointName)).toContain('PCDE001-NYC');
  });

  it('answers 404 for an unknown and 400 for a malformed id', async () => {
    expect((await request(app).get(`${OS}/WindowsEndpoints/${UNKNOWN}`)).status).toBe(404);
    expect((await request(app).get(`${OS}/WindowsEndpoints/not-a-guid`)).status).toBe(400);
  });

  it('PATCH (JSON Patch) changes OS settings and keeps them until reset', async () => {
    const id = 'd0000001-0001-0001-0001-000000000001';
    const before = (await request(app).get(`${OS}/WindowsEndpoints/${id}`)).body;
    const res = await request(app).patch(`${OS}/WindowsEndpoints/${id}`)
      .set('Content-Type', 'application/json-patch+json')
      .send([{ op: 'replace', path: '/isOSInstallAllowed', value: !before.isOSInstallAllowed },
             { op: 'replace', path: '/bootEnvironmentId', value: null }]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ isOSInstallAllowed: !before.isOSInstallAllowed, bootEnvironmentId: null });
    expect((await request(app).get(`${OS}/WindowsEndpoints/${id}`)).body.isOSInstallAllowed).toBe(!before.isOSInstallAllowed);
    await request(app).post('/api/reset');
    expect((await request(app).get(`${OS}/WindowsEndpoints/${id}`)).body).toEqual(before);
  });

  it('PATCH refuses fields the endpoint reports itself', async () => {
    const res = await request(app).patch(`${OS}/WindowsEndpoints/d0000001-0001-0001-0001-000000000001`)
      .send([{ op: 'replace', path: '/endpointName', value: 'renamed' }]);
    expect(res.status).toBe(400);
    expect(res.headers['x-bconnect-mock-reason']).toMatch(/endpointName/);
  });

  it('PATCH answers 404 for an unknown endpoint', async () => {
    const res = await request(app).patch(`${OS}/WindowsEndpoints/${UNKNOWN}`).send({ isOSInstallAllowed: false });
    expect(res.status).toBe(404);
  });
});

describe.each([BmsVersion.BMS_25R2, BmsVersion.BMS_26R1])('operatingsystems Folders (%s)', (version) => {
  let app: Express;
  beforeAll(() => { app = strictApp(ProfileMode.STANDARD_READWRITE, version); });
  afterEach(async () => { await request(app).post('/api/reset'); });

  it('lists OS folders, not the jobs folders', async () => {
    const os = await request(app).get(`${OS}/Folders`);
    const jobs = await request(app).get('/bconnect/jobs/v2.0/Folders');
    expect(os.status).toBe(200);
    const names = os.body.data.map((f: { name: string }) => f.name);
    expect(names).toContain('Windows 11');
    expect(names).not.toEqual(jobs.body.data.map((f: { name: string }) => f.name));
    for (const f of os.body.data) { expect(f.id).toMatch(GUID); }
  });

  it('gets a folder and its child folders', async () => {
    const list = await request(app).get(`${OS}/Folders`);
    const win10 = list.body.data.find((f: { name: string }) => f.name === 'Windows 10');
    expect((await request(app).get(`${OS}/Folders/${win10.id}`)).body.name).toBe('Windows 10');
    const children = await request(app).get(`${OS}/Folders/${win10.id}/Folders`);
    expect(children.body.data.map((f: { name: string }) => f.name)).toEqual(['Windows 10 21H2']);
  });

  it('returns all descendants with includeSubfolders=true', async () => {
    const parent = (await request(app).post(`${OS}/Folders`).send({ name: 'Parent' })).body;
    const child = (await request(app).post(`${OS}/Folders`).send({ name: 'Child', parentId: parent.id })).body;
    await request(app).post(`${OS}/Folders`).send({ name: 'Grandchild', parentId: child.id });
    const direct = await request(app).get(`${OS}/Folders/${parent.id}/Folders`);
    const all = await request(app).get(`${OS}/Folders/${parent.id}/Folders?includeSubfolders=true`);
    expect(direct.body.data.map((f: { name: string }) => f.name)).toEqual(['Child']);
    expect(all.body.data.map((f: { name: string }) => f.name)).toEqual(['Child', 'Grandchild']);
  });

  it('creates, updates and deletes OS folders without touching the jobs folders', async () => {
    const jobsBefore = (await request(app).get('/bconnect/jobs/v2.0/Folders')).body.totalItems;
    const created = await request(app).post(`${OS}/Folders`).send({ name: 'Windows 12' });
    expect(created.status).toBe(201);
    const patched = await request(app).patch(`${OS}/Folders/${created.body.id}`)
      .send([{ op: 'replace', path: '/comment', value: 'next' }]);
    expect(patched.body.comment).toBe('next');
    expect((await request(app).get('/bconnect/jobs/v2.0/Folders')).body.totalItems).toBe(jobsBefore);
    expect((await request(app).delete(`${OS}/Folders/${created.body.id}`)).status).toBe(204);
    expect((await request(app).get(`${OS}/Folders/${created.body.id}`)).status).toBe(404);
  });
});

describe('operatingsystems in a read-only profile', () => {
  it('reads, but refuses writes with 403', async () => {
    const app = strictApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    expect((await request(app).get(`${OS}/WindowsEndpoints`)).status).toBe(200);
    expect((await request(app).get(`${OS}/Folders`)).status).toBe(200);
    expect((await request(app).patch(`${OS}/WindowsEndpoints/d0000001-0001-0001-0001-000000000001`)
      .send({ isOSInstallAllowed: false })).status).toBe(403);
    expect((await request(app).post(`${OS}/Folders`).send({ name: 'x' })).status).toBe(403);
  });
});

describe('operatingsystems in lenient routing', () => {
  it('serves the OS view under the module, and other paths under it as before', async () => {
    const app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); // suite default: lenient
    const os = await request(app).get('/operatingsystems/v2.0/WindowsEndpoints');
    expect(Object.keys(os.body.data[0]).sort()).toEqual(OS_VIEW_FIELDS);
    expect((await request(app).get('/operatingsystems/v2.0/Endpoints')).status).toBe(200);
    expect(Object.keys((await request(app).get('/v2.0/WindowsEndpoints')).body.data[0])).toContain('hostName');
  });
});
