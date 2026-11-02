/**
 * Endpoints carry the inventory a live bMS answers (formats from a 26R1 probe, 2026-11-02):
 * about a third of the Windows endpoints fully inventoried, the rest without hardware details.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { withInventory } from '../../src/profiles/endpointInventory';
import type { Express } from 'express';

type Item = Record<string, unknown>;

function strictApp(mode: ProfileMode): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, BmsVersion.BMS_26R1); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('endpoint inventory', () => {
  let large: Express;
  let windows: Item[];
  beforeAll(async () => {
    large = strictApp(ProfileMode.LARGESCALE_READONLY);
    windows = (await request(large).get('/bconnect/endpoints/v2.0/WindowsEndpoints?PageSize=100')).body.data as Item[];
  });

  it('inventories about a third of the Windows endpoints, in the live bMS\'s formats', () => {
    const inventoried = windows.filter((w) => w['cpu'] !== null);
    expect(inventoried.length).toBeGreaterThan(20);
    expect(inventoried.length).toBeLessThan(60);
    const w = inventoried[0] as Item;
    expect(w['timeZone']).toMatch(/^UTC[+-]\d{2}:\d{2} [A-Za-z]+\/[A-Za-z_]+$/);
    expect(w['primarySubnetMask']).toMatch(/^255\.255\.\d+\.\d+$/); // the generator's own mask wins
    expect(w['osVersionString']).toMatch(/^10\.0\.\d{5}\.\d{3,4}$/);
    expect(w['lastBoot']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/); // no fraction of a second
    expect(w['storageMedia']).toEqual([expect.objectContaining({ busType: 'NVMe', partitionStyle: 'GPT', storageVolumes: expect.any(Array) })]);
    expect(w['cpu']).toMatchObject({ architecture: 'x64', physicalCPUs: 1 });
  });

  it('leaves the others without hardware details, with what every endpoint has', () => {
    const bare = windows.find((w) => w['cpu'] === null) as Item;
    expect(bare).toMatchObject({ storageMedia: [], bootMode: null, timeZone: null, coManagement: 'None', entraIdDeviceId: '', modernManagementState: 'NotManaged' });
    expect(bare['lastChange']).toMatch(/Z$/);
    expect(bare['clientAgentLink']).toMatchObject({ extendedInternetMode: false });
  });

  it('answers the same inventory for the same endpoint, in lists and by ID', async () => {
    const first = windows[0] as Item;
    const again = await request(large).get(`/bconnect/endpoints/v2.0/WindowsEndpoints/${first['id'] as string}`);
    expect(again.body).toEqual(first);
  });

  it('fills the other endpoint types: Linux over SSH, network devices as scanned', async () => {
    const app = strictApp(ProfileMode.STANDARD_READONLY);
    const linux = (await request(app).get('/bconnect/endpoints/v2.0/LinuxEndpoints')).body.data[0] as Item;
    expect(linux).toMatchObject({ managementMode: 'SSH', sshConfiguration: expect.objectContaining({ port: 22 }) });
    expect(linux['primaryIP']).toMatch(/^172\./);
    const network = (await request(app).get('/bconnect/endpoints/v2.0/NetworkEndpoints')).body.data[0] as Item;
    expect(network).toMatchObject({ operatingSystem: 'Unknown', snmpPort: 0, totalRAM: 0, sshAuthenticationMethod: 'None' });
  });

  it('keeps a value the item has, and leaves other entity types alone', () => {
    const item = { id: 'e5000001-0000-0000-0000-000000000001', primaryIP: '10.1.2.3', timeZone: null };
    const filled = withInventory('windowsEndpoints', item);
    expect(filled['coManagement']).toBe('None');
    if (filled['cpu']) { expect(filled['primaryIP']).toBe('10.1.2.3'); }
    expect(withInventory('logicalGroups', item)).toBe(item);
  });
});
