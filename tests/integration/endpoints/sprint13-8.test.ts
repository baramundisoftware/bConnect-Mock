/**
 * Sprint 13.8 — Naming alignment & legacy alias verification (P13.8.4)
 * Verifies: legacy aliases work in 25R2 mode, new 26R1 names work in 26R1 mode.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../../src/app';
import { ProfileMode, BmsVersion } from '../../../src/profiles/ProfileManager';

describe('P13.8.4 — Legacy aliases in 25R2 mode', () => {
  let app25r2: Express;

  beforeAll(() => {
    app25r2 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_25R2);
  });

  it('GET /v2.0/Software returns 200 in 25R2 (legacy alias)', async () => {
    const res = await request(app25r2).get('/v2.0/Software').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Variables returns 200 in 25R2 (legacy alias)', async () => {
    const res = await request(app25r2).get('/v2.0/Variables').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/InstalledWindowsSoftware returns 200 in 25R2 (new name also active)', async () => {
    const res = await request(app25r2).get('/v2.0/InstalledWindowsSoftware').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/VariableDefinitions returns 200 in 25R2 (new name also active)', async () => {
    const res = await request(app25r2).get('/v2.0/VariableDefinitions').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('P13.8.4 — New names in 26R1 mode', () => {
  let app26r1: Express;

  beforeAll(() => {
    app26r1 = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
  });

  it('GET /v2.0/InstalledWindowsSoftware returns 200 in 26R1 (new 26R1 name)', async () => {
    const res = await request(app26r1).get('/v2.0/InstalledWindowsSoftware').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/VariableDefinitions returns 200 in 26R1 (new 26R1 name)', async () => {
    const res = await request(app26r1).get('/v2.0/VariableDefinitions').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/VariableInstances returns 200 in 26R1', async () => {
    const res = await request(app26r1).get('/v2.0/VariableInstances').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Folders returns 200 in 26R1 (jobs context, new 26R1 name)', async () => {
    const res = await request(app26r1).get('/v2.0/Folders').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /v2.0/Software returns 200 in 26R1 (25R2 alias still available)', async () => {
    const res = await request(app26r1).get('/v2.0/Software').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
