import { describe, it, expect } from 'vitest';
import { UniversalDynamicGroupsGenerator } from '../../../src/generators/UDGGenerator';
import { ApiKeysGenerator } from '../../../src/generators/ApiKeysGenerator';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// UniversalDynamicGroupsGenerator
// ---------------------------------------------------------------------------
describe('UniversalDynamicGroupsGenerator', () => {
  const gen = new UniversalDynamicGroupsGenerator();

  it('has totalItems 500 and entityType "universalDynamicGroups"', () => {
    expect(gen.totalItems).toBe(500);
    expect(gen.entityType).toBe('universalDynamicGroups');
  });

  it('returns all required fields', () => {
    const item = gen.generateItem(0);
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('comment');
    expect(item).toHaveProperty('folderName');
    expect(item).toHaveProperty('folderId');
  });

  it('id is a valid GUID', () => {
    expect(gen.generateItem(0).id).toMatch(GUID_REGEX);
    expect(gen.generateItem(499).id).toMatch(GUID_REGEX);
  });

  it('folderId is a valid GUID', () => {
    expect(gen.generateItem(0).folderId).toMatch(GUID_REGEX);
  });

  it('folderName is a non-empty string', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).folderName).toBeTruthy();
    }
  });

  it('all 500 group IDs are unique', () => {
    const ids = new Set(Array.from({ length: 500 }, (_, i) => gen.generateItem(i).id));
    expect(ids.size).toBe(500);
  });

  it('throws RangeError for out-of-range index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
    expect(() => gen.generateItem(500)).toThrow(RangeError);
  });

  it('is deterministic', () => {
    expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
    expect(gen.generateItem(499)).toEqual(gen.generateItem(499));
  });

  it('generatePage returns correct count', () => {
    expect(gen.generatePage({ page: 0, pageSize: 50 })).toHaveLength(50);
  });
});

// ---------------------------------------------------------------------------
// ApiKeysGenerator
// ---------------------------------------------------------------------------
describe('ApiKeysGenerator', () => {
  const gen = new ApiKeysGenerator();

  it('has totalItems 50 and entityType "apiKeys"', () => {
    expect(gen.totalItems).toBe(50);
    expect(gen.entityType).toBe('apiKeys');
  });

  it('returns all required fields', () => {
    const item = gen.generateItem(0);
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('expirationDate');
    expect(item).toHaveProperty('comment');
    expect(item).toHaveProperty('isActive');
    expect(item).toHaveProperty('isAvailableViaGateway');
    expect(item).toHaveProperty('securityProfiles');
  });

  it('id is a valid GUID', () => {
    expect(gen.generateItem(0).id).toMatch(GUID_REGEX);
    expect(gen.generateItem(49).id).toMatch(GUID_REGEX);
  });

  it('expirationDate is a valid ISO date string', () => {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    for (let i = 0; i < 10; i++) {
      expect(gen.generateItem(i).expirationDate).toMatch(isoDateRegex);
    }
  });

  it('isActive and isAvailableViaGateway are booleans', () => {
    for (let i = 0; i < 20; i++) {
      expect(typeof gen.generateItem(i).isActive).toBe('boolean');
      expect(typeof gen.generateItem(i).isAvailableViaGateway).toBe('boolean');
    }
  });

  it('securityProfiles is an array', () => {
    for (let i = 0; i < 20; i++) {
      expect(Array.isArray(gen.generateItem(i).securityProfiles)).toBe(true);
    }
  });

  it('all 50 IDs are unique', () => {
    const ids = new Set(Array.from({ length: 50 }, (_, i) => gen.generateItem(i).id));
    expect(ids.size).toBe(50);
  });

  it('throws RangeError for out-of-range index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
    expect(() => gen.generateItem(50)).toThrow(RangeError);
  });

  it('is deterministic', () => {
    expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
    expect(gen.generateItem(49)).toEqual(gen.generateItem(49));
  });
});
