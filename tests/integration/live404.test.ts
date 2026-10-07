/**
 * 404 answers word for word as a live 26R1 bMS gives them (probe version 6, 2026-10-07):
 * the typed answers for hidden tree roots, the routes with a bare "Not Found", the Microservice
 * wording, the empty list of JobDefinitions/{id}/KioskReleases, and rule violations, which exist
 * only for iOS, Android and Mac endpoints.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

const ZERO = '00000000-0000-0000-0000-000000000000';
const MISSING = 'not found or not visible due to missing rights.';

function strictApp(mode = ProfileMode.STANDARD_READONLY): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, BmsVersion.BMS_26R1); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

const body = (res: request.Response): Record<string, unknown> => JSON.parse(res.text) as Record<string, unknown>;

let app: Express;
beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); app = strictApp(); });

describe('hidden tree roots answer the typed 404, ID in upper case', () => {
  const ENV = '299d0b30-d384-430c-875a-63c3ef73a150';
  it.each([
    ['/bconnect/activedirectory/v2.0/OrgUnits', ENV, 'OrgUnits', 'OrgUnit'],
    ['/bconnect/universaldynamicgroups/v2.0/UniversalDynamicGroupsFolder', ENV, 'Folders', 'OrgUnit'],
    ['/bconnect/jobs/v2.0/Folders', '8e5102e3-c2e1-47ba-ad76-295d3df9ef31', 'Folders', 'job folder'],
    ['/bconnect/operatingsystems/v2.0/Folders', '5f77955e-26a4-4a91-9b99-a4833a2e8cf6', 'Folders', 'operating system folder'],
    ['/bconnect/assets/v2.0/AssetStock/Folders', 'dc3233ba-487d-4ef9-969f-7cead5afd814', 'Folders', 'asset stock folder'],
    ['/bconnect/assets/v2.0/AssetTypes/Folders', 'dc3233ba-487d-4ef9-969f-7cead5afd814', 'Folders', 'asset type folder'],
    ['/bconnect/software/v2.0/Bundle/Folders', 'e09ee6e7-3be1-44de-a28c-43e958378f72', 'Folders', 'software bundle folder'],
  ])('%s/{hidden root} and its children', async (list, id, children, type) => {
    for (const path of [`${list}/${id}`, `${list}/${id}/${children}`]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/^application\/json/);
      expect(body(res)).toMatchObject({ type: 'https://httpstatuses.io/404', title: 'Not Found', status: 404, detail: `${type} [${id.toUpperCase()}] ${MISSING}` });
    }
  });

  it('logical groups: problem+json, "Object [ID] …"', async () => {
    for (const path of [`/bconnect/endpoints/v2.0/LogicalGroups/${ENV}`, `/bconnect/endpoints/v2.0/LogicalGroups/${ENV}/LogicalGroups`]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(body(res)).toMatchObject({ title: `Object [${ENV.toUpperCase()}] ${MISSING}` });
    }
  });

  it('an unknown ID on a tree route gets the generic answer', async () => {
    const res = await request(app).get(`/bconnect/jobs/v2.0/Folders/${ZERO}`);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(body(res)).toMatchObject({ title: `Object [${ZERO}] ${MISSING}` });
  });
});

describe('the exceptions', () => {
  it.each([
    `/bconnect/compliance/v2.0/Endpoints/${ZERO}/DetectedRuleViolations`,
    `/bconnect/compliance/v2.0/WindowsEndpoints/${ZERO}/DetectedVulnerabilities`,
    `/bconnect/endpoints/v2.0/EntraIdData/${ZERO}`,
  ])('%s: bare "Not Found"', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    const b = body(res);
    expect(b).toMatchObject({ type: 'https://httpstatuses.io/404', title: 'Not Found', status: 404 });
    expect(b).not.toHaveProperty('detail');
  });

  it('Microservices/{id}: its own wording', async () => {
    const res = await request(app).get(`/bconnect/servermanagement/v2.0/Microservices/${ZERO}`);
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(body(res)).toMatchObject({ title: 'Not Found', detail: `Microservice with id [${ZERO}] not found.` });
  });

  it('JobDefinitions/{unknown}/KioskReleases: 200 with an empty list', async () => {
    const res = await request(app).get(`/bconnect/jobs/v2.0/JobDefinitions/${ZERO}/KioskReleases`).expect(200);
    expect(res.body).toMatchObject({ data: [], totalItems: 0 });
  });
});

describe('rule violations exist only for iOS, Android and Mac endpoints', () => {
  it('every violation points to such an endpoint, and each endpoint lists its own', async () => {
    const all = await request(app).get('/bconnect/compliance/v2.0/DetectedRuleViolations?PageSize=1000').expect(200);
    const violations = all.body.data as Array<{ endpointId: string }>;
    expect(violations.length).toBeGreaterThan(0);
    for (const v of violations) {
      const res = await request(app).get(`/bconnect/compliance/v2.0/Endpoints/${v.endpointId}/DetectedRuleViolations`).expect(200);
      expect((res.body.data as Array<{ endpointId: string }>).every((x) => x.endpointId === v.endpointId)).toBe(true);
    }
  });

  it('a Windows endpoint answers the bare 404', async () => {
    const windows = await request(app).get('/bconnect/endpoints/v2.0/WindowsEndpoints?PageSize=1');
    const res = await request(app).get(`/bconnect/compliance/v2.0/Endpoints/${windows.body.data[0].id as string}/DetectedRuleViolations`);
    expect(res.status).toBe(404);
    expect(body(res)).toMatchObject({ title: 'Not Found' });
  });

  it('on largescale too', async () => {
    const large = strictApp(ProfileMode.LARGESCALE_READONLY);
    const all = await request(large).get('/bconnect/compliance/v2.0/DetectedRuleViolations?PageSize=3').expect(200);
    for (const v of all.body.data as Array<{ endpointId: string }>) {
      await request(large).get(`/bconnect/compliance/v2.0/Endpoints/${v.endpointId}/DetectedRuleViolations`).expect(200);
    }
  });
});
