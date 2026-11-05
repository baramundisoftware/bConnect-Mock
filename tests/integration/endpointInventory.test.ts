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
    expect(w['ieVersionString']).toMatch(/^11\.0\.\d{5}\.\d{3,4} \(rtm\)$/);
  });

  it('leaves the others without hardware details, with what every endpoint has', () => {
    const bare = windows.find((w) => w['cpu'] === null) as Item;
    expect(bare).toMatchObject({ storageMedia: [], bootMode: null, timeZone: null, ieVersionString: null, coManagement: 'None', entraIdDeviceId: '', modernManagementState: 'NotManaged' });
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

  it('links every large-scale endpoint to a logical group the profile has, named for its type', async () => {
    const groups = new Map(((await request(large).get('/bconnect/endpoints/v2.0/LogicalGroups?PageSize=300')).body.data as Item[]).map((g) => [g['id'], g['name']]));
    for (const [type, name] of [['Windows', 'Windows Endpoints'], ['Linux', 'Linux Endpoints'], ['Mac', 'Mac Endpoints'], ['Android', 'Android Devices'], ['Ios', 'iOS Devices'], ['Network', 'IT Infrastructure']]) {
      const endpoints = (await request(large).get(`/bconnect/endpoints/v2.0/${type}Endpoints?PageSize=30`)).body.data as Item[];
      for (const e of endpoints) {
        expect(groups.get(e['logicalGroupId'])).toBe(e['logicalGroup']);
        expect(e['logicalGroup']).toMatch(new RegExp(`^${name}( \\d+)?$`));
      }
    }
  });

  it('a few logical groups install from the DIP, by UNC path', async () => {
    for (const app of [large, strictApp(ProfileMode.STANDARD_READONLY)]) {
      const groups = (await request(app).get('/bconnect/endpoints/v2.0/LogicalGroups?PageSize=300')).body.data as Item[];
      const withDip = groups.filter((g) => g['dip'] !== null);
      expect(withDip.length).toBeGreaterThan(0);
      expect(withDip.length).toBeLessThan(groups.length / 5);
      for (const g of withDip) { expect(g['dip']).toBe('\\\\dip01.corp.test\\DIP'); }
    }
  });

  it('keeps a value the item has, and leaves other entity types alone', () => {
    const item = { id: 'e5000001-0000-0000-0000-000000000001', primaryIP: '10.1.2.3', timeZone: null };
    const filled = withInventory('windowsEndpoints', item);
    expect(['None', 'Intune']).toContain(filled['coManagement']);
    if (filled['cpu']) { expect(filled['primaryIP']).toBe('10.1.2.3'); }
    expect(withInventory('logicalGroups', item)).toBe(item);
  });

  it('fields the live 26R2 fills: SNMP data of network devices, Android host names, AD users of devices', async () => {
    const networks = (await request(large).get('/bconnect/endpoints/v2.0/NetworkEndpoints?PageSize=100')).body.data as Item[];
    const snmp = networks.filter((n) => n['snmpName'] !== null);
    expect(snmp.length).toBeGreaterThan(50);
    expect(snmp.length).toBeLessThan(95);
    const withProperties = snmp.find((n) => Array.isArray(n['snmpProperties'])) as Item;
    expect(withProperties['snmpProperties']).toEqual(expect.arrayContaining([{ name: 'System name', oid: '1.3.6.1.2.1.1.5.0', value: withProperties['displayName'], available: true }]));
    expect(networks.filter((n) => n['assignedScannerId'] !== null).length).toBeLessThan(15);
    const android = (await request(large).get('/bconnect/endpoints/v2.0/AndroidEndpoints?PageSize=50')).body.data as Item[];
    for (const a of android.filter((e) => e['cpu'] !== null)) { expect(a['hostName']).toBe(a['displayName']); }
    const users = new Set(((await request(large).get('/bconnect/activedirectory/v2.0/ADUsers?PageSize=5000')).body.data as Item[]).map((u) => u['id']));
    const ios = (await request(large).get('/bconnect/endpoints/v2.0/IosEndpoints?PageSize=50')).body.data as Item[];
    for (const i of ios) { expect(users.has(i['registeredUserId'])).toBe(true); }
    expect(windows.filter((w) => w['registeredUserId'] !== null).length).toBeLessThan(25);
    expect(windows.filter((w) => w['ipNetworkId'] !== null).length).toBeLessThan(10);
  });

  it('records the live 26R2 fills: org unit notes, installed software usage dates, a default domain on few groups', async () => {
    const app = strictApp(ProfileMode.STANDARD_READONLY);
    const units = (await request(app).get('/bconnect/activedirectory/v2.0/OrgUnits')).body.data as Item[];
    expect(units.some((u) => /^Synchronized from Active Directory \((OU|DC)=/.test(String(u['comment'])))).toBe(true);
    const software = (await request(large).get('/bconnect/software/v2.0/InstalledWindowsSoftware?PageSize=100')).body.data as Item[];
    const used = software.filter((s) => s['autFirstUse'] !== null);
    expect(used.length).toBeGreaterThan(software.length / 2);
    for (const s of used) {
      expect(s['autFirstUse']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(Date.parse(s['autFirstUse'] as string)).toBeLessThan(Date.parse(s['autLastUse'] as string));
    }
    const groups = (await request(large).get('/bconnect/endpoints/v2.0/LogicalGroups?PageSize=300')).body.data as Item[];
    const withDomain = groups.filter((g) => g['defaultDomain'] !== null);
    expect(withDomain.length).toBeGreaterThan(0);
    expect(withDomain.length).toBeLessThan(groups.length / 5);
  });
});
