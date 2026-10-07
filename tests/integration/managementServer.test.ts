/**
 * GET /v2.0/ManagementServer — the version follows the simulated bMS release, so clients
 * can detect the release from it (bConnect-MCP#159), and the body has the spec's fields.
 */

import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { MANAGEMENT_SERVER_VERSIONS } from '../../src/routes/serverManagement';

const PATH = '/bconnect/servermanagement/v2.0/ManagementServer';
const OVERRIDE = 'BCONNECT_MANAGEMENT_SERVER_VERSION';

// ServiceState enum, identical in the 25R2 and 26R1 specs
const SERVICE_STATES = [
  'Unknown', 'Stopped', 'StoppedNotConfigured', 'Starting', 'Running', 'RunningNotConfigured',
  'MaintenanceMode', 'Warning', 'Stopping', 'RestartRequired', 'NotLicensed', 'ExternalNotRequired',
  'RunningNotLicensed', 'RestartPlanned', 'WarningConfigurationError',
];

const cases = Object.values(ProfileMode).flatMap((mode) =>
  Object.values(BmsVersion).map((version) => [mode, version] as const));

describe('ManagementServer', () => {
  afterEach(() => { delete process.env[OVERRIDE]; });

  it('reports 25.2.x for 25R2 and 26.1.x for 26R1', () => {
    expect(MANAGEMENT_SERVER_VERSIONS[BmsVersion.BMS_25R2]).toMatch(/^25\.2\.\d+\.\d+$/);
    expect(MANAGEMENT_SERVER_VERSIONS[BmsVersion.BMS_26R1]).toBe('26.1.161.0');
  });

  it.each(cases)('%s / %s: version of the simulated release, spec fields only', async (mode, version) => {
    const res = await request(createApp(mode, version)).get(PATH);
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(MANAGEMENT_SERVER_VERSIONS[version]);
    expect(Object.keys(res.body).sort()).toEqual(['name', 'plannedServerRestartTimes', 'state', 'version']);
    expect(typeof res.body.name).toBe('string');
    expect(SERVICE_STATES).toContain(res.body.state);
  });

  it('reports BCONNECT_MANAGEMENT_SERVER_VERSION when set, to test unknown versions', async () => {
    process.env[OVERRIDE] = ' 27.1.0.0 ';
    const res = await request(createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2)).get(PATH);
    expect(res.body.version).toBe('27.1.0.0');
  });

  it('ignores an empty BCONNECT_MANAGEMENT_SERVER_VERSION', async () => {
    process.env[OVERRIDE] = '  ';
    const res = await request(createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1)).get(PATH);
    expect(res.body.version).toBe('26.1.161.0');
  });
});
