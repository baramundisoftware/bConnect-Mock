/**
 * State Reset Integration Tests (Phase 4)
 *
 * Verifies POST /api/reset restores ALL entity types to their initial
 * fixture state: 20 endpoints + 10 software + jobs/assets/variables.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

describe('State Reset - All Entity Types (standard-readwrite)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.STANDARD_READWRITE);
  });

  it('should restore 10 WindowsEndpoints after mutations', async () => {
    await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'Extra-Win' });
    await request(app).post('/api/reset');
    const res = await request(app).get('/v2.0/WindowsEndpoints');
    expect(res.body.totalItems).toBe(10);
  });

  it('should restore 5 AndroidEndpoints after mutations', async () => {
    await request(app).post('/v2.0/AndroidEndpoints').send({ displayName: 'Extra-Android' });
    await request(app).post('/api/reset');
    const res = await request(app).get('/v2.0/AndroidEndpoints');
    expect(res.body.totalItems).toBe(5);
  });

  it('should restore 3 LinuxEndpoints after mutations', async () => {
    await request(app).post('/v2.0/LinuxEndpoints').send({ displayName: 'Extra-Linux' });
    await request(app).post('/api/reset');
    const res = await request(app).get('/v2.0/LinuxEndpoints');
    expect(res.body.totalItems).toBe(3);
  });

  it('should restore 2 MacEndpoints after mutations', async () => {
    await request(app).post('/v2.0/MacEndpoints').send({ displayName: 'Extra-Mac' });
    await request(app).post('/api/reset');
    const res = await request(app).get('/v2.0/MacEndpoints');
    expect(res.body.totalItems).toBe(2);
  });

  it('should restore 5 Jobs after mutations', async () => {
    await request(app).post('/v2.0/JobDefinitions').send({ name: 'Extra-Job', type: 'Test' });
    await request(app).post('/api/reset');
    const res = await request(app).get('/v2.0/JobDefinitions');
    expect(res.body.totalItems).toBe(5);
  });

  it('should restore 10 Assets after mutations', async () => {
    await request(app).post('/v2.0/Assets').send({ assetTypeId: 'at-001', name: 'EXTRA-ASSET', ownerId: 'u-001', ownerType: 'User', type: 'Laptop' });
    await request(app).post('/api/reset');
    const res = await request(app).get('/v2.0/Assets');
    expect(res.body.totalItems).toBe(10);
  });

  it('should restore 5 Variables after mutations', async () => {
    await request(app).post('/v2.0/Variables').send({ name: 'ExtraVar', type: 'String', values: ['A'] });
    await request(app).post('/api/reset');
    const res = await request(app).get('/v2.0/Variables');
    expect(res.body.totalItems).toBe(5);
  });

  it('should reset all entity types in one POST /api/reset call', async () => {
    // Mutate several types
    await request(app).post('/v2.0/WindowsEndpoints').send({ displayName: 'Mut-Win' });
    await request(app).post('/v2.0/AndroidEndpoints').send({ displayName: 'Mut-And' });
    await request(app).post('/v2.0/JobDefinitions').send({ name: 'Mut-Job', type: 'Test' });
    await request(app).post('/v2.0/Assets').send({ assetTypeId: 'at-001', name: 'MUT-ASSET', ownerId: 'u-001', ownerType: 'User', type: 'Server' });

    // Single reset restores all
    const resetRes = await request(app).post('/api/reset');
    expect(resetRes.status).toBe(200);

    const [winRes, andRes, jobRes, assetRes] = await Promise.all([
      request(app).get('/v2.0/WindowsEndpoints'),
      request(app).get('/v2.0/AndroidEndpoints'),
      request(app).get('/v2.0/JobDefinitions'),
      request(app).get('/v2.0/Assets'),
    ]);

    expect(winRes.body.totalItems).toBe(10);
    expect(andRes.body.totalItems).toBe(5);
    expect(jobRes.body.totalItems).toBe(5);
    expect(assetRes.body.totalItems).toBe(10);
  });
});
