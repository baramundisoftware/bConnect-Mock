/**
 * Coverage Boost — Phase 20
 *
 * Targets low-branch-coverage gaps identified during QA Gate:
 *   - compliance.ts        — 48% branches → hit 404 paths, DetectedVulnerabilities/DetectedRuleViolations by endpoint
 *   - serverManagement.ts  — 55% branches → CloudConnectors/PxeRelays SearchQuery, Objects/:id 404 paths
 *   - groups.ts            — 56% branches → read-only profile branches, UDG 25R2 paths, LogicalGroups aggregated Endpoints
 *   - endpoints.ts         — 59% branches → read-only profile paths, 26R1-only EntraIdData routes, MaintenanceWindow
 *   - defenseControl.ts    — 63% branches → MicrosoftDefender 404s, LAPS 404, BitLocker Secrets 404/PATCH
 *   - software.ts          — 66% branches → Bundle mutations on read-only, BundleApplications 404s
 *   - misc.ts              — 66% branches → Folders read-only paths, EntraIdData 26R1 branches
 *   - assets.ts            — 67% branches → AssetStock filter, VariableDefinitions read-only branches
 *   - jobs.ts              — 70% branches → JobInstances Start/Stop/Resume in read-only mode, 404 paths
 *   - catalog.ts           — 69% branches → KioskReleases/AssetTypes SearchQuery branches, child folder navigation
 *   - activeDirectory.ts   — 74% branches → ADObjects 404, ADGroups get-by-id 404
 *   - factories (readonlyList, getById, subResourceList, crudRoutes, actionRoute) — 75-84% branches
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { BmsVersion, ProfileMode } from '../../../src/profiles/ProfileManager';

const FAKE_GUID = '00000000-0000-0000-0000-000000000000';
const BAD_GUID = 'not-a-guid';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create apps for both profiles and both BMS versions
// ─────────────────────────────────────────────────────────────────────────────

let ro26: Express;
let rw26: Express;
let ro25: Express;

beforeAll(() => {
  ro26 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
  rw26 = createApp(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
  ro25 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE — 404 paths and endpoint-scoped sub-resources
// ─────────────────────────────────────────────────────────────────────────────

describe('compliance.ts branch coverage', () => {
  it('GET /v2.0/MobileDeviceRules — returns data', async () => {
    const res = await request(ro26).get('/v2.0/MobileDeviceRules').expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/MobileDeviceRules with SearchQuery', async () => {
    await request(ro26).get('/v2.0/MobileDeviceRules?SearchQuery=Password').expect(200);
  });

  it('GET /v2.0/MobileDeviceRules with OrderBy', async () => {
    await request(ro26).get('/v2.0/MobileDeviceRules?OrderBy=ruleName asc').expect(200);
  });

  it('GET /v2.0/MobileDeviceRules with PageSize', async () => {
    const res = await request(ro26).get('/v2.0/MobileDeviceRules?PageSize=2').expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(2);
    expect(res.body.pageSize).toBe(2);
  });

  it('GET /v2.0/MobileDeviceRules/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/MobileDeviceRules/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/Rules/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/Rules/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/Vulnerabilities/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/Vulnerabilities/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/DetectedVulnerabilities with SearchQuery', async () => {
    await request(ro26).get('/v2.0/DetectedVulnerabilities?SearchQuery=CVE').expect(200);
  });

  it('GET /v2.0/DetectedVulnerabilities with PageSize', async () => {
    const res = await request(ro26).get('/v2.0/DetectedVulnerabilities?PageSize=1').expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('GET /v2.0/Compliance/Endpoints/:id/DetectedVulnerabilities — with SearchQuery', async () => {
    await request(ro26).get(`/v2.0/Compliance/Endpoints/${FAKE_GUID}/DetectedVulnerabilities?SearchQuery=CVE`).expect(200);
  });

  it('GET /v2.0/Compliance/Endpoints/:id/DetectedVulnerabilities — with PageSize', async () => {
    await request(ro26).get(`/v2.0/Compliance/Endpoints/${FAKE_GUID}/DetectedVulnerabilities?PageSize=1`).expect(200);
  });

  it('GET /v2.0/Compliance/Endpoints/:id/DetectedRuleViolations — with SearchQuery', async () => {
    await request(ro26).get(`/v2.0/Compliance/Endpoints/${FAKE_GUID}/DetectedRuleViolations?SearchQuery=rule`).expect(200);
  });

  it('GET /v2.0/Compliance/Endpoints/:id/DetectedRuleViolations — with PageSize', async () => {
    await request(ro26).get(`/v2.0/Compliance/Endpoints/${FAKE_GUID}/DetectedRuleViolations?PageSize=1`).expect(200);
  });

  it('GET /v2.0/DetectedRuleViolations with PageSize', async () => {
    const res = await request(ro26).get('/v2.0/DetectedRuleViolations?PageSize=2').expect(200);
    expect(res.body.pageSize).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SERVER MANAGEMENT — SearchQuery/404 branches
// ─────────────────────────────────────────────────────────────────────────────

describe('serverManagement.ts branch coverage', () => {
  it('GET /v2.0/CloudConnectors with SearchQuery', async () => {
    await request(ro26).get('/v2.0/CloudConnectors?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/PxeRelays with SearchQuery', async () => {
    await request(ro26).get('/v2.0/PxeRelays?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/Microservices/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/Microservices/${FAKE_GUID}`).expect(404);
  });

  it('POST /v2.0/Microservices/:id/Start — 404 for nonexistent', async () => {
    await request(ro26).post(`/v2.0/Microservices/${FAKE_GUID}/Start`).expect(404);
  });

  it('POST /v2.0/Microservices/:id/Stop — 404 for nonexistent', async () => {
    await request(ro26).post(`/v2.0/Microservices/${FAKE_GUID}/Stop`).expect(404);
  });

  it('POST /v2.0/Microservices/:id/Restart — 404 for nonexistent', async () => {
    await request(ro26).post(`/v2.0/Microservices/${FAKE_GUID}/Restart`).expect(404);
  });

  it('PATCH /v2.0/Objects/:id — returns merged object (read-write)', async () => {
    const res = await request(rw26)
      .patch(`/v2.0/Objects/${FAKE_GUID}`)
      .set('Content-Type', 'application/json')
      .send({ name: 'test' })
      .expect(200);
    expect(res.body.id).toBe(FAKE_GUID);
  });

  it('PATCH /v2.0/Objects/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/Objects/${FAKE_GUID}`).set('Content-Type', 'application/json').send({ name: 'test' }).expect(403);
  });

  it('GET /v2.0/Objects/:id/Rights — returns rights', async () => {
    const res = await request(ro26).get(`/v2.0/Objects/${FAKE_GUID}/Rights`).expect(200);
    expect(res.body.rights).toBeDefined();
  });

  it('GET /v2.0/DownloadJobs/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/DownloadJobs/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/ApiKeys with SearchQuery', async () => {
    await request(ro26).get('/v2.0/ApiKeys?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/DownloadJobs with SearchQuery', async () => {
    await request(ro26).get('/v2.0/DownloadJobs?SearchQuery=test').expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUPS — read-only paths, 25R2 mode, aggregate endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('groups.ts branch coverage', () => {

  it('GET /v2.0/LogicalGroups — read-only profile (no StateManager)', async () => {
    const res = await request(ro26).get('/v2.0/LogicalGroups').expect(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /v2.0/LogicalGroups — read-only with SearchQuery', async () => {
    await request(ro26).get('/v2.0/LogicalGroups?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/LogicalGroups — read-only with OrderBy', async () => {
    await request(ro26).get('/v2.0/LogicalGroups?OrderBy=displayName asc').expect(200);
  });

  it('GET /v2.0/LogicalGroups/:id — read-only profile', async () => {
    const list = await request(ro26).get('/v2.0/LogicalGroups').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(ro26).get(`/v2.0/LogicalGroups/${id}`).expect(200);
    }
  });

  it('GET /v2.0/LogicalGroups/:id — 404 in read-only', async () => {
    await request(ro26).get(`/v2.0/LogicalGroups/${FAKE_GUID}`).expect(404);
  });

  it('POST /v2.0/LogicalGroups — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/LogicalGroups').send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/LogicalGroups/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/LogicalGroups/${FAKE_GUID}`).send({ displayName: 'x' }).expect(403);
  });

  it('DELETE /v2.0/LogicalGroups/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/LogicalGroups/${FAKE_GUID}`).expect(403);
  });

  it('GET /v2.0/LogicalGroups/:parentId/Endpoints — 404 for nonexistent group', async () => {
    await request(ro26).get(`/v2.0/LogicalGroups/${FAKE_GUID}/Endpoints`).expect(404);
  });

  it('GET /v2.0/LogicalGroups/:parentId/Endpoints — 400 for bad GUID', async () => {
    await request(ro26).get(`/v2.0/LogicalGroups/${BAD_GUID}/Endpoints`).expect(400);
  });

  it('GET /v2.0/LogicalGroups/:parentId/Endpoints — with SearchQuery and OrderBy', async () => {
    const list = await request(ro26).get('/v2.0/LogicalGroups').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(ro26).get(`/v2.0/LogicalGroups/${id}/Endpoints?SearchQuery=test&OrderBy=displayName asc&PageSize=2`).expect(200);
    }
  });

  it('POST /v2.0/StaticGroups — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/StaticGroups').send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/StaticGroups/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/StaticGroups/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/StaticGroups/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/StaticGroups/${FAKE_GUID}`).expect(403);
  });

  it('DELETE /v2.0/UnmanagedEndpoints/:id — returns 403 in 26R1', async () => {
    await request(ro26).delete(`/v2.0/UnmanagedEndpoints/${FAKE_GUID}`).expect(403);
  });

  it('GET /v2.0/UnmanagedEndpoints — 25R2 returns 404 (not registered)', async () => {
    const res = await request(ro25).get('/v2.0/UnmanagedEndpoints');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/UniversalDynamicGroupsFolder with SearchQuery', async () => {
    await request(ro26).get('/v2.0/UniversalDynamicGroupsFolder?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/UniversalDynamicGroupsFolder/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/UniversalDynamicGroupsFolder/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/UniversalDynamicGroups/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/UniversalDynamicGroups/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/UniversalDynamicGroups — 25R2 returns 404', async () => {
    const res = await request(ro25).get('/v2.0/UniversalDynamicGroups');
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINTS — read-only paths, EntraIdData, MaintenanceWindow
// ─────────────────────────────────────────────────────────────────────────────

describe('endpoints.ts branch coverage', () => {
  let windowsEpId: string;

  beforeAll(async () => {
    const res = await request(ro26).get('/v2.0/WindowsEndpoints').expect(200);
    windowsEpId = res.body.data[0]?.id ?? res.body.data[0]?.guid ?? FAKE_GUID;
  });

  it('GET /v2.0/WindowsEndpoints — read-only (no StateManager)', async () => {
    const res = await request(ro26).get('/v2.0/WindowsEndpoints').expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /v2.0/WindowsEndpoints — read-only with SearchQuery', async () => {
    await request(ro26).get('/v2.0/WindowsEndpoints?SearchQuery=WIN').expect(200);
  });

  it('GET /v2.0/WindowsEndpoints — read-only with OrderBy', async () => {
    await request(ro26).get('/v2.0/WindowsEndpoints?OrderBy=displayName desc').expect(200);
  });

  it('GET /v2.0/WindowsEndpoints/:id — read-only (no StateManager)', async () => {
    await request(ro26).get(`/v2.0/WindowsEndpoints/${windowsEpId}`).expect(200);
  });

  it('GET /v2.0/WindowsEndpoints/:id — 400 for bad GUID', async () => {
    await request(ro26).get(`/v2.0/WindowsEndpoints/${BAD_GUID}`).expect(400);
  });

  it('GET /v2.0/WindowsEndpoints/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/WindowsEndpoints/${FAKE_GUID}`).expect(404);
  });

  it('POST /v2.0/WindowsEndpoints — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/WindowsEndpoints').send({ displayName: 'test', type: 'WindowsEndpoint' }).expect(403);
  });

  it('GET /v2.0/Endpoints/:id/EntraIdData — 404 for nonexistent (26R1)', async () => {
    await request(ro26).get(`/v2.0/Endpoints/${FAKE_GUID}/EntraIdData`).expect(404);
  });

  it('POST /v2.0/Endpoints/:id/EntraIdData — 403 in read-only (26R1)', async () => {
    await request(ro26).post(`/v2.0/Endpoints/${FAKE_GUID}/EntraIdData`).send({}).expect(403);
  });

  it('DELETE /v2.0/Endpoints/:id/EntraIdData — 403 in read-only (26R1)', async () => {
    await request(ro26).delete(`/v2.0/Endpoints/${FAKE_GUID}/EntraIdData`).expect(403);
  });

  it('GET /v2.0/Endpoints/:id/MaintenanceWindow — returns default', async () => {
    await request(ro26).get(`/v2.0/Endpoints/${windowsEpId}/MaintenanceWindow`).expect(200);
  });

  it('POST /v2.0/Endpoints/:id/MaintenanceWindow — 403 in read-only', async () => {
    await request(ro26).post(`/v2.0/Endpoints/${windowsEpId}/MaintenanceWindow`).send({}).expect(403);
  });

  it('PATCH /v2.0/Endpoints/:id/MaintenanceWindow — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/Endpoints/${windowsEpId}/MaintenanceWindow`).send({}).expect(403);
  });

  it('DELETE /v2.0/Endpoints/:id/MaintenanceWindow — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/Endpoints/${windowsEpId}/MaintenanceWindow`).expect(403);
  });

  it('GET /v2.0/Endpoints/:id/EntraIdData — 25R2 returns 404 (not registered)', async () => {
    const res = await request(ro25).get(`/v2.0/Endpoints/${FAKE_GUID}/EntraIdData`);
    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFENSE CONTROL — 404 and PATCH branches
// ─────────────────────────────────────────────────────────────────────────────

describe('defenseControl.ts branch coverage', () => {
  it('GET /v2.0/BitLocker/WindowsEndpoints/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/BitLocker/WindowsEndpoints/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints/:id/Secrets — 404 for nonexistent (26R1)', async () => {
    await request(ro26).get(`/v2.0/BitLocker/WindowsEndpoints/${FAKE_GUID}/Secrets`).expect(404);
  });

  it('PATCH /v2.0/BitLocker/WindowsEndpoints/:id/Secrets — 404 for nonexistent (26R1, read-write)', async () => {
    await request(rw26).patch(`/v2.0/BitLocker/WindowsEndpoints/${FAKE_GUID}/Secrets`).set('Content-Type', 'application/json').send({}).expect(404);
  });

  it('PATCH /v2.0/BitLocker/WindowsEndpoints/:id/Secrets — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/BitLocker/WindowsEndpoints/${FAKE_GUID}/Secrets`).set('Content-Type', 'application/json').send({}).expect(403);
  });

  it('GET /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id — 404', async () => {
    await request(ro26).get(`/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/${FAKE_GUID}`).expect(404);
  });

  it('PATCH /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id — 404 (read-write)', async () => {
    await request(rw26).patch(`/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/${FAKE_GUID}`).set('Content-Type', 'application/json').send({}).expect(404);
  });

  it('PATCH /v2.0/LocalAdministrativeAccounts/WindowsEndpoints/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/LocalAdministrativeAccounts/WindowsEndpoints/${FAKE_GUID}`).set('Content-Type', 'application/json').send({}).expect(403);
  });

  it('GET /v2.0/LocalAdminPasswords/Endpoint/:endpointId — 404', async () => {
    await request(ro26).get(`/v2.0/LocalAdminPasswords/Endpoint/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/MicrosoftDefender/Threats/:id — 404', async () => {
    await request(ro26).get(`/v2.0/MicrosoftDefender/Threats/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints/:id — 404', async () => {
    await request(ro26).get(`/v2.0/MicrosoftDefender/WindowsEndpoints/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/MicrosoftDefender/Threats with SearchQuery', async () => {
    await request(ro26).get('/v2.0/MicrosoftDefender/Threats?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/MicrosoftDefender/Threats with OrderBy', async () => {
    await request(ro26).get('/v2.0/MicrosoftDefender/Threats?OrderBy=name asc').expect(200);
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints with SearchQuery', async () => {
    await request(ro26).get('/v2.0/MicrosoftDefender/WindowsEndpoints?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/MicrosoftDefender/WindowsEndpoints with OrderBy', async () => {
    await request(ro26).get('/v2.0/MicrosoftDefender/WindowsEndpoints?OrderBy=endpointName asc').expect(200);
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints with SearchQuery', async () => {
    await request(ro26).get('/v2.0/BitLocker/WindowsEndpoints?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/BitLocker/WindowsEndpoints with OrderBy', async () => {
    await request(ro26).get('/v2.0/BitLocker/WindowsEndpoints?OrderBy=endpointName desc').expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SOFTWARE — Bundle mutations on read-only, 404 paths
// ─────────────────────────────────────────────────────────────────────────────

describe('software.ts branch coverage', () => {
  it('GET /v2.0/Bundles/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/Bundles/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/BundleApplications/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/BundleApplications/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/Bundle/Folders/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/Bundle/Folders/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/Bundle/Folders with SearchQuery', async () => {
    await request(ro26).get('/v2.0/Bundle/Folders?SearchQuery=test').expect(200);
  });

  it('POST /v2.0/Bundles — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/Bundles').send({ name: 'test' }).expect(403);
  });

  it('DELETE /v2.0/Bundles/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/Bundles/${FAKE_GUID}`).expect(403);
  });

  it('POST /v2.0/Bundle/Folders — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/Bundle/Folders').send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/Bundle/Folders/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/Bundle/Folders/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/Bundle/Folders/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/Bundle/Folders/${FAKE_GUID}`).expect(403);
  });

  it('POST /v2.0/Bundles/:bundleId/BundleApplications — 403 in read-only', async () => {
    await request(ro26).post(`/v2.0/Bundles/${FAKE_GUID}/BundleApplications`).send({ applicationId: FAKE_GUID }).expect(403);
  });

  it('PATCH /v2.0/Bundles/:bundleId/BundleApplications/:appId — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/Bundles/${FAKE_GUID}/BundleApplications/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/BundleApplications/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/BundleApplications/${FAKE_GUID}`).expect(403);
  });

  it('GET /v2.0/BundleApplications with SearchQuery', async () => {
    await request(ro26).get('/v2.0/BundleApplications?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/Bundles with SearchQuery and OrderBy', async () => {
    await request(ro26).get('/v2.0/Bundles?SearchQuery=test&OrderBy=name asc').expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MISC — Folders read-only branches, EntraIdData
// ─────────────────────────────────────────────────────────────────────────────

describe('misc.ts branch coverage', () => {
  it('GET /v2.0/OSFolders/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/OSFolders/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/Folders — read-only (no StateManager)', async () => {
    await request(ro26).get('/v2.0/Folders').expect(200);
  });

  it('GET /v2.0/Folders with SearchQuery', async () => {
    await request(ro26).get('/v2.0/Folders?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/Folders with OrderBy', async () => {
    await request(ro26).get('/v2.0/Folders?OrderBy=name asc').expect(200);
  });

  it('GET /v2.0/Folders/:id — read-only', async () => {
    const list = await request(ro26).get('/v2.0/Folders').expect(200);
    if (list.body.data.length > 0) {
      await request(ro26).get(`/v2.0/Folders/${list.body.data[0].id}`).expect(200);
    }
  });

  it('GET /v2.0/Folders/:id — 400 for bad GUID', async () => {
    await request(ro26).get(`/v2.0/Folders/${BAD_GUID}`).expect(400);
  });

  it('GET /v2.0/Folders/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/Folders/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/Folders/:id/Folders — read-only', async () => {
    const list = await request(ro26).get('/v2.0/Folders').expect(200);
    if (list.body.data.length > 0) {
      await request(ro26).get(`/v2.0/Folders/${list.body.data[0].id}/Folders`).expect(200);
    }
  });

  it('GET /v2.0/Folders/:id/Folders — 400 for bad GUID', async () => {
    await request(ro26).get(`/v2.0/Folders/${BAD_GUID}/Folders`).expect(400);
  });

  it('GET /v2.0/Folders/:id/Folders — 404 for nonexistent parent', async () => {
    await request(ro26).get(`/v2.0/Folders/${FAKE_GUID}/Folders`).expect(404);
  });

  it('POST /v2.0/Folders — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/Folders').send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/Folders/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/Folders/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/Folders/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/Folders/${FAKE_GUID}`).expect(403);
  });

  it('GET /v2.0/EntraIdData — returns list (26R1)', async () => {
    await request(ro26).get('/v2.0/EntraIdData').expect(200);
  });

  it('GET /v2.0/EntraIdData with PageSize', async () => {
    const res = await request(ro26).get('/v2.0/EntraIdData?PageSize=1').expect(200);
    expect(res.body.data.length).toBeLessThanOrEqual(1);
  });

  it('GET /v2.0/EntraIdData/:deviceId — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/EntraIdData/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/EntraIdData — 25R2 returns 404', async () => {
    const res = await request(ro25).get('/v2.0/EntraIdData');
    expect(res.status).toBe(404);
  });

  it('GET /v2.0/OSFolders with SearchQuery', async () => {
    await request(ro26).get('/v2.0/OSFolders?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/OSFolders with OrderBy', async () => {
    await request(ro26).get('/v2.0/OSFolders?OrderBy=name asc').expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ASSETS — AssetStock filter, VariableDefinitions read-only
// ─────────────────────────────────────────────────────────────────────────────

describe('assets.ts branch coverage', () => {
  it('GET /v2.0/AssetStock/Assets with AssetStockFolderId filter', async () => {
    await request(ro26).get(`/v2.0/AssetStock/Assets?AssetStockFolderId=${FAKE_GUID}`).expect(200);
  });

  it('GET /v2.0/AssetStock/Assets with SearchQuery', async () => {
    await request(ro26).get('/v2.0/AssetStock/Assets?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/AssetStock/Folders with SearchQuery', async () => {
    await request(ro26).get('/v2.0/AssetStock/Folders?SearchQuery=test').expect(200);
  });

  it('POST /v2.0/AssetStock/Folders — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/AssetStock/Folders').send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/AssetStock/Folders/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/AssetStock/Folders/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/AssetStock/Folders/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/AssetStock/Folders/${FAKE_GUID}`).expect(403);
  });

  it('GET /v2.0/VariableDefinitions — returns data', async () => {
    const res = await request(ro26).get('/v2.0/VariableDefinitions').expect(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /v2.0/VariableDefinitions with SearchQuery', async () => {
    await request(ro26).get('/v2.0/VariableDefinitions?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/VariableDefinitions/:id — 400 for bad GUID', async () => {
    await request(ro26).get(`/v2.0/VariableDefinitions/${BAD_GUID}`).expect(400);
  });

  it('GET /v2.0/VariableDefinitions/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/VariableDefinitions/${FAKE_GUID}`).expect(404);
  });

  it('POST /v2.0/VariableDefinitions — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/VariableDefinitions').send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/VariableDefinitions/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/VariableDefinitions/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/VariableDefinitions/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/VariableDefinitions/${FAKE_GUID}`).expect(403);
  });

  it('PATCH /v2.0/VariableInstances/:id — 403 in read-only (bad GUID still hits read-only check first)', async () => {
    await request(ro26).patch(`/v2.0/VariableInstances/${BAD_GUID}`).set('Content-Type', 'application/json').send({ value: 'x' }).expect(403);
  });

  it('PATCH /v2.0/VariableInstances/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/VariableInstances/${FAKE_GUID}`).send({ value: 'x' }).expect(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JOBS — read-only paths, JobInstances Start/Stop/Resume 404
// ─────────────────────────────────────────────────────────────────────────────

describe('jobs.ts branch coverage', () => {
  it('GET /v2.0/JobDefinitions — read-only (no StateManager)', async () => {
    const res = await request(ro26).get('/v2.0/JobDefinitions').expect(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /v2.0/JobDefinitions with SearchQuery', async () => {
    await request(ro26).get('/v2.0/JobDefinitions?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/JobDefinitions with OrderBy', async () => {
    await request(ro26).get('/v2.0/JobDefinitions?OrderBy=name asc').expect(200);
  });

  it('GET /v2.0/JobDefinitions/:id — read-only', async () => {
    const list = await request(ro26).get('/v2.0/JobDefinitions').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id ?? list.body.data[0].guid;
      await request(ro26).get(`/v2.0/JobDefinitions/${id}`).expect(200);
    }
  });

  it('GET /v2.0/JobDefinitions/:id — 404 in read-only', async () => {
    await request(ro26).get(`/v2.0/JobDefinitions/${FAKE_GUID}`).expect(404);
  });

  it('POST /v2.0/JobDefinitions — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/JobDefinitions').send({ name: 'test' }).expect(403);
  });

  it('PUT /v2.0/JobDefinitions/:id — 403 in read-only', async () => {
    await request(ro26).put(`/v2.0/JobDefinitions/${FAKE_GUID}`).send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/JobDefinitions/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/JobDefinitions/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/JobDefinitions/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/JobDefinitions/${FAKE_GUID}`).expect(403);
  });

  it('GET /v2.0/JobInstances — read-only (no StateManager)', async () => {
    await request(ro26).get('/v2.0/JobInstances').expect(200);
  });

  it('GET /v2.0/JobInstances with SearchQuery and OrderBy', async () => {
    await request(ro26).get('/v2.0/JobInstances?SearchQuery=test&OrderBy=state asc').expect(200);
  });

  it('GET /v2.0/JobInstances/:id — read-only', async () => {
    const list = await request(ro26).get('/v2.0/JobInstances').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id ?? list.body.data[0].guid;
      await request(ro26).get(`/v2.0/JobInstances/${id}`).expect(200);
    }
  });

  it('GET /v2.0/JobInstances/:id — 404 in read-only', async () => {
    await request(ro26).get(`/v2.0/JobInstances/${FAKE_GUID}`).expect(404);
  });

  it('POST /v2.0/JobInstances — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/JobInstances').send({ jobDefinitionId: FAKE_GUID, endpointId: FAKE_GUID }).expect(403);
  });

  it('DELETE /v2.0/JobInstances/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/JobInstances/${FAKE_GUID}`).expect(403);
  });

  it('POST /v2.0/JobInstances/:id/Start — read-only, 404 for nonexistent', async () => {
    await request(ro26).post(`/v2.0/JobInstances/${FAKE_GUID}/Start`).expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Stop — read-only, 404 for nonexistent', async () => {
    await request(ro26).post(`/v2.0/JobInstances/${FAKE_GUID}/Stop`).expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Resume — read-only, 404 for nonexistent', async () => {
    await request(ro26).post(`/v2.0/JobInstances/${FAKE_GUID}/Resume`).expect(404);
  });

  it('POST /v2.0/JobInstances/:id/Start — read-only, existing instance', async () => {
    const list = await request(ro26).get('/v2.0/JobInstances').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(ro26).post(`/v2.0/JobInstances/${id}/Start`).expect(200);
    }
  });

  it('POST /v2.0/JobInstances/:id/Stop — read-only, existing instance', async () => {
    const list = await request(ro26).get('/v2.0/JobInstances').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(ro26).post(`/v2.0/JobInstances/${id}/Stop`).expect(200);
    }
  });

  it('POST /v2.0/JobInstances/:id/Resume — read-only, existing instance', async () => {
    const list = await request(ro26).get('/v2.0/JobInstances').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(ro26).post(`/v2.0/JobInstances/${id}/Resume`).expect(200);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG — SearchQuery branches, child folder navigation
// ─────────────────────────────────────────────────────────────────────────────

describe('catalog.ts branch coverage', () => {
  it('GET /v2.0/KioskReleases with SearchQuery', async () => {
    await request(ro26).get('/v2.0/KioskReleases?SearchQuery=test').expect(200);
  });

  it('POST /v2.0/KioskReleases — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/KioskReleases').send({ name: 'test' }).expect(403);
  });

  it('DELETE /v2.0/KioskReleases/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/KioskReleases/${FAKE_GUID}`).expect(403);
  });

  it('GET /v2.0/AssetTypes with SearchQuery', async () => {
    await request(ro26).get('/v2.0/AssetTypes?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/AssetTypes/Folders with SearchQuery', async () => {
    await request(ro26).get('/v2.0/AssetTypes/Folders?SearchQuery=test').expect(200);
  });

  it('GET /v2.0/AssetTypes/Folders/:folderId/Folders — 400 for bad GUID', async () => {
    await request(ro26).get(`/v2.0/AssetTypes/Folders/${BAD_GUID}/Folders`).expect(400);
  });

  it('POST /v2.0/AssetTypes — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/AssetTypes').send({ name: 'test' }).expect(403);
  });

  it('DELETE /v2.0/AssetTypes/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/AssetTypes/${FAKE_GUID}`).expect(403);
  });

  it('POST /v2.0/AssetTypes/Folders — 403 in read-only', async () => {
    await request(ro26).post('/v2.0/AssetTypes/Folders').send({ name: 'test' }).expect(403);
  });

  it('PATCH /v2.0/AssetTypes/Folders/:id — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/AssetTypes/Folders/${FAKE_GUID}`).send({ name: 'x' }).expect(403);
  });

  it('DELETE /v2.0/AssetTypes/Folders/:id — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/AssetTypes/Folders/${FAKE_GUID}`).expect(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE DIRECTORY — 404 branches
// ─────────────────────────────────────────────────────────────────────────────

describe('activeDirectory.ts branch coverage', () => {
  it('GET /v2.0/ADGroups/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/ADGroups/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/ADGroups with SearchQuery and OrderBy', async () => {
    await request(ro26).get('/v2.0/ADGroups?SearchQuery=admin&OrderBy=name asc').expect(200);
  });

  it('GET /v2.0/ADGroups with PageSize', async () => {
    const res = await request(ro26).get('/v2.0/ADGroups?PageSize=1').expect(200);
    expect(res.body.pageSize).toBe(1);
  });

  it('GET /v2.0/ADObjects/:id — 404 for nonexistent', async () => {
    await request(ro26).get(`/v2.0/ADObjects/${FAKE_GUID}`).expect(404);
  });

  it('GET /v2.0/ADObjects/:id — 400 for bad GUID', async () => {
    await request(ro26).get(`/v2.0/ADObjects/${BAD_GUID}`).expect(400);
  });

  it('GET /v2.0/ADObjects with SearchQuery', async () => {
    await request(ro26).get('/v2.0/ADObjects?SearchQuery=admin').expect(200);
  });

  it('GET /v2.0/ADObjects with OrderBy', async () => {
    await request(ro26).get('/v2.0/ADObjects?OrderBy=name desc').expect(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GROUPS (read-write mode) — LogicalGroups write+state paths
// ─────────────────────────────────────────────────────────────────────────────

describe('groups.ts read-write branch coverage', () => {
  let rwApp: Express;

  beforeAll(() => {
    rwApp = rw26;
  });

  afterEach(async () => {
    await request(rwApp).post('/api/reset').expect(200);
  });

  it('GET /v2.0/LogicalGroups — read-write with StateManager + SearchQuery + OrderBy', async () => {
    const res = await request(rwApp).get('/v2.0/LogicalGroups?SearchQuery=test&OrderBy=displayName asc').expect(200);
    expect(res.body.data).toBeDefined();
  });

  it('GET /v2.0/LogicalGroups/:id — read-write with StateManager', async () => {
    const list = await request(rwApp).get('/v2.0/LogicalGroups').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(rwApp).get(`/v2.0/LogicalGroups/${id}`).expect(200);
    }
  });

  it('GET /v2.0/LogicalGroups/:id — 404 in read-write', async () => {
    await request(rwApp).get(`/v2.0/LogicalGroups/${FAKE_GUID}`).expect(404);
  });

  it('PATCH /v2.0/LogicalGroups/:id — 404 in read-write for nonexistent', async () => {
    await request(rwApp).patch(`/v2.0/LogicalGroups/${FAKE_GUID}`).send({ displayName: 'x' }).expect(404);
  });

  it('DELETE /v2.0/LogicalGroups/:id — 404 in read-write for nonexistent', async () => {
    await request(rwApp).delete(`/v2.0/LogicalGroups/${FAKE_GUID}`).expect(404);
  });

  it('POST /v2.0/LogicalGroups/:id/MaintenanceWindow — creates MW in read-write', async () => {
    const list = await request(rwApp).get('/v2.0/LogicalGroups').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(rwApp).post(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`).send({ startTime: '23:00:00' }).expect(201);
    }
  });

  it('PATCH /v2.0/LogicalGroups/:id/MaintenanceWindow — updates in read-write', async () => {
    const list = await request(rwApp).get('/v2.0/LogicalGroups').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(rwApp).patch(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`).send({ durationInMinutes: 60 }).expect(200);
    }
  });

  it('PUT /v2.0/LogicalGroups/:id/MaintenanceWindow — updates in read-write (25R2 verb)', async () => {
    const list = await request(rwApp).get('/v2.0/LogicalGroups').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(rwApp).put(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`).send({ durationInMinutes: 90 }).expect(200);
    }
  });

  it('DELETE /v2.0/LogicalGroups/:id/MaintenanceWindow — deletes in read-write', async () => {
    const list = await request(rwApp).get('/v2.0/LogicalGroups').expect(200);
    if (list.body.data.length > 0) {
      const id = list.body.data[0].id;
      await request(rwApp).delete(`/v2.0/LogicalGroups/${id}/MaintenanceWindow`).expect(204);
    }
  });

  it('POST /v2.0/LogicalGroups/:id/MaintenanceWindow — 403 in read-only', async () => {
    await request(ro26).post(`/v2.0/LogicalGroups/${FAKE_GUID}/MaintenanceWindow`).send({}).expect(403);
  });

  it('PATCH /v2.0/LogicalGroups/:id/MaintenanceWindow — 403 in read-only', async () => {
    await request(ro26).patch(`/v2.0/LogicalGroups/${FAKE_GUID}/MaintenanceWindow`).send({}).expect(403);
  });

  it('DELETE /v2.0/LogicalGroups/:id/MaintenanceWindow — 403 in read-only', async () => {
    await request(ro26).delete(`/v2.0/LogicalGroups/${FAKE_GUID}/MaintenanceWindow`).expect(403);
  });
});
