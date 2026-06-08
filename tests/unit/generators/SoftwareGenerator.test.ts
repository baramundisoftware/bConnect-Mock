import { describe, it, expect } from 'vitest';
import { SoftwareGenerator } from '../../../src/generators/SoftwareGenerator';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('SoftwareGenerator', () => {
  const gen = new SoftwareGenerator();

  describe('metadata', () => {
    it('has totalItems of 500', () => {
      expect(gen.totalItems).toBe(500);
    });

    it('has entityType "software"', () => {
      expect(gen.entityType).toBe('software');
    });
  });

  describe('generateItem — structure', () => {
    it('returns all required fields at index 0', () => {
      const item = gen.generateItem(0);
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
      expect(item).toHaveProperty('version');
      expect(item).toHaveProperty('vendor');
      expect(item).toHaveProperty('installCount');
      expect(item).toHaveProperty('category');
    });

    it('id is a valid GUID', () => {
      expect(gen.generateItem(0).id).toMatch(GUID_REGEX);
      expect(gen.generateItem(99).id).toMatch(GUID_REGEX);
      expect(gen.generateItem(499).id).toMatch(GUID_REGEX);
    });

    it('installCount is in range 50–999', () => {
      for (let i = 0; i < 50; i++) {
        const { installCount } = gen.generateItem(i);
        expect(installCount).toBeGreaterThanOrEqual(50);
        expect(installCount).toBeLessThanOrEqual(999);
      }
    });

    it('category is a non-empty string', () => {
      for (let i = 0; i < 20; i++) {
        expect(gen.generateItem(i).category).toBeTruthy();
      }
    });

    it('version contains dot-separated numbers', () => {
      const versionRegex = /^\d+\.\d+/;
      for (let i = 0; i < 20; i++) {
        expect(gen.generateItem(i).version).toMatch(versionRegex);
      }
    });
  });

  describe('generateItem — boundary conditions', () => {
    it('generates item at index 0 (first)', () => {
      expect(() => gen.generateItem(0)).not.toThrow();
    });

    it('generates item at index 499 (last)', () => {
      expect(() => gen.generateItem(499)).not.toThrow();
    });

    it('throws RangeError for negative index', () => {
      expect(() => gen.generateItem(-1)).toThrow(RangeError);
    });

    it('throws RangeError for index >= totalItems', () => {
      expect(() => gen.generateItem(500)).toThrow(RangeError);
    });
  });

  describe('determinism', () => {
    it('same index always produces same item', () => {
      for (const idx of [0, 42, 249, 499]) {
        expect(gen.generateItem(idx)).toEqual(gen.generateItem(idx));
      }
    });

    it('different indices produce different IDs', () => {
      const ids = new Set(Array.from({ length: 500 }, (_, i) => gen.generateItem(i).id));
      expect(ids.size).toBe(500);
    });
  });

  describe('generatePage', () => {
    it('returns 50 items for page 0, pageSize 50', () => {
      expect(gen.generatePage({ page: 0, pageSize: 50 })).toHaveLength(50);
    });

    it('page 0 item[0] equals generateItem(0)', () => {
      expect(gen.generatePage({ page: 0, pageSize: 10 })[0]).toEqual(gen.generateItem(0));
    });

    it('last page has correct number of items', () => {
      // 500 / 50 = 10 pages, page 9 is last with 50 items
      expect(gen.generatePage({ page: 9, pageSize: 50 })).toHaveLength(50);
    });

    it('returns empty array for page beyond totalItems', () => {
      expect(gen.generatePage({ page: 100, pageSize: 50 })).toHaveLength(0);
    });
  });

  describe('[Symbol.iterator]', () => {
    it('iterates exactly 500 items', () => {
      let count = 0;
      for (const _ of gen) { count++; }
      expect(count).toBe(500);
    });

    it('first item from iterator equals generateItem(0)', () => {
      const first = gen[Symbol.iterator]().next().value;
      expect(first).toEqual(gen.generateItem(0));
    });
  });
});
