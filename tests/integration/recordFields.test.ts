/**
 * Assets, asset types, job definitions, job instances and installed software carry the fields a
 * live bMS fills (formats from a 26R1 probe, 2026-11-02).
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

  it('keeps a value the item has; decisions about one item are independent', () => {
    const item = { id: 'j1', comment: 'kept' };
    expect(withRecordFields('jobs', item, () => [])['comment']).toBe('kept');
    expect(withRecordFields('logicalGroups', item, () => [])).toBe(item);
    const h = seedOf('a0000001-0001-0001-0001-000000000001');
    const rolls = Array.from({ length: 20 }, (_, salt) => roll(h, salt));
    expect(new Set(rolls).size).toBeGreaterThan(10);
  });
});
