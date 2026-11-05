/**
 * Values in the formats a live bMS answers (probes of a live 26R1, 2026-11-02, and a live
 * pre-release 26R2, 26.2.110.0, 2026-11-05): times, client agent versions, OS names, MAC
 * addresses, LDAP paths.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { MANAGEMENT_SERVER_VERSIONS } from '../../src/profiles/releases';
import type { Express } from 'express';

type Item = Record<string, unknown>;

const apps = new Map<string, Express>();
function appFor(mode: ProfileMode, version: BmsVersion): Express {
  const key = `${mode} ${version}`;
  if (!apps.has(key)) {
    const previous = process.env.BCONNECT_MODULE_ROUTING;
    process.env.BCONNECT_MODULE_ROUTING = 'strict';
    try { apps.set(key, createApp(mode, version)); } finally {
      if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
    }
  }
  return apps.get(key) as Express;
}

const list = async (path: string, mode = ProfileMode.STANDARD_READONLY, version = BmsVersion.BMS_26R2): Promise<Item[]> =>
  (await request(appFor(mode, version)).get(`/bconnect/${path}`)).body.data as Item[];

const NO_FRACTION = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const TICKS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{7}Z$/;
const MAC = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('live formats', () => {
  it('job instances and their steps: times without a fraction of a second', async () => {
    for (const instance of await list('jobs/v2.0/JobInstances?PageSize=50', ProfileMode.LARGESCALE_READONLY)) {
      for (const field of ['start', 'lastAction']) {
        if (instance[field] !== null) { expect(instance[field]).toMatch(NO_FRACTION); }
      }
      for (const step of instance['steps'] as Item[]) {
        if (step['lastAction'] !== null) { expect(step['lastAction']).toMatch(NO_FRACTION); }
      }
    }
  });

  it('download jobs: times without a fraction, repetitions at HH:mm', async () => {
    const jobs = await list('servermanagement/v2.0/DownloadJobs?PageSize=50', ProfileMode.LARGESCALE_READONLY);
    expect(jobs.length).toBeGreaterThan(0);
    for (const job of jobs) {
      expect(job['lastExecution']).toMatch(NO_FRACTION);
      expect(job['lastUpdate']).toMatch(NO_FRACTION);
      for (const repetition of job['interval'] as Item[]) { expect(repetition['time']).toMatch(/^\d{2}:\d{2}$/); }
    }
  });

  it('update management: the last inventory with ticks, the last update without a fraction', async () => {
    const endpoints = await list('updatemanagement/v2.0/WindowsEndpoints?PageSize=50');
    expect(endpoints.some((e) => e['lastSuccessfulUpdate'] !== null)).toBe(true);
    for (const e of endpoints) {
      if (e['lastInventory'] !== null) { expect(e['lastInventory']).toMatch(TICKS); }
      if (e['lastSuccessfulUpdate'] !== null) { expect(e['lastSuccessfulUpdate']).toMatch(NO_FRACTION); }
    }
  });

  it('client agents: Windows of the release (or the one before), Macs and mobiles major.minor, Linux none', async () => {
    for (const [version, previous] of [[BmsVersion.BMS_26R2, BmsVersion.BMS_26R1], [BmsVersion.BMS_26R1, BmsVersion.BMS_25R2]] as const) {
      const windows = (await list('endpoints/v2.0/WindowsEndpoints?PageSize=100', ProfileMode.LARGESCALE_READONLY, version)).map((e) => e['clientAgentVersion']).filter((v) => v !== null);
      expect(windows.length).toBeGreaterThan(0);
      expect(new Set(windows)).toEqual(new Set([MANAGEMENT_SERVER_VERSIONS[version], MANAGEMENT_SERVER_VERSIONS[previous]]));
      const short = MANAGEMENT_SERVER_VERSIONS[version].split('.').slice(0, 2).join('.');
      for (const type of ['Mac', 'Ios', 'Android']) {
        for (const e of await list(`endpoints/v2.0/${type}Endpoints?PageSize=20`, ProfileMode.LARGESCALE_READONLY, version)) {
          if (e['clientAgentVersion'] !== null) { expect(e['clientAgentVersion']).toBe(short); }
        }
      }
      for (const e of await list('endpoints/v2.0/LinuxEndpoints?PageSize=20', ProfileMode.LARGESCALE_READONLY, version)) {
        expect(e['clientAgentVersion']).toBeNull();
      }
    }
  });

  it('operating systems: the platform, its version apart; Windows by version, Unknown without an inventory', async () => {
    const expected: Array<[string, string, RegExp | null]> = [
      ['Android', 'Android', /^\d+\.\d+$/], ['Ios', 'iOS', /^\d+\.\d+(\.\d+)?$/], ['Mac', 'macOS', /^macOS \d+\.\d+/], ['Linux', 'Linux', null],
    ];
    for (const [type, name, version] of expected) {
      for (const e of await list(`endpoints/v2.0/${type}Endpoints?PageSize=30`, ProfileMode.LARGESCALE_READONLY)) {
        expect(e['operatingSystem']).toBe(name);
        if (version) { expect(e['osVersionString']).toMatch(version); } else { expect(e['osVersionText']).toEqual(expect.any(String)); }
      }
    }
    const windows = await list('endpoints/v2.0/WindowsEndpoints?PageSize=100', ProfileMode.LARGESCALE_READONLY);
    for (const e of windows) {
      expect(e['operatingSystem']).toMatch(e['cpu'] ? /^Windows (Server \d{4}|\d+)$/ : /^Unknown$/);
    }
    const os = (await list('operatingsystems/v2.0/WindowsEndpoints?PageSize=10'))[0]?.['operatingSystem'] as Item;
    expect(os).toMatchObject({ name: 'Windows 11', releaseId: '2009' });
  });

  it('MAC addresses: six hex bytes, on every endpoint type', async () => {
    for (const type of ['Windows', 'Mac', 'Linux', 'Network', 'Android', 'Ios']) {
      for (const e of await list(`endpoints/v2.0/${type}Endpoints?Page=7&PageSize=40`, ProfileMode.LARGESCALE_READONLY)) {
        if (e['primaryMAC'] !== null && e['primaryMAC'] !== undefined) { expect(e['primaryMAC']).toMatch(MAC); }
      }
    }
  });

  it('AD objects: the distinguished name, without an LDAP:// prefix; the management server by its host name', async () => {
    const paths: unknown[] = [];
    for (const entity of ['ADUsers', 'ADGroups', 'ADObjects']) {
      paths.push(...(await list(`activedirectory/v2.0/${entity}`)).map((item) => item['ldapPath']).filter((p) => typeof p === 'string'));
    }
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) { expect(path).toMatch(/^(CN|OU)=/); }
    const server = (await request(appFor(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R2)).get('/bconnect/servermanagement/v2.0/ManagementServer')).body as Item;
    expect(server['name']).toBe('bms01.corp.test');
  });
});
