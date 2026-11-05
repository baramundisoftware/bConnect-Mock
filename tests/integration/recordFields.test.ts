/**
 * Assets, asset types, job definitions, job instances, installed software, DIPs, security profiles
 * and variable definitions carry the fields a live bMS fills (formats from a 26R1 probe, 2026-11-02);
 * AD objects, the gateway, the VPN appliance, security groups and variables those of a live 26R2
 * (pre-release 26.2.110.0, 2026-11-05).
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { withRecordFields } from '../../src/profiles/recordFields';
import { roll, seedOf } from '../../src/profiles/seeded';
import type { Express } from 'express';

type Item = Record<string, unknown>;

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('record fields', () => {
  let app: Express;
  beforeAll(() => {
    const previous = process.env.BCONNECT_MODULE_ROUTING;
    process.env.BCONNECT_MODULE_ROUTING = 'strict';
    try { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); } finally {
      if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
    }
  });

  it('assets: their asset type by name, properties from the asset, the live defaults', async () => {
    const assets = (await request(app).get('/bconnect/assets/v2.0/Assets')).body.data as Item[];
    const types = (await request(app).get('/bconnect/assets/v2.0/AssetTypes')).body.data as Item[];
    const laptop = assets.find((a) => a['assetTypeName'] === 'Laptop') as Item;
    expect(laptop['assetTypeId']).toBe(types.find((t) => t['name'] === 'Laptop')?.['guid']);
    expect(laptop).toMatchObject({ assetReferenceList: [], energyOn: -1, energyOff: -1, operatingCost: 0, purchasePrice: 0, url: 'http://' });
    expect(laptop['additionalProperties']).toEqual(expect.arrayContaining([{ name: 'Location', type: 'String', value: expect.any(String) }]));
    expect(laptop['lastChanged']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('asset types: a parent folder the profile has', async () => {
    const types = (await request(app).get('/bconnect/assets/v2.0/AssetTypes')).body.data as Item[];
    const folders = (await request(app).get('/bconnect/assets/v2.0/AssetTypes/Folders')).body.data as Item[];
    for (const t of types) {
      expect(folders.map((f) => f['id'])).toContain(t['guidParent']);
      expect(t).toMatchObject({ energyOptions: '0', url: 'http://' });
    }
  });

  it('job instances: steps that match the instance\'s state', async () => {
    const instances = (await request(app).get('/bconnect/jobs/v2.0/JobInstances')).body.data as Item[];
    for (const i of instances) {
      const steps = i['steps'] as Item[];
      expect(i['delays']).toBe(0);
      expect(steps.length).toBeGreaterThan(0);
      if (i['state'] === 'FinishedSuccessfully') { expect(steps.every((s) => s['state'] === 'FinishedSuccessfully')).toBe(true); }
      if (i['state'] === 'FinishedWithError') { expect(steps.at(-1)?.['state']).toBe('FinishedWithError'); }
      if (i['state'] === 'Queued') { expect(steps.every((s) => s['state'] === 'Queued' && s['lastAction'] === null)).toBe(true); }
    }
  });

  it('installed software: managed with an application, or inventoried', async () => {
    const software = (await request(app).get('/bconnect/software/v2.0/InstalledWindowsSoftware')).body.data as Item[];
    expect(new Set(software.map((s) => s['source']))).toEqual(new Set(['ManagedSoftware', 'Inventoried']));
    for (const s of software) {
      expect(s).toMatchObject({ autUsage: 'AutDeactivated', detectionRuleId: expect.any(String) });
      expect(s['applicationId'] === null).toBe(s['source'] === 'Inventoried');
    }
  });

  it('large-scale: assets owned by an endpoint, job definitions in a folder the profile has', async () => {
    const previous = process.env.BCONNECT_MODULE_ROUTING;
    process.env.BCONNECT_MODULE_ROUTING = 'strict';
    let large: Express;
    try { large = createApp(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_26R1); } finally {
      if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
    }
    const asset = ((await request(large).get('/bconnect/assets/v2.0/Assets?PageSize=5')).body.data as Item[])[0] as Item;
    expect(asset).toMatchObject({ ownerType: 'Machine', ownerId: expect.any(String) });
    const owner = (await request(large).get(`/bconnect/endpoints/v2.0/WindowsEndpoints/${asset['ownerId'] as string}`)).body as Item;
    expect(asset['ownerName']).toBe(owner['displayName']);
    const folders = new Map(((await request(large).get('/bconnect/jobs/v2.0/Folders')).body.data as Item[]).map((f) => [f['id'], f['name']]));
    for (const job of (await request(large).get('/bconnect/jobs/v2.0/JobDefinitions?PageSize=50')).body.data as Item[]) {
      expect(folders.get(job['folderId'])).toBe(job['folder']);
    }
  });

  it('DIPs, security profiles and variable definitions: what the live bMS fills', async () => {
    const [dip] = (await request(app).get('/bconnect/servermanagement/v2.0/Dips')).body as Item[];
    expect(dip).toMatchObject({ details: '', lastUpdate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/) });
    for (const p of (await request(app).get('/bconnect/servermanagement/v2.0/SecurityProfiles')).body.data as Item[]) {
      expect(p).toMatchObject({ displayAdministratorIdentities: expect.any(Boolean), displayEndpointUserIdentities: true });
    }
    const instances = (await request(app).get('/bconnect/variables/v2.0/VariableInstances')).body.data as Item[];
    for (const d of (await request(app).get('/bconnect/variables/v2.0/VariableDefinitions')).body.data as Item[]) {
      const own = instances.filter((i) => i['variableDefinitionId'] === d['id']).map((i) => i['scope']);
      expect(d['scopes']).toEqual(own.length ? [...new Set(own)] : ['Endpoint']);
    }
  });

  it('keeps a value the item has; decisions about one item are independent', () => {
    const item = { id: 'j1', comment: 'kept' };
    expect(withRecordFields('jobs', item, () => [])['comment']).toBe('kept');
    expect(withRecordFields('windowsUpdates', item, () => [])).toBe(item);
    const h = seedOf('a0000001-0001-0001-0001-000000000001');
    const rolls = Array.from({ length: 20 }, (_, salt) => roll(h, salt));
    expect(new Set(rolls).size).toBeGreaterThan(10);
  });
});

describe('record fields from the 26R2 probe', () => {
  const apps = new Map<ProfileMode, Express>();
  const appFor = (mode: ProfileMode): Express => {
    if (!apps.has(mode)) {
      const previous = process.env.BCONNECT_MODULE_ROUTING;
      process.env.BCONNECT_MODULE_ROUTING = 'strict';
      try { apps.set(mode, createApp(mode, BmsVersion.BMS_26R2)); } finally {
        if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
      }
    }
    return apps.get(mode) as Express;
  };
  const list = async (mode: ProfileMode, path: string): Promise<Item[]> => (await request(appFor(mode)).get(`/bconnect/${path}`)).body.data as Item[];

  it('AD users, groups and objects: a domain SID and the import comment; users with their distinguished name', async () => {
    for (const mode of [ProfileMode.STANDARD_READONLY, ProfileMode.LARGESCALE_READONLY]) {
      for (const entity of ['ADUsers', 'ADGroups', 'ADObjects']) {
        for (const item of await list(mode, `activedirectory/v2.0/${entity}?PageSize=20`)) {
          expect(item['sid']).toMatch(/^S-1-5-21-\d{10}-\d{10}-\d{8}-\d{4}$/);
          expect(item['comment']).toMatch(/^Synchronized from Active Directory/);
          expect(item['orgUnitId']).toEqual(expect.any(String));
        }
      }
      const user = (await list(mode, 'activedirectory/v2.0/ADUsers?PageSize=1'))[0] as Item;
      expect(user['ldapPath']).toContain(`CN=${user['name'] as string},`);
    }
  });

  it('gateway and VPN appliance: their states; security groups: one security profile the profile has', async () => {
    const app = appFor(ProfileMode.STANDARD_READONLY);
    const gateway = (await request(app).get('/bconnect/servermanagement/v2.0/Gateway')).body as Item;
    expect(gateway).toMatchObject({ availability: 'Up', configurationStatus: 'Enrolled' });
    expect(gateway['lastContact']).toMatch(/\.\d{7}Z$/);
    expect((await request(app).get('/bconnect/servermanagement/v2.0/VpnAppliance')).body).toMatchObject({ status: 'Ok' });
    const profiles = new Map((await list(ProfileMode.STANDARD_READONLY, 'servermanagement/v2.0/SecurityProfiles')).map((p) => [p['id'], p['name']]));
    for (const group of await list(ProfileMode.STANDARD_READONLY, 'servermanagement/v2.0/SecurityGroups')) {
      const assigned = group['assignedSecurityProfiles'] as Item[];
      expect(assigned).toHaveLength(1);
      expect(profiles.get(assigned[0]?.['id'])).toBe(assigned[0]?.['name']);
    }
  });

  it('variables: definitions with a category, instances with their definition\'s', async () => {
    const definitions = new Map((await list(ProfileMode.STANDARD_READONLY, 'variables/v2.0/VariableDefinitions')).map((d) => [d['id'], d]));
    for (const d of definitions.values()) { expect(d['category']).toEqual(expect.any(String)); }
    for (const i of await list(ProfileMode.STANDARD_READONLY, 'variables/v2.0/VariableInstances')) {
      expect(i['category']).toBe(definitions.get(i['variableDefinitionId'])?.['category']);
    }
    const withDefault = withRecordFields('variables', { id: 'a0000001-0000-0000-0000-00000000000a', values: ['Berlin'] }, () => []);
    expect([null, undefined, 'Berlin']).toContain(withDefault['defaultValue']);
  });
});
