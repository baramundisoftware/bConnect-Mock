/**
 * Sprint 13.2.10 — Scoped sub-resource route integration tests.
 *
 * Covers all routes registered in src/routes/subResources.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

const UNKNOWN_GUID = '00000000-0000-0000-0000-000000000099';
const BAD_ID = 'not-a-guid';

/** Helper: verify a sub-resource GET responds correctly */
async function testSubResource(
  app: Express,
  parentPath: string,
  parentId: string,
  child: string
): Promise<void> {
  const res = await request(app).get(`${parentPath}/${parentId}/${child}`).expect(200);
  expect(res.body).toHaveProperty('data');
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body).toHaveProperty('totalItems');

  await request(app).get(`${parentPath}/${UNKNOWN_GUID}/${child}`).expect(404);
  await request(app).get(`${parentPath}/${BAD_ID}/${child}`).expect(400);
}

describe('Endpoints sub-resources (P13.2.10)', () => {
  let app: Express;
  let endpointId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/v2.0/WindowsEndpoints');
    endpointId = res.body.data[0].id;
  });

  it('GET Endpoints/:id/JobInstances returns 200', () =>
    testSubResource(app, '/v2.0/Endpoints', endpointId, 'JobInstances'));

  it('GET Endpoints/:id/KioskReleases returns 200', () =>
    testSubResource(app, '/v2.0/Endpoints', endpointId, 'KioskReleases'));

  it('GET Endpoints/:id/VariableInstances returns 200', () =>
    testSubResource(app, '/v2.0/Endpoints', endpointId, 'VariableInstances'));
});

describe('WindowsEndpoints sub-resources (P13.2.10)', () => {
  let app: Express;
  let windowsId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/v2.0/WindowsEndpoints');
    windowsId = res.body.data[0].id;
  });

  it('GET WindowsEndpoints/:id/InstalledWindowsSoftware returns 200', () =>
    testSubResource(app, '/v2.0/WindowsEndpoints', windowsId, 'InstalledWindowsSoftware'));
});

describe('JobDefinitions sub-resources (P13.2.10)', () => {
  let app: Express;
  let jobId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/v2.0/JobDefinitions');
    jobId = res.body.data[0].id;
  });

  it('GET JobDefinitions/:id/JobInstances returns 200', () =>
    testSubResource(app, '/v2.0/JobDefinitions', jobId, 'JobInstances'));

  it('GET JobDefinitions/:id/KioskReleases returns 200', () =>
    testSubResource(app, '/v2.0/JobDefinitions', jobId, 'KioskReleases'));
});

describe('ADObjects sub-resources (P13.2.10)', () => {
  let app: Express;
  let app26: Express;
  let adObjectId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    app26 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app).get('/v2.0/ADObjects');
    adObjectId = res.body.data[0].id;
  });

  it('GET ADObjects/:id/KioskReleases returns 200', () =>
    testSubResource(app, '/v2.0/ADObjects', adObjectId, 'KioskReleases'));

  it('GET ADObjects/:id/Assets returns 200 (26R1 only)', () =>
    testSubResource(app26, '/v2.0/ADObjects', adObjectId, 'Assets'));

  it('GET ADObjects/:id/VariableInstances returns 200', () =>
    testSubResource(app, '/v2.0/ADObjects', adObjectId, 'VariableInstances'));

  it('GET ADObjects/:id/ADGroupMemberships returns 200', () =>
    testSubResource(app, '/v2.0/ADObjects', adObjectId, 'ADGroupMemberships'));
});

describe('ADGroups sub-resources (P13.2.10)', () => {
  let app: Express;
  let adGroupId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/v2.0/ADGroups');
    adGroupId = res.body.data[0].id;
  });

  it('GET ADGroups/:id/ADGroups returns 200', () =>
    testSubResource(app, '/v2.0/ADGroups', adGroupId, 'ADGroups'));

  it('GET ADGroups/:id/ADObjects returns 200', () =>
    testSubResource(app, '/v2.0/ADGroups', adGroupId, 'ADObjects'));

  it('GET ADGroups/:id/ADUsers returns 200', () =>
    testSubResource(app, '/v2.0/ADGroups', adGroupId, 'ADUsers'));
});

describe('LogicalGroups extended sub-resources (P13.2.10)', () => {
  let app: Express;
  let groupId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/v2.0/LogicalGroups');
    groupId = res.body.data[0].id;
  });

  it('GET LogicalGroups/:id/Assets returns 200', () =>
    testSubResource(app, '/v2.0/LogicalGroups', groupId, 'Assets'));

  it('GET LogicalGroups/:id/JobInstances returns 200', () =>
    testSubResource(app, '/v2.0/LogicalGroups', groupId, 'JobInstances'));

  it('GET LogicalGroups/:id/KioskReleases returns 200', () =>
    testSubResource(app, '/v2.0/LogicalGroups', groupId, 'KioskReleases'));

  it('GET LogicalGroups/:id/InstalledWindowsSoftware returns 200', () =>
    testSubResource(app, '/v2.0/LogicalGroups', groupId, 'InstalledWindowsSoftware'));

  it('GET LogicalGroups/:id/VariableInstances returns 200', () =>
    testSubResource(app, '/v2.0/LogicalGroups', groupId, 'VariableInstances'));
});

describe('OrgUnits sub-resources (P13.2.10)', () => {
  let app: Express;
  let app26: Express;
  let orgUnitId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    app26 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app).get('/v2.0/OrgUnits');
    orgUnitId = res.body.data[0].id;
  });

  it('GET OrgUnits/:id/ADGroups returns 200', () =>
    testSubResource(app, '/v2.0/OrgUnits', orgUnitId, 'ADGroups'));

  it('GET OrgUnits/:id/ADObjects returns 200', () =>
    testSubResource(app, '/v2.0/OrgUnits', orgUnitId, 'ADObjects'));

  it('GET OrgUnits/:id/ADUsers returns 200', () =>
    testSubResource(app, '/v2.0/OrgUnits', orgUnitId, 'ADUsers'));

  it('GET OrgUnits/:id/OrgUnits returns 200', () =>
    testSubResource(app, '/v2.0/OrgUnits', orgUnitId, 'OrgUnits'));

  it('GET OrgUnits/:id/Assets returns 200 (26R1 only)', () =>
    testSubResource(app26, '/v2.0/OrgUnits', orgUnitId, 'Assets'));
});

describe('StaticGroups/DynamicGroups sub-resources (P13.2.10)', () => {
  let app: Express;
  let staticGroupId: string;
  let dynamicGroupId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const sr = await request(app).get('/v2.0/StaticGroups');
    staticGroupId = sr.body.data[0].id;
    const dr = await request(app).get('/v2.0/DynamicGroups');
    dynamicGroupId = dr.body.data[0].id;
  });

  it('GET StaticGroups/:id/JobInstances returns 200', () =>
    testSubResource(app, '/v2.0/StaticGroups', staticGroupId, 'JobInstances'));

  it('GET DynamicGroups/:id/JobInstances returns 200', () =>
    testSubResource(app, '/v2.0/DynamicGroups', dynamicGroupId, 'JobInstances'));
});

describe('Folders sub-resources (P13.2.10)', () => {
  let app: Express;
  let folderId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const res = await request(app).get('/v2.0/Folders');
    folderId = res.body.data[0].id;
  });

  it('GET Folders/:id/JobDefinitions returns 200', () =>
    testSubResource(app, '/v2.0/Folders', folderId, 'JobDefinitions'));
});

describe('MicrosoftDefender sub-resources (P13.2.10)', () => {
  let app: Express;
  let groupId: string;
  let windowsId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY);
    const gr = await request(app).get('/v2.0/LogicalGroups');
    groupId = gr.body.data[0].id;
    const wr = await request(app).get('/v2.0/WindowsEndpoints');
    windowsId = wr.body.data[0].id;
  });

  it('GET MicrosoftDefender/LogicalGroups/:id/Threats returns 200', () =>
    testSubResource(app, '/v2.0/MicrosoftDefender/LogicalGroups', groupId, 'Threats'));

  it('GET MicrosoftDefender/WindowsEndpoints/:id/Threats returns 200', () =>
    testSubResource(app, '/v2.0/MicrosoftDefender/WindowsEndpoints', windowsId, 'Threats'));
});

describe('Bundle/Folders sub-resources (P13.2.10)', () => {
  let app: Express;
  let bundleFolderId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app).get('/v2.0/Bundle/Folders');
    bundleFolderId = res.body.data[0].id;
  });

  it('GET Bundle/Folders/:id/Folders returns 200', () =>
    testSubResource(app, '/v2.0/Bundle/Folders', bundleFolderId, 'Folders'));
});

describe('26R1-only sub-resources (P13.2.10)', () => {
  let app: Express;
  let folderId: string;
  let udGroupId: string;
  let bundleId: string;
  let windowsId: string;
  let endpointId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const fr = await request(app).get('/v2.0/UniversalDynamicGroupsFolder');
    folderId = fr.body.data[0].id;
    const ur = await request(app).get('/v2.0/UniversalDynamicGroups');
    udGroupId = ur.body.data[0].id;
    const br = await request(app).get('/v2.0/Bundles');
    bundleId = br.body.data[0].id;
    const wr = await request(app).get('/v2.0/WindowsEndpoints');
    windowsId = wr.body.data[0].id;
    endpointId = windowsId;
  });

  it('GET Folders/:id/UniversalDynamicGroups returns 200', () =>
    testSubResource(app, '/v2.0/Folders', folderId, 'UniversalDynamicGroups'));

  it('GET UniversalDynamicGroups/:id/JobInstances returns 200', () =>
    testSubResource(app, '/v2.0/UniversalDynamicGroups', udGroupId, 'JobInstances'));

  it('GET UniversalDynamicGroups/:id/InstalledWindowsSoftware returns 200', () =>
    testSubResource(app, '/v2.0/UniversalDynamicGroups', udGroupId, 'InstalledWindowsSoftware'));

  it('GET Bundles/:id/BundleApplications returns 200', () =>
    testSubResource(app, '/v2.0/Bundles', bundleId, 'BundleApplications'));

  it('GET Endpoints/:id/DetectedRuleViolations returns 200', () =>
    testSubResource(app, '/v2.0/Endpoints', endpointId, 'DetectedRuleViolations'));

  it('GET WindowsEndpoints/:id/DetectedVulnerabilities returns 200', () =>
    testSubResource(app, '/v2.0/WindowsEndpoints', windowsId, 'DetectedVulnerabilities'));
});
