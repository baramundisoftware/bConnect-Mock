/**
 * 26R2: everything since 26R1 is there, the spec's removals are gone, discriminator schemas
 * keep the fields of their subtypes, and the data has what 26R2 changed and added.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { SpecValidator, type Schema } from '../conformance/specValidator';
import type { Express } from 'express';

type Item = Record<string, unknown>;

function strictApp(version: BmsVersion): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(ProfileMode.STANDARD_READONLY, version); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('26R2', () => {
  let r1: Express;
  let r2: Express;
  beforeAll(() => { r1 = strictApp(BmsVersion.BMS_26R1); r2 = strictApp(BmsVersion.BMS_26R2); });

  it.each([
    '/bconnect/compliance/v2.0/Rules',
    '/bconnect/universaldynamicgroups/v2.0/UniversalDynamicGroups',
    '/bconnect/software/v2.0/Bundles',
    '/bconnect/endpoints/v2.0/UnmanagedEndpoints',
    '/bconnect/compliance/v2.0/Vulnerabilities',
    '/bconnect/servermanagement/v2.0/DownloadJobs',
    '/bconnect/servermanagement/v2.0/ApiKeys',
  ])('has what 26R1 brought: %s', async (url) => {
    expect((await request(r2).get(url)).status).toBe(200);
  });

  it('reports a 26.2 management server', async () => {
    expect((await request(r2).get('/bconnect/servermanagement/v2.0/ManagementServer')).body.version).toMatch(/^26\.2\./);
  });

  it('has no CloudConnectors any more', async () => {
    expect((await request(r1).get('/bconnect/servermanagement/v2.0/CloudConnectors')).status).toBe(200);
    expect((await request(r2).get('/bconnect/servermanagement/v2.0/CloudConnectors')).status).toBe(404);
  });

  it('network endpoints lose the fields 26R2 removed', async () => {
    const removed = ['macList', 'operatingSystem', 'totalRAM', 'networkInfo', 'industrialDeviceInfo'];
    const in26r1 = (await request(r1).get('/bconnect/endpoints/v2.0/NetworkEndpoints')).body.data as Item[];
    const in26r2 = (await request(r2).get('/bconnect/endpoints/v2.0/NetworkEndpoints')).body.data as Item[];
    expect(Object.keys(in26r1[0] as Item)).toEqual(expect.arrayContaining(['macList', 'operatingSystem', 'totalRAM']));
    for (const item of in26r2) { for (const field of removed) { expect(item).not.toHaveProperty(field); } }
  });

  it('a weekly download job interval keeps its weekdays (discriminator subtype)', async () => {
    const jobs = (await request(r2).get('/bconnect/servermanagement/v2.0/DownloadJobs')).body.data as Item[];
    const weekly = jobs.flatMap((j) => j['interval'] as Item[]).find((i) => i['type'] === 'Weekly');
    expect(weekly?.['weekdays']).toEqual(expect.any(Array));
  });
});

describe('26R2 data', () => {
  let r1: Express;
  let r2: Express;
  beforeAll(() => { r1 = strictApp(BmsVersion.BMS_26R1); r2 = strictApp(BmsVersion.BMS_26R2); });

  it.each([
    ['/bconnect/activedirectory/v2.0/ADUsers', 'User', 'ADUser'],
    ['/bconnect/activedirectory/v2.0/ADGroups', 'Group', 'ADGroup'],
  ])('AD object types tell AD from Entra ID: %s', async (url, before, after) => {
    const in26r1 = (await request(r1).get(url)).body.data as Item[];
    const in26r2 = (await request(r2).get(url)).body.data as Item[];
    expect(new Set(in26r1.map((i) => i['type']))).toEqual(new Set([before]));
    expect(new Set(in26r2.map((i) => i['type']))).toEqual(new Set([after]));
    const id = in26r2[0]?.['id'] as string;
    expect((await request(r2).get(`${url}/${id}`)).body.type).toBe(after);
  });

  it('AD objects of both kinds', async () => {
    const objects = (await request(r2).get('/bconnect/activedirectory/v2.0/ADObjects')).body.data as Item[];
    for (const o of objects) { expect(['ADUser', 'ADGroup']).toContain(o['type']); }
  });

  it('network endpoints answer deviceInfo null, and their SNMP data', async () => {
    // A live 26R2 (pre-release 26.2.110.0) left deviceInfo null on all 33 of its network endpoints
    const endpoints = (await request(r2).get('/bconnect/endpoints/v2.0/NetworkEndpoints')).body.data as Item[];
    expect(endpoints.length).toBeGreaterThan(0);
    for (const e of endpoints) { expect(e['deviceInfo']).toBeNull(); }
    const snmp = endpoints.find((e) => e['snmpName'] !== null) as Item;
    expect(snmp['vendorId']).toMatch(/^\d+$/);
    expect(snmp['upTime']).toEqual(expect.any(Number));
  });

  it('unmanaged endpoints: a Kerberos identity only in a domain, empty without a token', async () => {
    const endpoints = (await request(r2).get('/bconnect/endpoints/v2.0/UnmanagedEndpoints')).body.data as Item[];
    expect(endpoints.length).toBeGreaterThan(0);
    for (const e of endpoints) {
      expect(e['computerGroupName']).toBe(e['isPartOfDomain'] ? 'corp.test' : 'WORKGROUP');
      if (e['isKerberosAuthenticated']) {
        expect(e['isPartOfDomain']).toBe(true);
        expect(e['kerberosPrincipal']).toMatch(/^[A-Z0-9-]+\$@CORP\.TEST$/);
        expect(e['endpointSid']).toMatch(/^S-1-5-21-\d+-\d+-\d+-\d+$/);
        expect(e['adDnsName']).toMatch(/\.corp\.test$/);
      } else {
        expect([e['kerberosPrincipal'], e['endpointSid'], e['adDnsName']]).toEqual(['', '', '']);
      }
      expect(e['publicKeySha1Fingerprint']).toMatch(/^[0-9A-F]{40}$/);
      expect(e['tokenExpirationDate']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(e).not.toHaveProperty('networkGroupName');
    }
    const in26r1 = (await request(r1).get('/bconnect/endpoints/v2.0/UnmanagedEndpoints')).body.data as Item[];
    expect(in26r1[0]?.['networkGroupName']).toEqual(expect.any(String));
    expect(in26r1[0]).not.toHaveProperty('computerGroupName');
  });

  it('update management: the cumulative update an endpoint is patched to', async () => {
    const endpoints = (await request(r2).get('/bconnect/updatemanagement/v2.0/WindowsEndpoints')).body.data as Item[];
    const newest = endpoints.filter((e) => e['requiredOSUpdateInstalled'] === 'Yes').map((e) => e['osUpdateVersion']);
    expect(new Set(newest).size).toBe(1);
    for (const e of endpoints) {
      if (e['requiredOSUpdateInstalled'] === 'Unknown') { expect(e['osUpdateVersion']).toBeNull(); continue; }
      expect(e['osUpdateVersion']).toMatch(/^KB\d{7}$/);
      expect(e['osUpdateReleaseDate']).toMatch(/T00:00:00Z$/);
      if (e['requiredOSUpdateInstalled'] === 'No') { expect(e['osUpdateVersion']).not.toBe(newest[0]); }
    }
    const in26r1 = (await request(r1).get('/bconnect/updatemanagement/v2.0/WindowsEndpoints')).body.data as Item[];
    expect(in26r1[0]).not.toHaveProperty('osUpdateVersion');
  });
});

describe('SpecValidator: discriminator', () => {
  const schemas: Record<string, Schema> = {
    Repetition: {
      type: 'object', required: ['type'], additionalProperties: false,
      properties: { type: { type: 'string' }, time: { type: 'string' } },
      discriminator: { propertyName: 'type', mapping: { Daily: '#/components/schemas/Daily', Weekly: '#/components/schemas/Weekly' } },
    },
    Daily: { allOf: [{ $ref: '#/components/schemas/Repetition' }, { type: 'object', additionalProperties: false }] },
    Weekly: { allOf: [{ $ref: '#/components/schemas/Repetition' }, { type: 'object', additionalProperties: false, properties: { weekdays: { type: 'array', items: { type: 'string' } } } }] },
  };
  const validator = new SpecValidator(schemas);
  const ref = { $ref: '#/components/schemas/Repetition' };

  it('checks a value against the subtype it names', () => {
    expect(validator.validate(ref, { type: 'Weekly', time: '03:00:00', weekdays: ['Sunday'] })).toEqual([]);
    expect(validator.validate(ref, { type: 'Daily', time: '02:00:00', weekdays: ['Sunday'] })).toEqual(['weekdays: not in spec (additionalProperties: false)']);
  });

  it('reports a value no subtype is mapped to', () => {
    expect(validator.validate(ref, { type: 'Monthly' })).toEqual(['type: not in discriminator mapping: "Monthly"']);
  });
});
