/**
 * Paged lists: zero-indexed Page and the spec's PagedList envelope, on every list route.
 * The spec describes Page as "the zero-indexed number of the first page"; a live 26R1 bMS
 * answers {"currentPage":0,"pageSize":1,"totalPages":66,"totalItems":66,…}.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { ProfileMode, BmsVersion } from '../../src/profiles/ProfileManager';
import { MODULE_ROUTES } from '../../src/generated/moduleRoutes';
import { toPagedListEnvelope, effectivePageSize } from '../../src/middleware/pagedList';
import type { Express } from 'express';

const ENVELOPE_KEYS = ['currentPage', 'pageSize', 'totalPages', 'totalItems', 'hasPreviousPage', 'hasNextPage', 'data'];

/** A stable key for an item: projections have endpointId, folders and most entities have id */
function itemKey(item: Record<string, unknown>): string {
  return String(item['id'] ?? item['endpointId'] ?? item['name']);
}

/** Every parameter-free GET route of a version that answers with a list */
function listRoutes(version: BmsVersion): string[] {
  return Object.entries(MODULE_ROUTES[version] ?? {}).flatMap(([moduleName, routes]) =>
    routes.filter((r) => r.startsWith('GET ') && !r.includes('{}')).map((r) => `/bconnect/${moduleName}${r.slice(4)}`));
}

describe('toPagedListEnvelope', () => {
  it.each([
    // page, pageSize, totalItems → currentPage, totalPages, hasPreviousPage, hasNextPage
    [0, 5, 10, 0, 2, false, true],
    [1, 5, 10, 1, 2, true, false],
    [0, 5, 11, 0, 3, false, true],
    [2, 5, 11, 2, 3, true, false],
    [5, 5, 10, 5, 2, true, false],   // beyond the last page
    [0, 0, 0, 0, 0, false, false],   // empty list
    [0, 20, 3, 0, 1, false, false],
  ])('page %i, pageSize %i, %i items → currentPage %i, totalPages %i, prev %s, next %s',
    (page, pageSize, totalItems, currentPage, totalPages, hasPreviousPage, hasNextPage) => {
      const out = toPagedListEnvelope({ data: [], page, pageSize, totalItems });
      expect(out).toEqual({ currentPage, pageSize, totalPages, totalItems, hasPreviousPage, hasNextPage, data: [] });
      expect(Object.keys(out)).toEqual(ENVELOPE_KEYS);
    });
});

describe('effectivePageSize (live bMS: default 20, at most 1000, never an error)', () => {
  it.each([
    [undefined, 20], ['', 20], ['0', 20], ['-1', 20], ['abc', 20], ['2.5', 20],
    ['1', 1], ['20', 20], ['999', 999], ['1000', 1000], ['1001', 1000], ['5000', 1000],
  ])('%j → %i', (raw, expected) => {
    expect(effectivePageSize(raw)).toBe(expected);
  });
});

describe('PageSize defaults over HTTP', () => {
  let app: Express;
  const LIST = '/bconnect/endpoints/v2.0/Endpoints'; // 31 endpoints in standard-readonly 26R1

  beforeAll(() => {
    const previous = process.env.BCONNECT_MODULE_ROUTING;
    process.env.BCONNECT_MODULE_ROUTING = 'strict';
    try { app = createApp(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1); } finally {
      if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
    }
  });

  it.each([
    ['', 20], ['?PageSize=0', 20], ['?PageSize=-5', 20], ['?PageSize=x', 20],
    ['?PageSize=5000', 1000], ['?pagesize=3', 3], ['?PAGESIZE=4', 4],
  ])('%s → pageSize %i', async (query, pageSize) => {
    const res = await request(app).get(`${LIST}${query}`);
    expect(res.status).toBe(200);
    expect(res.body.pageSize).toBe(pageSize);
    expect(res.body.data).toHaveLength(Math.min(pageSize, res.body.totalItems));
  });

  it('pages a list longer than 20 by default', async () => {
    const res = await request(app).get(LIST);
    expect(res.body.totalItems).toBeGreaterThan(20);
    expect(res.body).toMatchObject({ currentPage: 0, pageSize: 20, hasNextPage: true });
    expect(res.body.totalPages).toBe(Math.ceil(res.body.totalItems / 20));
  });

  it('keeps the other query parameters when it adds PageSize', async () => {
    const sorted = await request(app).get(`${LIST}?OrderBy=DisplayName%20desc&SearchQuery=NYC`);
    const explicit = await request(app).get(`${LIST}?OrderBy=DisplayName%20desc&SearchQuery=NYC&PageSize=20`);
    expect(sorted.body.data.length).toBeGreaterThan(0);
    expect(sorted.body).toEqual(explicit.body);
  });
});

describe.each([BmsVersion.BMS_25R2, BmsVersion.BMS_26R1])('Paged lists on every list route (%s)', (version) => {
  let app: Express;

  beforeAll(() => {
    const previous = process.env.BCONNECT_MODULE_ROUTING;
    process.env.BCONNECT_MODULE_ROUTING = 'strict';
    try { app = createApp(ProfileMode.STANDARD_READONLY, version); } finally {
      if (previous === undefined) { delete process.env.BCONNECT_MODULE_ROUTING; } else { process.env.BCONNECT_MODULE_ROUTING = previous; }
    }
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('answers with the spec envelope, in the spec\'s field order', async () => {
    const wrong: string[] = [];
    for (const url of listRoutes(version)) {
      const res = await request(app).get(url);
      if (!Array.isArray(res.body?.data)) { continue; }
      const keys = Object.keys(res.body);
      if (JSON.stringify(keys.slice(0, ENVELOPE_KEYS.length)) !== JSON.stringify(ENVELOPE_KEYS) || 'page' in res.body) {
        wrong.push(`${url}: ${keys.join(',')}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('Page=1 returns the second page (zero-indexed), with consistent paging flags', async () => {
    const wrong: string[] = [];
    let checked = 0;
    for (const url of listRoutes(version)) {
      const all = await request(app).get(url);
      if (!Array.isArray(all.body?.data) || all.body.data.length < 2) { continue; }
      const second = await request(app).get(`${url}?PageSize=1&Page=1`);
      const b = second.body;
      const ok = itemKey(b.data[0]) === itemKey(all.body.data[1])
        && b.currentPage === 1 && b.pageSize === 1 && b.totalItems === all.body.totalItems
        && b.totalPages === all.body.totalItems && b.hasPreviousPage === true
        && b.hasNextPage === (all.body.totalItems > 2);
      if (!ok) { wrong.push(`${url}: ${JSON.stringify({ ...b, data: b.data?.map(itemKey) })}`); }
      checked++;
    }
    expect(wrong).toEqual([]);
    expect(checked).toBeGreaterThan(30);
  });
});
