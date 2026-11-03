/**
 * The routes 26R2 added: thresholds of universal dynamic groups, API key management and the
 * Intune remote actions.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

type Item = Record<string, unknown>;

function strictApp(mode: ProfileMode, version = BmsVersion.BMS_26R2): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, version); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

const UDG = '/bconnect/universaldynamicgroups/v2.0';
const SM = '/bconnect/servermanagement/v2.0';
const EP = '/bconnect/endpoints/v2.0';
const patch = (ops: Record<string, unknown>): Array<Record<string, unknown>> =>
  Object.entries(ops).map(([field, value]) => ({ op: 'replace', path: `/${field}`, value }));

beforeAll(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Thresholds', () => {
  let app: Express;
  beforeEach(() => { app = strictApp(ProfileMode.STANDARD_READWRITE); });

  it('lists thresholds of the profile\'s groups and security profiles, paged', async () => {
    const res = await request(app).get(`${UDG}/Thresholds`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ currentPage: 0, totalItems: 5 });
    const groups = (await request(app).get(`${UDG}/UniversalDynamicGroups`)).body.data as Item[];
    for (const t of res.body.data as Item[]) {
      expect(groups.map((g) => g['id'])).toContain(t['dynamicGroupId']);
      expect(t).toMatchObject({ severity: expect.stringMatching(/^(Info|Warning|Error)$/), type: expect.stringMatching(/Limit$/), value: expect.any(Number), modifiedBy: expect.any(String) });
    }
  });

  it('lists a group\'s thresholds; an unknown group is a 404', async () => {
    const first = ((await request(app).get(`${UDG}/Thresholds`)).body.data as Item[])[0] as Item;
    const own = await request(app).get(`${UDG}/UniversalDynamicGroups/${first['dynamicGroupId'] as string}/Thresholds`);
    expect((own.body.data as Item[]).map((t) => t['severity'])).toEqual(['Warning', 'Error']);
    expect((await request(app).get(`${UDG}/UniversalDynamicGroups/00000000-0000-0000-0000-000000000000/Thresholds`)).status).toBe(404);
    expect((await request(app).get(`${UDG}/Thresholds/${first['id'] as string}`)).body).toEqual(first);
  });

  it('creates, updates and deletes a threshold', async () => {
    const groups = (await request(app).get(`${UDG}/UniversalDynamicGroups`)).body.data as Item[];
    const profiles = (await request(app).get(`${SM}/SecurityProfiles`)).body.data as Item[];
    const body = { dynamicGroupId: groups[4]?.['id'], securityProfileId: profiles[0]?.['id'], value: 10, type: 'LowerLimit', severity: 'Error' };
    const created = await request(app).post(`${UDG}/Thresholds`).send(body);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ ...body, dynamicGroupName: groups[4]?.['name'], securityProfileName: profiles[0]?.['name'], isActive: true });
    expect((await request(app).post(`${UDG}/Thresholds`).send(body)).status).toBe(409);

    const id = created.body.id as string;
    const updated = await request(app).patch(`${UDG}/Thresholds/${id}`).set('Content-Type', 'application/json-patch+json').send(patch({ value: 12, isActive: false }));
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ value: 12, isActive: false, type: 'LowerLimit' });
    expect((await request(app).patch(`${UDG}/Thresholds/${id}`).send(patch({ dynamicGroupId: groups[0]?.['id'] }))).status).toBe(400);

    expect((await request(app).delete(`${UDG}/Thresholds/${id}`)).status).toBe(204);
    expect((await request(app).get(`${UDG}/Thresholds/${id}`)).status).toBe(404);
    expect((await request(app).delete(`${UDG}/Thresholds/${id}`)).status).toBe(404);
  });

  it('rejects what the spec does not allow', async () => {
    const groups = (await request(app).get(`${UDG}/UniversalDynamicGroups`)).body.data as Item[];
    const profiles = (await request(app).get(`${SM}/SecurityProfiles`)).body.data as Item[];
    const valid = { dynamicGroupId: groups[4]?.['id'], securityProfileId: profiles[0]?.['id'] };
    expect((await request(app).post(`${UDG}/Thresholds`).send({ securityProfileId: valid.securityProfileId })).status).toBe(400);
    expect((await request(app).post(`${UDG}/Thresholds`).send({ ...valid, value: -1 })).status).toBe(400);
    expect((await request(app).post(`${UDG}/Thresholds`).send({ ...valid, severity: 'Critical' })).status).toBe(400);
    expect((await request(app).post(`${UDG}/Thresholds`).send({ ...valid, securityProfileId: '00000000-0000-0000-0000-000000000000' })).status).toBe(404);
  });

  it('needs a read-write profile to write', async () => {
    const ro = strictApp(ProfileMode.STANDARD_READONLY);
    const first = ((await request(ro).get(`${UDG}/Thresholds`)).body.data as Item[])[0] as Item;
    expect((await request(ro).delete(`${UDG}/Thresholds/${first['id'] as string}`)).status).toBe(403);
  });
});

describe('API keys', () => {
  let app: Express;
  beforeEach(() => { app = strictApp(ProfileMode.STANDARD_READWRITE); });

  it('creates a key whose secret is answered once', async () => {
    const profiles = (await request(app).get(`${SM}/SecurityProfiles`)).body.data as Item[];
    const created = await request(app).post(`${SM}/ApiKeys`).send({ name: 'Monitoring', expirationDate: '2027-06-30', securityProfiles: [profiles[0]?.['id']] });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Monitoring', expirationDate: '2027-06-30', isActive: true, apiKeySecret: expect.stringMatching(/^[\w-]{43}$/) });
    const id = created.body.id as string;
    const read = await request(app).get(`${SM}/ApiKeys/${id}`);
    expect(read.body).toMatchObject({ id, name: 'Monitoring' });
    expect(read.body).not.toHaveProperty('apiKeySecret');
    expect(((await request(app).get(`${SM}/ApiKeys`)).body as Item[]).map((k) => k['id'])).toContain(id);
    expect((await request(app).post(`${SM}/ApiKeys`).send({ name: 'monitoring' })).status).toBe(409);
  });

  it('updates and deletes a key', async () => {
    const [first, second] = (await request(app).get(`${SM}/ApiKeys`)).body as Item[];
    const id = first?.['id'] as string;
    const updated = await request(app).patch(`${SM}/ApiKeys/${id}`).send(patch({ isActive: false, comment: 'Paused' }));
    expect(updated.body).toMatchObject({ id, isActive: false, comment: 'Paused' });
    expect((await request(app).patch(`${SM}/ApiKeys/${id}`).send(patch({ name: second?.['name'] }))).status).toBe(409);
    expect((await request(app).patch(`${SM}/ApiKeys/${id}`).send(patch({ apiKeySecret: 'x' }))).status).toBe(400);
    expect((await request(app).delete(`${SM}/ApiKeys/${id}`)).status).toBe(204);
    expect((await request(app).get(`${SM}/ApiKeys/${id}`)).status).toBe(404);
  });

  it('rejects a key without a name or security profile; read-only profiles cannot write', async () => {
    expect((await request(app).post(`${SM}/ApiKeys`).send({ comment: 'no name' })).status).toBe(400);
    expect((await request(app).post(`${SM}/ApiKeys`).send({ name: 'Empty', securityProfiles: [] })).status).toBe(400);
    expect((await request(strictApp(ProfileMode.STANDARD_READONLY)).post(`${SM}/ApiKeys`).send({ name: 'RO' })).status).toBe(403);
  });
});

describe('Intune remote actions', () => {
  let app: Express;
  let intune: string;
  let local: string;
  beforeAll(async () => {
    app = strictApp(ProfileMode.STANDARD_READWRITE);
    const endpoints = (await request(app).get(`${EP}/WindowsEndpoints?PageSize=500`)).body.data as Item[];
    intune = endpoints.find((e) => e['coManagement'] === 'Intune')?.['id'] as string;
    local = endpoints.find((e) => e['coManagement'] === 'None')?.['id'] as string;
  });

  it('some endpoints are co-managed with Intune', async () => {
    const endpoint = (await request(app).get(`${EP}/WindowsEndpoints/${intune}`)).body as Item;
    expect(endpoint).toMatchObject({ coManagement: 'Intune', modernManagementState: 'ManagedAndBaramundiAgentInstalled', entraIdDeviceId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
  });

  it.each(['Sync', 'Reboot', 'Retire', 'WindowsAutopilotReset', 'FreshRestart', 'Wipe'])('%s: true for an Intune endpoint, 409 otherwise', async (action) => {
    expect((await request(app).post(`${EP}/WindowsEndpoints/${intune}/IntuneRemoteAction${action}`)).body).toBe(true);
    expect((await request(app).post(`${EP}/WindowsEndpoints/${local}/IntuneRemoteAction${action}`)).status).toBe(409);
    expect((await request(app).post(`${EP}/WindowsEndpoints/00000000-0000-0000-0000-000000000000/IntuneRemoteAction${action}`)).status).toBe(404);
  });

  it('takes the flags of its body only', async () => {
    expect((await request(app).post(`${EP}/WindowsEndpoints/${intune}/IntuneRemoteActionWipe`).send({ keepUserData: true, keepEnrollmentData: false })).body).toBe(true);
    expect((await request(app).post(`${EP}/WindowsEndpoints/${intune}/IntuneRemoteActionFreshRestart`).send({ keepEnrollmentData: true })).status).toBe(400);
    expect((await request(app).post(`${EP}/WindowsEndpoints/${intune}/IntuneRemoteActionWipe`).send({ keepUserData: 'yes' })).status).toBe(400);
  });

  it('read-only profiles reject them, as every POST', async () => {
    expect((await request(strictApp(ProfileMode.STANDARD_READONLY)).post(`${EP}/WindowsEndpoints/${intune}/IntuneRemoteActionSync`)).status).toBe(403);
  });
});

describe('not before 26R2', () => {
  it.each([`${UDG}/Thresholds`, `${SM}/ApiKeys/ac011111-0000-0000-0000-000000000001`])('%s is no route of 26R1', async (url) => {
    expect((await request(strictApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1)).get(url)).status).toBe(404);
  });
});
