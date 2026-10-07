/**
 * Large-scale profiles serve generated data. Items from a generated list must be fetchable by ID,
 * and sub-resources and lists without a generator must answer, as on the standard profiles.
 * (Before, getFixture() returned [] on large-scale, so all of these answered 404.)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe.each([BmsVersion.BMS_25R2, BmsVersion.BMS_26R1])('largescale-readonly by ID (%s)', (version) => {
  let app: Express;

  beforeAll(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const previous = process.env.BCONNECT_MODULE_ROUTING;
    process.env.BCONNECT_MODULE_ROUTING = 'strict';
    try { app = createApp(ProfileMode.LARGESCALE_READONLY, version); } finally {
      if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
    }
  });

  it.each([
    ['endpoints', 'WindowsEndpoints'],
    ['jobs', 'JobDefinitions'],
    ['jobs', 'JobInstances'],
    ['endpoints', 'LogicalGroups'],
    ['activedirectory', 'ADUsers'],
  ])('/%s/v2.0/%s/{id} answers 200 for an ID from the list', async (module, entity) => {
    const list = await request(app).get(`/bconnect/${module}/v2.0/${entity}?PageSize=5&Page=3`);
    expect(list.status).toBe(200);
    const id = (list.body.data as Array<{ id: string }>)[2]?.id as string;
    const item = await request(app).get(`/bconnect/${module}/v2.0/${entity}/${id}`);
    expect(item.status).toBe(200);
    expect(item.body.id).toBe(id);
  });

  it('answers sub-resources of a generated parent', async () => {
    const groups = await request(app).get('/bconnect/endpoints/v2.0/LogicalGroups?PageSize=1');
    const id = (groups.body.data as Array<{ id: string }>)[0]?.id as string;
    const res = await request(app).get(`/bconnect/endpoints/v2.0/LogicalGroups/${id}/WindowsEndpoints`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('answers lists without a generator from the standard fixtures', async () => {
    for (const path of ['/bconnect/servermanagement/v2.0/SecurityGroups', '/bconnect/activedirectory/v2.0/OrgUnits']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(200);
      expect(res.body.totalItems).toBeGreaterThan(0);
    }
  });
});
