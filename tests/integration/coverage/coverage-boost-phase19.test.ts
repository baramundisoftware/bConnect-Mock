/**
 * Coverage Boost — Phase 19
 *
 * Targets zero-coverage and low-branch-coverage gaps identified after Phase 18:
 *   - updateManagement.ts  — 0%   → full coverage (GET list, GET by ID, PATCH + 400/404)
 *   - compliance.ts        — 42%  → SearchQuery/OrderBy/pageSize branches, MobileDeviceRules paths
 *   - serverManagement.ts  — 53%  → 26R1 routes: ApiKeys, DownloadJobs, Dips actions
 *   - groups.ts            — 56%  → UDGFolder SearchQuery branch, 25R2 non-registration path
 *   - misc.ts              — 65%  → Folders SearchQuery/OrderBy/pageSize branches
 *   - defenseControl.ts    — 67%  → Defender 404 paths, LAPS 404 path
 *   - assets.ts            — 66%  → AssetStock filter path, VariableDefinitions aliases
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { BmsVersion, ProfileMode } from '../../../src/profiles/ProfileManager';

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE MANAGEMENT — full coverage (updateManagement.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('UpdateManagement routes (updateManagement.ts)', () => {
  let app: Express;
  let endpointId: string;

  beforeAll(async () => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
    const res = await request(app).get('/updatemanagement/v2.0/WindowsEndpoints').expect(200);
    endpointId = res.body.data[0].endpointId as string;
  });

  it('GET /updatemanagement/v2.0/WindowsEndpoints returns paginated list', async () => {
    const res = await request(app).get('/updatemanagement/v2.0/WindowsEndpoints').expect(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('pageSize');
    expect(res.body).toHaveProperty('page');
  });

  it('GET list returns update-projection schema (not full endpoint)', async () => {
    const res = await request(app).get('/updatemanagement/v2.0/WindowsEndpoints').expect(200);
    const item = res.body.data[0] as Record<string, unknown>;
    expect(item).toHaveProperty('endpointId');
    expect(item).toHaveProperty('updateState');
    expect(item).toHaveProperty('missingCriticalUpdates');
    // Must NOT contain raw endpoint fields
    expect(item).not.toHaveProperty('hostName');
    expect(item).not.toHaveProperty('operatingSystem');
  });

  it('GET list — SearchQuery branch', async () => {
    const res = await request(app)
      .get('/updatemanagement/v2.0/WindowsEndpoints?SearchQuery=WIN')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET list — PageSize pagination branch', async () => {
    const res = await request(app)
      .get('/updatemanagement/v2.0/WindowsEndpoints?PageSize=1&Page=0')
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pageSize).toBe(1);
  });

  it('GET /updatemanagement/v2.0/WindowsEndpoints/:id returns single projection', async () => {
    const res = await request(app)
      .get(`/updatemanagement/v2.0/WindowsEndpoints/${endpointId}`)
      .expect(200);
    expect(res.body).toHaveProperty('endpointId', endpointId);
    expect(res.body).toHaveProperty('updateState');
  });

  it('GET /:id returns 400 for invalid GUID', async () => {
    await request(app)
      .get('/updatemanagement/v2.0/WindowsEndpoints/not-a-guid')
      .expect(400);
  });

  it('GET /:id returns 404 for unknown GUID', async () => {
    await request(app)
      .get('/updatemanagement/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('PATCH /:id merges body into projection (readwrite)', async () => {
    const rwApp = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
    const list = await request(rwApp).get('/updatemanagement/v2.0/WindowsEndpoints').expect(200);
    const id = list.body.data[0].endpointId as string;
    const res = await request(rwApp)
      .patch(`/updatemanagement/v2.0/WindowsEndpoints/${id}`)
      .send({ updateProfileId: 'profile-001' })
      .expect(200);
    expect(res.body).toHaveProperty('endpointId', id);
  });

  it('PATCH /:id returns 400 for invalid GUID', async () => {
    const rwApp = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
    await request(rwApp)
      .patch('/updatemanagement/v2.0/WindowsEndpoints/bad-id')
      .send({})
      .expect(400);
  });

  it('PATCH /:id returns 404 for unknown GUID', async () => {
    const rwApp = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
    await request(rwApp)
      .patch('/updatemanagement/v2.0/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
      .send({})
      .expect(404);
  });
});

describe('UpdateManagement — 25R2 profile (routes still registered)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  });

  it('GET /updatemanagement/v2.0/WindowsEndpoints returns 200 on 25R2', async () => {
    const res = await request(app).get('/updatemanagement/v2.0/WindowsEndpoints').expect(200);
    expect(res.body).toHaveProperty('data');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE — uncovered branches (compliance.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('Compliance — uncovered branches (compliance.ts, 26R1)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); });

  it('GET /v2.0/MobileDeviceRules returns list', async () => {
    const res = await request(app).get('/v2.0/MobileDeviceRules').expect(200);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /v2.0/MobileDeviceRules — SearchQuery branch', async () => {
    const res = await request(app).get('/v2.0/MobileDeviceRules?SearchQuery=rule').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/MobileDeviceRules — PageSize branch', async () => {
    const res = await request(app).get('/v2.0/MobileDeviceRules?PageSize=2').expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/MobileDeviceRules/:id returns 200', async () => {
    const list = await request(app).get('/v2.0/MobileDeviceRules').expect(200);
    const id = list.body.data[0].id as string;
    const res = await request(app).get(`/v2.0/MobileDeviceRules/${id}`).expect(200);
    expect(res.body).toHaveProperty('id', id);
  });

  it('GET /v2.0/MobileDeviceRules/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/MobileDeviceRules/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/DetectedVulnerabilities — SearchQuery branch', async () => {
    const res = await request(app)
      .get('/v2.0/DetectedVulnerabilities?SearchQuery=CVE')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/DetectedVulnerabilities — PageSize branch', async () => {
    const res = await request(app)
      .get('/v2.0/DetectedVulnerabilities?PageSize=2&Page=0')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/DetectedRuleViolations — SearchQuery + OrderBy + PageSize branches', async () => {
    const res = await request(app)
      .get('/v2.0/DetectedRuleViolations?SearchQuery=rule&OrderBy=ruleName&PageSize=2')
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/Rules — OrderBy + PageSize branches', async () => {
    const res = await request(app)
      .get('/v2.0/Rules?OrderBy=severity&PageSize=3')
      .expect(200);
    expect(res.body.pageSize).toBe(3);
  });

  it('GET /v2.0/Vulnerabilities — OrderBy + PageSize branches', async () => {
    const res = await request(app)
      .get('/v2.0/Vulnerabilities?OrderBy=severity&PageSize=3')
      .expect(200);
    expect(res.body.pageSize).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVER MANAGEMENT 26R1 — ApiKeys, DownloadJobs, Dips (serverManagement.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('ServerManagement 26R1 routes (serverManagement.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); });

  it('GET /v2.0/ApiKeys returns list', async () => {
    const res = await request(app).get('/v2.0/ApiKeys').expect(200);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /v2.0/ApiKeys — PageSize + SearchQuery branches', async () => {
    const res = await request(app)
      .get('/v2.0/ApiKeys?PageSize=2&SearchQuery=key')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/DownloadJobs returns list', async () => {
    const res = await request(app).get('/v2.0/DownloadJobs').expect(200);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /v2.0/DownloadJobs — PageSize + SearchQuery branches', async () => {
    const res = await request(app)
      .get('/v2.0/DownloadJobs?PageSize=2&SearchQuery=download')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/DownloadJobs/:id returns 200 for known', async () => {
    const list = await request(app).get('/v2.0/DownloadJobs').expect(200);
    if (list.body.data.length === 0) { return; }
    const id = list.body.data[0].id as string;
    const res = await request(app).get(`/v2.0/DownloadJobs/${id}`).expect(200);
    expect(res.body).toHaveProperty('id', id);
  });

  it('GET /v2.0/DownloadJobs/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/DownloadJobs/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /v2.0/Dips/SimulateMSWCleanup returns 200', async () => {
    const res = await request(app).post('/v2.0/Dips/SimulateMSWCleanup').expect(200);
    expect(res.body).toHaveProperty('message');
  });

  it('POST /v2.0/Dips/MSWCleanup returns 200', async () => {
    const res = await request(app).post('/v2.0/Dips/MSWCleanup').expect(200);
    expect(res.body).toHaveProperty('message');
  });

  it('GET /v2.0/Microservices/:id/Start returns 404 for unknown', async () => {
    await request(app)
      .post('/v2.0/Microservices/00000000-0000-0000-0000-000000000000/Start')
      .expect(404);
  });

  it('GET /v2.0/Microservices/:id/Stop returns 404 for unknown', async () => {
    await request(app)
      .post('/v2.0/Microservices/00000000-0000-0000-0000-000000000000/Stop')
      .expect(404);
  });

  it('GET /v2.0/Microservices/:id/Restart returns 404 for unknown', async () => {
    await request(app)
      .post('/v2.0/Microservices/00000000-0000-0000-0000-000000000000/Restart')
      .expect(404);
  });

  it('GET /v2.0/Microservices — SearchQuery branch', async () => {
    const res = await request(app)
      .get('/v2.0/Microservices?SearchQuery=bconnect')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUPS — UDGFolder SearchQuery + 25R2 skip path (groups.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('Groups — UDGFolder branches (groups.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); });

  it('GET /v2.0/UniversalDynamicGroupsFolder — SearchQuery branch', async () => {
    const res = await request(app)
      .get('/v2.0/UniversalDynamicGroupsFolder?SearchQuery=folder')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/UniversalDynamicGroupsFolder — PageSize branch', async () => {
    const res = await request(app)
      .get('/v2.0/UniversalDynamicGroupsFolder?PageSize=2')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/UniversalDynamicGroupsFolder/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/UniversalDynamicGroupsFolder/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/UniversalDynamicGroups — OrderBy + PageSize branches', async () => {
    const res = await request(app)
      .get('/v2.0/UniversalDynamicGroups?OrderBy=name&PageSize=3')
      .expect(200);
    expect(res.body.pageSize).toBe(3);
  });
});

describe('Groups — UDG routes absent on 25R2 (groups.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2); });

  it('GET /v2.0/UniversalDynamicGroups returns 404 on 25R2 (not registered)', async () => {
    await request(app).get('/v2.0/UniversalDynamicGroups').expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MISC — Folders SearchQuery/OrderBy/pageSize branches (misc.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('Misc — Folders branches (misc.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); });

  it('GET /v2.0/Folders — SearchQuery branch', async () => {
    const res = await request(app)
      .get('/v2.0/Folders?SearchQuery=jobs')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Folders — PageSize branch', async () => {
    const res = await request(app).get('/v2.0/Folders?PageSize=1').expect(200);
    expect(res.body.pageSize).toBe(1);
  });

  it('GET /v2.0/Folders/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/Folders/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/OSFolders — SearchQuery branch', async () => {
    const res = await request(app)
      .get('/v2.0/OSFolders?SearchQuery=Windows')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/OSFolders — PageSize branch', async () => {
    const res = await request(app).get('/v2.0/OSFolders?PageSize=1').expect(200);
    expect(res.body.pageSize).toBe(1);
  });

  it('GET /v2.0/OSFolders/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/OSFolders/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSE CONTROL — 404 paths (defenseControl.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('DefenseControl — 404 and search branches (defenseControl.ts)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); });

  it('GET /v2.0/MicrosoftDefender/Threats — SearchQuery + PageSize branch', async () => {
    const res = await request(app)
      .get('/v2.0/MicrosoftDefender/Threats?SearchQuery=trojan&PageSize=2')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/MicrosoftDefender/Threats/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/MicrosoftDefender/Threats/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints — SearchQuery + PageSize branch', async () => {
    const res = await request(app)
      .get('/v2.0/MicrosoftDefender/WindowsEndpoints?SearchQuery=WIN&PageSize=2')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/MicrosoftDefender/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints — SearchQuery + PageSize branches', async () => {
    const res = await request(app)
      .get('/v2.0/BitLocker/WindowsEndpoints?SearchQuery=WIN&PageSize=2')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints/:id/Secrets returns 404 for unknown (26R1)', async () => {
    await request(app)
      .get('/v2.0/BitLocker/WindowsEndpoints/00000000-0000-0000-0000-000000000000/Secrets')
      .expect(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS — VariableDefinition aliases + AssetStock filter (assets.ts)
// ─────────────────────────────────────────────────────────────────────────────

describe('Assets — VariableDefinitions aliases and AssetStock (assets.ts, 26R1)', () => {
  let app: Express;

  beforeAll(() => { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); });

  it('GET /v2.0/VariableDefinitions returns list (alias for Variables)', async () => {
    const res = await request(app).get('/v2.0/VariableDefinitions').expect(200);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /v2.0/VariableDefinitions/:id returns 200 for known', async () => {
    const list = await request(app).get('/v2.0/VariableDefinitions').expect(200);
    if (list.body.data.length === 0) { return; }
    const id = list.body.data[0].id as string;
    const res = await request(app).get(`/v2.0/VariableDefinitions/${id}`).expect(200);
    expect(res.body).toHaveProperty('id', id);
  });

  it('GET /v2.0/VariableDefinitions/:id returns 404 for unknown', async () => {
    await request(app)
      .get('/v2.0/VariableDefinitions/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('GET /v2.0/AssetStock/Assets — AssetStockFolderId filter branch', async () => {
    const res = await request(app)
      .get('/v2.0/AssetStock/Assets?AssetStockFolderId=00000000-0000-0000-0000-000000000001')
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/AssetStock/Assets — SearchQuery + PageSize branches', async () => {
    const res = await request(app)
      .get('/v2.0/AssetStock/Assets?SearchQuery=asset&PageSize=2')
      .expect(200);
    expect(res.body.pageSize).toBe(2);
  });
});
