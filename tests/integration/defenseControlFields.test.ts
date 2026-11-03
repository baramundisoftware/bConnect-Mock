/**
 * BitLocker and Microsoft Defender states carry what a live bMS answers (formats from a 26R1
 * probe, 2026-11-02), following the inventory of their Windows endpoint.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import type { Express } from 'express';

type Item = Record<string, unknown>;

function strictApp(mode: ProfileMode): Express {
  const previous = process.env.BCONNECT_MODULE_ROUTING;
  process.env.BCONNECT_MODULE_ROUTING = 'strict';
  try { return createApp(mode, BmsVersion.BMS_26R1); } finally {
    if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
  }
}

const DC = '/bconnect/defensecontrol/v2.0';
const EP = '/bconnect/endpoints/v2.0';

beforeAll(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); });

describe('defensecontrol fields', () => {
  let app: Express;
  let endpoints: Map<string, Item>;
  beforeAll(async () => {
    app = strictApp(ProfileMode.STANDARD_READONLY);
    endpoints = new Map(((await request(app).get(`${EP}/WindowsEndpoints?PageSize=500`)).body.data as Item[]).map((e) => [e['id'] as string, e]));
  });

  it('BitLocker: an inventoried endpoint has a TPM and BitLocker data on its Windows volume only', async () => {
    const states = (await request(app).get(`${DC}/BitLocker/WindowsEndpoints`)).body.data as Item[];
    const full = states.filter((s) => endpoints.get(s['endpointId'] as string)?.['cpu']);
    expect(full.length).toBeGreaterThan(0);
    for (const s of full) {
      expect(s).toMatchObject({ isSecureBootEnabled: true, isStartupPinEnabled: false, networkUnlockStatus: expect.stringMatching(/^(NotSupported|Deactivated)$/) });
      expect(['Enabled', 'NotAvailable']).toContain((s['tpmData'] as Item)['tpmStatus']);
      const volumes = (s['storageMedia'] as Item[]).flatMap((d) => d['storageVolumes'] as Item[]);
      const endpointVolumes = ((endpoints.get(s['endpointId'] as string)?.['storageMedia'] as Item[]).flatMap((d) => d['storageVolumes'] as Item[]));
      expect(volumes.map((v) => v['volumeId'])).toEqual(endpointVolumes.map((v) => v['volumeId']));
      for (const v of volumes) {
        if (v['isSystemVolume']) { expect(v['bitLockerVolumeData']).toMatchObject({ conversionStatus: expect.any(String), lockStatus: 'Unlocked' }); } else { expect(v['bitLockerVolumeData']).toBeNull(); }
      }
    }
  });

  it('BitLocker: an endpoint without inventory has no disks and no TPM', async () => {
    const states = (await request(app).get(`${DC}/BitLocker/WindowsEndpoints`)).body.data as Item[];
    const bare = states.find((s) => !endpoints.get(s['endpointId'] as string)?.['cpu']);
    expect(bare).toMatchObject({ isSecureBootEnabled: false, networkUnlockStatus: 'Unknown', tpmData: null, storageMedia: [] });
    expect(bare).not.toHaveProperty('conversionStatus'); // the mock's own field, not the spec's
  });

  it('Defender: the state of an inventoried endpoint, with its threats counted', async () => {
    const states = (await request(app).get(`${DC}/MicrosoftDefender/WindowsEndpoints`)).body.data as Item[];
    const full = states.find((s) => s['microsoftDefenderState'] !== null) as Item;
    const state = full['microsoftDefenderState'] as Item;
    expect(state).toMatchObject({ realTimeScanDirection: 'IncomingAndOutgoingFiles', antimalware: expect.objectContaining({ runningMode: 'Normal' }) });
    expect(state['lastQuickScan']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect((state['antivirus'] as Item)['definitionCreation']).toMatch(/:\d{2}Z$/);
    const threats = (await request(app).get(`${DC}/MicrosoftDefender/WindowsEndpoints/${full['endpointId'] as string}/Threats`)).body.data as Item[];
    expect((state['activeThreats'] as number) + (state['resolvedThreats'] as number)).toBe(threats.length);
    expect(state['highestSeverity']).toBe((state['activeThreats'] as number) > 0 ? 'Severe' : 'None');
    const bare = states.find((s) => !endpoints.get(s['endpointId'] as string)?.['cpu']);
    expect(bare).toMatchObject({ microsoftDefenderState: null, isMicrosoftDefenderActive: expect.any(Boolean) });
  });
});
