/**
 * Coverage Fix — utils.ts unit tests
 *
 * Tests uncovered branches in resolveEntityData and related functions:
 *  - generator path with filter/sort (lines 126-136)
 *  - fixture returns non-array → null (line 146)
 *  - fixture returns empty array → null (line 150)
 *  - compareValues with date fields and number fields
 *  - applyMultiKeywordSearch with multi-keyword path
 *  - parsePage edge cases
 */

import { describe, it, expect } from 'vitest';
import {
  resolveEntityData,
  applyMultiFieldSort,
  applyMultiKeywordSearch,
  parsePage,
} from '../../src/routes/utils';
import type { IProfile } from '../../src/profiles/ProfileManager';
import type { IDataGenerator } from '../../src/generators/IDataGenerator';

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeStaticProfile(fixture: unknown): IProfile {
  return {
    getFixture: () => fixture as never,
    getGenerator: () => null,
  } as unknown as IProfile;
}

function makeGeneratorProfile(items: Record<string, unknown>[]): IProfile {
  const gen: IDataGenerator = {
    totalItems: items.length,
    entityType: 'entities',
    generateItem: (i: number) => items[i] as never,
    generatePage: ({ page, pageSize }: { page: number; pageSize: number }) =>
      items.slice(page * pageSize, page * pageSize + pageSize) as never[],
    [Symbol.iterator]: function* () { yield* items; },
  };
  return {
    getFixture: () => [] as never,
    getGenerator: () => gen,
  } as unknown as IProfile;
}

// ─── parsePage ────────────────────────────────────────────────────────────────

describe('parsePage', () => {
  it('converts 1-based Page=1 to 0', () => {
    expect(parsePage('1')).toBe(0);
  });

  it('converts 1-based Page=3 to 2', () => {
    expect(parsePage('3')).toBe(2);
  });

  it('returns 0 for undefined', () => {
    expect(parsePage(undefined)).toBe(0);
  });

  it('returns 0 for 0 (invalid, below minimum)', () => {
    expect(parsePage('0')).toBe(0);
  });

  it('returns 0 for negative values', () => {
    expect(parsePage('-1')).toBe(0);
  });

  it('returns 0 for NaN string', () => {
    expect(parsePage('abc')).toBe(0);
  });
});

// ─── resolveEntityData — fixture path ─────────────────────────────────────────

describe('resolveEntityData — static fixture path', () => {
  it('returns null when fixture is not an array', () => {
    const profile = makeStaticProfile({ notAnArray: true });
    const result = resolveEntityData(profile, 'whatever', { page: 0, pageSize: 10 });
    expect(result).toBeNull();
  });

  it('returns null when fixture array is empty', () => {
    const profile = makeStaticProfile([]);
    const result = resolveEntityData(profile, 'whatever', { page: 0, pageSize: 10 });
    expect(result).toBeNull();
  });

  it('returns paginated data for non-empty fixture', () => {
    const items = [{ id: '1', name: 'A' }, { id: '2', name: 'B' }, { id: '3', name: 'C' }];
    const profile = makeStaticProfile(items);
    const result = resolveEntityData(profile, 'whatever', { page: 0, pageSize: 2 });
    expect(result).not.toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.totalItems).toBe(3);
  });

  it('applies searchQuery filter on fixture', () => {
    const items = [{ id: '1', name: 'Alpha' }, { id: '2', name: 'Beta' }];
    const profile = makeStaticProfile(items);
    const result = resolveEntityData(profile, 'whatever', {
      searchQuery: 'Alpha',
      page: 0,
      pageSize: 10,
      searchFields: ['name'],
    });
    expect(result.data).toHaveLength(1);
    expect((result.data[0] as { name: string }).name).toBe('Alpha');
  });

  it('applies orderBy sort on fixture', () => {
    const items = [{ id: '2', name: 'Beta' }, { id: '1', name: 'Alpha' }];
    const profile = makeStaticProfile(items);
    const result = resolveEntityData(profile, 'whatever', {
      orderBy: 'name asc',
      page: 0,
      pageSize: 10,
    });
    expect((result.data[0] as { name: string }).name).toBe('Alpha');
  });

  it('uses total length as effective page size when pageSize is 0', () => {
    const items = [{ id: '1' }, { id: '2' }, { id: '3' }];
    const profile = makeStaticProfile(items);
    const result = resolveEntityData(profile, 'whatever', { page: 0, pageSize: 0 });
    expect(result.data).toHaveLength(3);
  });
});

// ─── resolveEntityData — generator path ────────────────────────────────────────

describe('resolveEntityData — generator path', () => {
  it('returns paginated data from generator (no filter/sort)', () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ id: String(i), name: `Item${i}` }));
    const profile = makeGeneratorProfile(items);
    const result = resolveEntityData(profile, 'entities', { page: 0, pageSize: 3 });
    expect(result).not.toBeNull();
    expect(result.data).toHaveLength(3);
    expect(result.totalItems).toBe(5);
  });

  it('applies searchQuery filter when generator is used', () => {
    const items = [
      { id: '1', name: 'AlphaEndpoint' },
      { id: '2', name: 'BetaEndpoint' },
      { id: '3', name: 'AlphaServer' },
    ];
    const profile = makeGeneratorProfile(items);
    const result = resolveEntityData(profile, 'entities', {
      searchQuery: 'Alpha',
      page: 0,
      pageSize: 10,
      searchFields: ['name'],
    });
    expect(result.data).toHaveLength(2);
  });

  it('applies orderBy sort when generator is used', () => {
    const items = [{ id: '2', name: 'Beta' }, { id: '1', name: 'Alpha' }];
    const profile = makeGeneratorProfile(items);
    const result = resolveEntityData(profile, 'entities', {
      orderBy: 'name asc',
      page: 0,
      pageSize: 10,
    });
    expect((result.data[0] as { name: string }).name).toBe('Alpha');
  });

  it('applies both filter and sort when generator is used', () => {
    const items = [
      { id: '1', name: 'AlphaZ' },
      { id: '2', name: 'BetaX' },
      { id: '3', name: 'AlphaA' },
    ];
    const profile = makeGeneratorProfile(items);
    const result = resolveEntityData(profile, 'entities', {
      searchQuery: 'Alpha',
      orderBy: 'name asc',
      page: 0,
      pageSize: 10,
      searchFields: ['name'],
    });
    expect(result.data).toHaveLength(2);
    expect((result.data[0] as { name: string }).name).toBe('AlphaA');
  });

  it('paginates filtered generator results', () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `Alpha${i}` }));
    const profile = makeGeneratorProfile(items);
    const result = resolveEntityData(profile, 'entities', {
      searchQuery: 'Alpha',
      page: 1,
      pageSize: 2,
      searchFields: ['name'],
    });
    expect(result.data).toHaveLength(2);
    expect(result.totalItems).toBe(6);
  });
});

// ─── applyMultiFieldSort ──────────────────────────────────────────────────────

describe('applyMultiFieldSort', () => {
  it('sorts by numeric field', () => {
    const data = [{ count: 3 }, { count: 1 }, { count: 2 }];
    const result = applyMultiFieldSort(data, 'count asc');
    expect(result.map((d) => d.count)).toEqual([1, 2, 3]);
  });

  it('sorts by date field (lastSeen)', () => {
    const data = [
      { lastSeen: '2024-01-03T00:00:00Z' },
      { lastSeen: '2024-01-01T00:00:00Z' },
      { lastSeen: '2024-01-02T00:00:00Z' },
    ];
    const result = applyMultiFieldSort(data, 'lastSeen asc');
    expect(result[0].lastSeen).toBe('2024-01-01T00:00:00Z');
    expect(result[2].lastSeen).toBe('2024-01-03T00:00:00Z');
  });

  it('sorts desc', () => {
    const data = [{ name: 'Alpha' }, { name: 'Charlie' }, { name: 'Beta' }];
    const result = applyMultiFieldSort(data, 'name desc');
    expect(result[0].name).toBe('Charlie');
  });

  it('handles multi-field sort', () => {
    const data = [
      { group: 'B', name: 'Alpha' },
      { group: 'A', name: 'Zeta' },
      { group: 'A', name: 'Alpha' },
    ];
    const result = applyMultiFieldSort(data, 'group asc,name asc');
    expect(result[0].group).toBe('A');
    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Zeta');
  });

  it('handles unknown field gracefully (returns 0 comparison)', () => {
    const data = [{ id: 2 }, { id: 1 }];
    const result = applyMultiFieldSort(data, 'nonexistentField asc');
    // Should not throw, order is stable-ish
    expect(result).toHaveLength(2);
  });
});

// ─── applyMultiKeywordSearch ──────────────────────────────────────────────────

describe('applyMultiKeywordSearch', () => {
  it('returns all items when searchQuery is empty', () => {
    const data = [{ name: 'Alpha' }, { name: 'Beta' }];
    const result = applyMultiKeywordSearch(data, '  ', ['name']);
    expect(result).toHaveLength(2);
  });

  it('single keyword matches primary field', () => {
    const data = [{ name: 'Alpha' }, { name: 'Beta' }];
    const result = applyMultiKeywordSearch(data, 'alp', ['name']);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Alpha');
  });

  it('multiple keywords match any of them against any searchable field', () => {
    const data = [
      { name: 'Alpha', status: 'active' },
      { name: 'Beta', status: 'inactive' },
      { name: 'Gamma', status: 'active' },
    ];
    const result = applyMultiKeywordSearch(data, 'alpha inactive', ['name', 'status']);
    // Should match items where ANY keyword matches ANY field
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array when nothing matches', () => {
    const data = [{ name: 'Alpha' }, { name: 'Beta' }];
    const result = applyMultiKeywordSearch(data, 'xyz abc', ['name']);
    expect(result).toHaveLength(0);
  });
});
