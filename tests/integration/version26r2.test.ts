/**
 * 26R2: everything since 26R1 is there, the spec's removals are gone, and discriminator schemas
 * keep the fields of their subtypes.
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
