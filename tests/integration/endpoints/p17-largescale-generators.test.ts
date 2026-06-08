/**
 * Phase 17 Integration Tests — Large-Scale Generator Routes
 *
 * Verifies that GET /v2.0/ADGroups, GET /v2.0/Assets, and
 * GET /v2.0/JobDefinitions return generator-sourced data when the
 * largescale-readonly profile is active.
 *
 * Covers: basic 200 response, totalItems, pagination, and search.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../src/app';
import { ProfileMode } from '../../../src/profiles/ProfileManager';
import type { Express } from 'express';

// ============================================================================
// ADGroups — large-scale profile
// ============================================================================

describe('GET /v2.0/ADGroups (largescale-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.LARGESCALE_READONLY);
  });

  it('returns 200 with a data array', async () => {
    const res = await request(app).get('/v2.0/ADGroups').query({ PageSize: 10 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('reports totalItems of 500 from the generator', async () => {
    const res = await request(app).get('/v2.0/ADGroups').query({ PageSize: 10 });
    expect(res.body.totalItems).toBe(500);
  });

  it('respects PageSize parameter', async () => {
    const res = await request(app).get('/v2.0/ADGroups').query({ PageSize: 25 });
    expect(res.body.data).toHaveLength(25);
    expect(res.body.pageSize).toBe(25);
  });

  it('page 1 and page 2 have no overlapping IDs', async () => {
    const p0 = await request(app).get('/v2.0/ADGroups').query({ PageSize: 50, Page: 1 });
    const p1 = await request(app).get('/v2.0/ADGroups').query({ PageSize: 50, Page: 2 });
    const ids0 = new Set(p0.body.data.map((g: { id: string }) => g.id));
    for (const group of p1.body.data) {
      expect(ids0.has(group.id)).toBe(false);
    }
  });

  it('returns correct fields on each record', async () => {
    const res = await request(app).get('/v2.0/ADGroups').query({ PageSize: 5 });
    for (const group of res.body.data) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('distinguishedName');
      expect(group).toHaveProperty('groupScope');
      expect(group).toHaveProperty('groupType');
      expect(group).toHaveProperty('memberCount');
    }
  });

  it('SearchQuery filters results', async () => {
    // All groups contain a known word — pick one and search for it
    const baseline = await request(app).get('/v2.0/ADGroups').query({ PageSize: 10 });
    const sampleName: string = baseline.body.data[0].name as string;
    const word = sampleName.split(' ')[0];

    const res = await request(app).get('/v2.0/ADGroups').query({ SearchQuery: word });
    expect(res.status).toBe(200);
    // All returned items should contain the search word (case-insensitive)
    for (const group of res.body.data) {
      const haystack = `${group.name} ${group.distinguishedName} ${group.groupType}`.toLowerCase();
      expect(haystack).toContain(word.toLowerCase());
    }
  });
});

// ============================================================================
// Assets — large-scale profile
// ============================================================================

describe('GET /v2.0/Assets (largescale-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.LARGESCALE_READONLY);
  });

  it('returns 200 with a data array', async () => {
    const res = await request(app).get('/v2.0/Assets').query({ PageSize: 10 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('reports totalItems of 5000 from the generator', async () => {
    const res = await request(app).get('/v2.0/Assets').query({ PageSize: 10 });
    expect(res.body.totalItems).toBe(5_000);
  });

  it('respects PageSize parameter', async () => {
    const res = await request(app).get('/v2.0/Assets').query({ PageSize: 20 });
    expect(res.body.data).toHaveLength(20);
    expect(res.body.pageSize).toBe(20);
  });

  it('page 1 and page 2 have no overlapping IDs', async () => {
    const p0 = await request(app).get('/v2.0/Assets').query({ PageSize: 100, Page: 1 });
    const p1 = await request(app).get('/v2.0/Assets').query({ PageSize: 100, Page: 2 });
    const ids0 = new Set(p0.body.data.map((a: { id: string }) => a.id));
    for (const asset of p1.body.data) {
      expect(ids0.has(asset.id)).toBe(false);
    }
  });

  it('returns correct fields on each record', async () => {
    const res = await request(app).get('/v2.0/Assets').query({ PageSize: 5 });
    for (const asset of res.body.data) {
      expect(asset).toHaveProperty('id');
      expect(asset).toHaveProperty('assetTag');
      expect(asset).toHaveProperty('type');
      expect(asset).toHaveProperty('location');
      expect(asset).toHaveProperty('department');
    }
  });

  it('SearchQuery filters results by assetTag (primary field, single-keyword)', async () => {
    // Single-keyword search targets the primary field: assetTag (e.g. AST-NYC-001)
    const res = await request(app).get('/v2.0/Assets').query({ SearchQuery: 'NYC' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const asset of res.body.data) {
      expect((asset.assetTag as string).toLowerCase()).toContain('nyc');
    }
  });
});

// ============================================================================
// JobDefinitions — large-scale profile
// ============================================================================

describe('GET /v2.0/JobDefinitions (largescale-readonly)', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp(ProfileMode.LARGESCALE_READONLY);
  });

  it('returns 200 with a data array', async () => {
    const res = await request(app).get('/v2.0/JobDefinitions').query({ PageSize: 10 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('reports totalItems of 1000 from the generator', async () => {
    const res = await request(app).get('/v2.0/JobDefinitions').query({ PageSize: 10 });
    expect(res.body.totalItems).toBe(1_000);
  });

  it('respects PageSize parameter', async () => {
    const res = await request(app).get('/v2.0/JobDefinitions').query({ PageSize: 15 });
    expect(res.body.data).toHaveLength(15);
    expect(res.body.pageSize).toBe(15);
  });

  it('page 1 and page 2 have no overlapping IDs', async () => {
    const p0 = await request(app).get('/v2.0/JobDefinitions').query({ PageSize: 50, Page: 1 });
    const p1 = await request(app).get('/v2.0/JobDefinitions').query({ PageSize: 50, Page: 2 });
    const ids0 = new Set(p0.body.data.map((j: { id: string }) => j.id));
    for (const job of p1.body.data) {
      expect(ids0.has(job.id)).toBe(false);
    }
  });

  it('returns correct fields on each record', async () => {
    const res = await request(app).get('/v2.0/JobDefinitions').query({ PageSize: 5 });
    for (const job of res.body.data) {
      expect(job).toHaveProperty('id');
      expect(job).toHaveProperty('name');
      expect(job).toHaveProperty('type');
      expect(job).toHaveProperty('status');
    }
  });

  it('SearchQuery filters results by name/type', async () => {
    const res = await request(app).get('/v2.0/JobDefinitions').query({ SearchQuery: 'Deploy' });
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    for (const job of res.body.data) {
      const haystack = `${job.name} ${job.type}`.toLowerCase();
      expect(haystack).toContain('deploy');
    }
  });
});

// ============================================================================
// Key mismatch regression — verifies P17.7 bug fix
// ============================================================================

describe('JobDefinitionGenerator key regression (P17.7 bug fix)', () => {
  it('largescale-readonly resolves "jobs" key to JobDefinitionGenerator', async () => {
    // If the key mismatch bug were present, totalItems would equal the fixture
    // count (~10), not the generator count (1000).
    const app = createApp(ProfileMode.LARGESCALE_READONLY);
    const res = await request(app).get('/v2.0/JobDefinitions').query({ PageSize: 10 });
    expect(res.body.totalItems).toBe(1_000);
  });
});
