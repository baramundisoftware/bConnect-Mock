/**
 * JSON Patch paths are case-insensitive, as on a live bMS (ASP.NET Core JsonPatch: an exact match
 * first, then ignoring case): the 26R2 spec's own examples write `/Value`, `/IsActive`. Each
 * segment maps onto the patched resource's real property name.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { resolvePatchPath } from '../../src/middleware/jsonPatch';
import type { Express } from 'express';

type Item = Record<string, unknown>;

function strictApp(): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R2); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

const patch = (app: Express, url: string, ops: Array<[string, unknown]>): request.Test =>
  request(app).patch(url).set('Content-Type', 'application/json-patch+json').send(ops.map(([path, value]) => ({ op: 'replace', path, value })));

beforeAll(() => {
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('JSON Patch paths in PascalCase', () => {
  let app: Express;
  beforeEach(() => { app = strictApp(); });

  it('Thresholds: the spec example\'s paths apply; a field that is not modifiable is still a 400', async () => {
    const url = '/bconnect/universaldynamicgroups/v2.0/Thresholds';
    const id = ((await request(app).get(url)).body.data as Item[])[0]?.['id'] as string;
    const res = await patch(app, `${url}/${id}`, [['/Value', 3], ['/Type', 'LowerLimit'], ['/Severity', 'Info'], ['/IsActive', false], ['/Comment', 'From the spec example']]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ value: 3, type: 'LowerLimit', severity: 'Info', isActive: false, comment: 'From the spec example' });
    expect((await request(app).get(`${url}/${id}`)).body).toMatchObject({ value: 3, isActive: false });
    const fixed = await patch(app, `${url}/${id}`, [['/DynamicGroupId', id]]);
    expect(fixed.status).toBe(400);
    expect(fixed.headers['x-bconnect-mock-reason']).toMatch(/'dynamicGroupId'/);
  });

  it('ApiKeys: the spec example\'s paths apply, including IsAvailableViaGateway and SecurityProfiles', async () => {
    const url = '/bconnect/servermanagement/v2.0/ApiKeys';
    const id = ((await request(app).get(url)).body as Item[])[0]?.['id'] as string;
    const profile = ((await request(app).get('/bconnect/servermanagement/v2.0/SecurityProfiles')).body.data as Item[])[0]?.['id'];
    const res = await patch(app, `${url}/${id}`, [['/Name', 'Renamed key'], ['/ExpirationDate', '2027-12-31'], ['/Comment', 'Patched'], ['/IsActive', false], ['/IsAvailableViaGateway', true], ['/SecurityProfiles', [profile]]]);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Renamed key', expirationDate: '2027-12-31', comment: 'Patched', isActive: false, isAvailableViaGateway: true, securityProfiles: [profile] });
    expect((await patch(app, `${url}/${id}`, [['/ApiKeySecret', 'x']])).status).toBe(400);
  });

  it.each([
    ['assets', '/v2.0/AssetStock/Folders'], ['assets', '/v2.0/AssetTypes/Folders'],
    ['endpoints', '/v2.0/WindowsEndpoints'], ['endpoints', '/v2.0/LinuxEndpoints'], ['endpoints', '/v2.0/MacEndpoints'],
    ['endpoints', '/v2.0/AndroidEndpoints'], ['endpoints', '/v2.0/IosEndpoints'], ['endpoints', '/v2.0/NetworkEndpoints'],
    ['endpoints', '/v2.0/LogicalGroups'], ['jobs', '/v2.0/Folders'], ['operatingsystems', '/v2.0/Folders'],
    ['servermanagement', '/v2.0/SecurityProfiles'], ['software', '/v2.0/Bundle/Folders'], ['variables', '/v2.0/VariableDefinitions'],
  ])('%s %s: /Comment applies (was silently dropped)', async (module, path) => {
    const url = `/bconnect/${module}${path}`;
    const list = (await request(app).get(url)).body as Item[] | { data: Item[] };
    const id = (Array.isArray(list) ? list : list.data)[0]?.['id'] as string;
    const res = await patch(app, `${url}/${id}`, [['/Comment', 'PascalCase path']]);
    expect(res.status).toBe(200);
    expect((await request(app).get(`${url}/${id}`)).body['comment']).toBe('PascalCase path');
  });
});

describe('resolvePatchPath', () => {
  const shape = { o: { isAvailableViaGateway: 0, securityProfiles: { a: 0 }, uuid: 0, maintenanceWindow: { o: { startTime: 0 }, z: [] } }, z: [] } as const;
  it('maps each segment onto the real property name, an exact match first', () => {
    expect(resolvePatchPath('/IsAvailableViaGateway', shape)).toBe('isAvailableViaGateway');
    expect(resolvePatchPath('/SECURITYPROFILES', shape)).toBe('securityProfiles');
    expect(resolvePatchPath('/UUID', shape)).toBe('uuid');
    expect(resolvePatchPath('/MaintenanceWindow/StartTime', shape)).toBe('maintenanceWindow/startTime');
  });
  it('without a known property, only drops the leading capital', () => {
    expect(resolvePatchPath('/DynamicGroupId', shape)).toBe('dynamicGroupId');
    expect(resolvePatchPath('/Comment', undefined)).toBe('comment');
  });
});
