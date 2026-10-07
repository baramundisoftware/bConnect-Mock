/**
 * Trees as on a live bMS (26R1 probe, 2026-10-07): the top items of logical groups, org units and
 * folders point to a hidden root node of their module, every item names its parent, and the
 * hidden node itself answers 404, by ID and for its children.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { withHiddenTreeRoot } from '../../src/profiles/treeRoots';
import type { Express } from 'express';

const TREES: Array<[string, string, string, string]> = [
  // list route, children route segment, hidden root ID, hidden root name
  ['/bconnect/endpoints/v2.0/LogicalGroups', 'LogicalGroups', '299d0b30-d384-430c-875a-63c3ef73a150', '[environment]'],
  ['/bconnect/activedirectory/v2.0/OrgUnits', 'OrgUnits', '299d0b30-d384-430c-875a-63c3ef73a150', '[environment]'],
  ['/bconnect/universaldynamicgroups/v2.0/UniversalDynamicGroupsFolder', 'Folders', '299d0b30-d384-430c-875a-63c3ef73a150', '[environment]'],
  ['/bconnect/jobs/v2.0/Folders', 'Folders', '8e5102e3-c2e1-47ba-ad76-295d3df9ef31', '[Jobs Module]'],
  ['/bconnect/operatingsystems/v2.0/Folders', 'Folders', '5f77955e-26a4-4a91-9b99-a4833a2e8cf6', '[Modul OS-Install]'],
  ['/bconnect/assets/v2.0/AssetStock/Folders', 'Folders', 'dc3233ba-487d-4ef9-969f-7cead5afd814', '[InventoryAssets]'],
  ['/bconnect/assets/v2.0/AssetTypes/Folders', 'Folders', 'dc3233ba-487d-4ef9-969f-7cead5afd814', '[InventoryAssets]'],
  ['/bconnect/software/v2.0/Bundle/Folders', 'Folders', 'e09ee6e7-3be1-44de-a28c-43e958378f72', '[Modul Deploy]'],
];

function strictApp(mode: ProfileMode): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, BmsVersion.BMS_26R1); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('withHiddenTreeRoot', () => {
  it('points top items to the hidden root and names every parent', () => {
    expect(withHiddenTreeRoot('jobFolders', [
      { id: 'a', name: 'Top', parentId: null },
      { id: 'b', name: 'Child', parentId: 'a' },
    ])).toEqual([
      { id: 'a', name: 'Top', parentId: '8e5102e3-c2e1-47ba-ad76-295d3df9ef31', parent: '[Jobs Module]' },
      { id: 'b', name: 'Child', parentId: 'a', parent: 'Top' },
    ]);
  });

  it('leaves other entity types alone', () => {
    const items = [{ id: 'a', parentId: null }];
    expect(withHiddenTreeRoot('bundles', items)).toBe(items);
  });
});

describe.each([ProfileMode.STANDARD_READONLY, ProfileMode.LARGESCALE_READONLY])('trees (%s, strict)', (mode) => {
  let app: Express;
  beforeAll(() => { app = strictApp(mode); });

  it.each(TREES)('%s: no null parent; top items point to the hidden root', async (list, children, rootId, rootName) => {
    const res = await request(app).get(`${list}?PageSize=1000`);
    expect(res.status).toBe(200);
    const items = res.body.data as Array<{ id: string; name: string; parentId: string; parent?: string }>;
    expect(items.length).toBeGreaterThan(0);
    const ids = new Set(items.map((i) => i.id));
    for (const item of items) { expect(item.parentId).toEqual(expect.any(String)); }
    const top = items.filter((i) => !ids.has(i.parentId));
    expect(top.length).toBeGreaterThan(0);
    for (const item of top) {
      expect(item.parentId).toBe(rootId);
      if ('parent' in item) { expect(item.parent).toBe(rootName); }
    }
    await request(app).get(`${list}/${rootId}`).expect(404);
    await request(app).get(`${list}/${rootId}/${children}`).expect(404);
  });
});

describe('created and moved tree items (standard-readwrite)', () => {
  let app: Express;
  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1); });

  it('a new top item gets the hidden root; a child names its parent; a move renames the parent', async () => {
    const top = await request(app).post('/v2.0/LogicalGroups').send({ name: 'Top', parentId: null }).expect(201);
    expect(top.body).toMatchObject({ parentId: '299d0b30-d384-430c-875a-63c3ef73a150', parent: '[environment]' });
    const child = await request(app).post('/v2.0/LogicalGroups').send({ name: 'Child', parentId: top.body.id }).expect(201);
    expect(child.body.parent).toBe('Top');
    const folder = await request(app).post('/v2.0/Folders').send({ name: 'Jobs top' }).expect(201);
    expect(folder.body).toMatchObject({ parentId: '8e5102e3-c2e1-47ba-ad76-295d3df9ef31', parent: '[Jobs Module]' });
    const moved = await request(app).patch(`/v2.0/Folders/${folder.body.id as string}`)
      .send([{ op: 'replace', path: '/parentId', value: null }]).expect(200);
    expect(moved.body.parentId).toBe('8e5102e3-c2e1-47ba-ad76-295d3df9ef31');
  });
});
