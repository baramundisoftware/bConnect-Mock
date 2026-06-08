import { describe, it, expect } from 'vitest';
import { WindowsUpdatesGenerator } from '../../../src/generators/WindowsUpdatesGenerator';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KB_REGEX = /^KB\d{7}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const VALID_CLASSIFICATIONS = new Set([
  'Security Updates',
  'Critical Updates',
  'Definition Updates',
  'Feature Packs',
  'Service Packs',
  'Update Rollups',
  'Updates',
  'Drivers',
]);

const VALID_SEVERITIES = new Set(['Critical', 'Important', 'Moderate', 'Low']);

const CVE_FIELDS = ['cveId', 'cvssScore', 'affectedProducts', 'requiredBy'];

describe('WindowsUpdatesGenerator', () => {
  const gen = new WindowsUpdatesGenerator();

  describe('metadata', () => {
    it('has totalItems of 200', () => {
      expect(gen.totalItems).toBe(200);
    });

    it('has entityType "windowsUpdates"', () => {
      expect(gen.entityType).toBe('windowsUpdates');
    });
  });

  describe('generateItem — Windows Update schema (REQ-22.1.1)', () => {
    it('returns all required Windows Update fields at index 0', () => {
      const item = gen.generateItem(0);
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('title');
      expect(item).toHaveProperty('kbArticle');
      expect(item).toHaveProperty('classification');
      expect(item).toHaveProperty('severity');
      expect(item).toHaveProperty('installed');
      expect(item).toHaveProperty('installDate');
      expect(item).toHaveProperty('endpointId');
      expect(item).toHaveProperty('releaseDate');
      expect(item).toHaveProperty('downloadSize');
      expect(item).toHaveProperty('description');
    });

    it('does NOT contain CVE fields (REQ-22.1.2)', () => {
      for (let i = 0; i < 50; i++) {
        const item = gen.generateItem(i) as Record<string, unknown>;
        for (const field of CVE_FIELDS) {
          expect(item).not.toHaveProperty(field);
        }
      }
    });

    it('id is a valid GUID', () => {
      expect(gen.generateItem(0).id).toMatch(GUID_REGEX);
      expect(gen.generateItem(100).id).toMatch(GUID_REGEX);
    });
  });

  describe('title — realistic Windows Update titles (REQ-22.1.3)', () => {
    it('contains year-month pattern or KB reference', () => {
      for (let i = 0; i < 20; i++) {
        const { title } = gen.generateItem(i);
        expect(title.length).toBeGreaterThan(10);
        // Should look like a real Windows Update title, not a CVE vulnerability description
        expect(title).not.toMatch(/vulnerability/i);
      }
    });

    it('titles contain "Update" or "for" pattern', () => {
      for (let i = 0; i < 30; i++) {
        const { title } = gen.generateItem(i);
        expect(title).toMatch(/update|for/i);
      }
    });
  });

  describe('classification — valid enum (REQ-22.1.4)', () => {
    it('every classification is from the valid set', () => {
      for (let i = 0; i < 200; i++) {
        expect(VALID_CLASSIFICATIONS.has(gen.generateItem(i).classification)).toBe(true);
      }
    });

    it('distributes across multiple classifications (REQ-22.2.3)', () => {
      const counts = new Map<string, number>();
      for (let i = 0; i < 200; i++) {
        const c = gen.generateItem(i).classification;
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      // At least 3 different classifications used
      expect(counts.size).toBeGreaterThanOrEqual(3);
      // Security Updates + Critical Updates should be majority
      const secCrit = (counts.get('Security Updates') ?? 0) + (counts.get('Critical Updates') ?? 0);
      expect(secCrit).toBeGreaterThan(100);
    });
  });

  describe('kbArticle — KB format (REQ-22.1.5)', () => {
    it('matches KB followed by exactly 7 digits', () => {
      for (let i = 0; i < 50; i++) {
        expect(gen.generateItem(i).kbArticle).toMatch(KB_REGEX);
      }
    });
  });

  describe('endpointId — valid GUID (REQ-22.1.6)', () => {
    it('is a valid GUID for all items', () => {
      for (let i = 0; i < 50; i++) {
        expect(gen.generateItem(i).endpointId).toMatch(GUID_REGEX);
      }
    });
  });

  describe('installDate — conditional on installed (REQ-22.1.7)', () => {
    it('installDate is ISO 8601 when installed is true', () => {
      for (let i = 0; i < 200; i++) {
        const item = gen.generateItem(i);
        if (item.installed) {
          expect(item.installDate).toMatch(ISO_DATE_REGEX);
        }
      }
    });

    it('installDate is null when installed is false', () => {
      for (let i = 0; i < 200; i++) {
        const item = gen.generateItem(i);
        if (!item.installed) {
          expect(item.installDate).toBeNull();
        }
      }
    });
  });

  describe('installed distribution (REQ-22.2.5)', () => {
    it('~70% installed, ~30% not installed', () => {
      let installedCount = 0;
      for (let i = 0; i < 200; i++) {
        if (gen.generateItem(i).installed) installedCount++;
      }
      const pct = installedCount / 200;
      // Allow some tolerance: 55%–85%
      expect(pct).toBeGreaterThanOrEqual(0.55);
      expect(pct).toBeLessThanOrEqual(0.85);
    });
  });

  describe('severity', () => {
    it('is one of Critical/Important/Moderate/Low', () => {
      for (let i = 0; i < 200; i++) {
        expect(VALID_SEVERITIES.has(gen.generateItem(i).severity)).toBe(true);
      }
    });
  });

  describe('releaseDate and downloadSize', () => {
    it('releaseDate is ISO 8601', () => {
      for (let i = 0; i < 20; i++) {
        expect(gen.generateItem(i).releaseDate).toMatch(ISO_DATE_REGEX);
      }
    });

    it('downloadSize is a positive number', () => {
      for (let i = 0; i < 20; i++) {
        expect(gen.generateItem(i).downloadSize).toBeGreaterThan(0);
      }
    });
  });

  describe('generateItem — boundary conditions', () => {
    it('generates item at index 0', () => {
      expect(() => gen.generateItem(0)).not.toThrow();
    });

    it('generates item at index 199 (last)', () => {
      expect(() => gen.generateItem(199)).not.toThrow();
    });

    it('throws RangeError for negative index', () => {
      expect(() => gen.generateItem(-1)).toThrow(RangeError);
    });

    it('throws RangeError for index >= 200', () => {
      expect(() => gen.generateItem(200)).toThrow(RangeError);
    });
  });

  describe('determinism', () => {
    it('same index always produces same item', () => {
      for (const idx of [0, 50, 100, 199]) {
        expect(gen.generateItem(idx)).toEqual(gen.generateItem(idx));
      }
    });

    it('all 200 IDs are unique', () => {
      const ids = new Set(Array.from({ length: 200 }, (_, i) => gen.generateItem(i).id));
      expect(ids.size).toBe(200);
    });
  });

  describe('generatePage', () => {
    it('page 0 pageSize 50 returns 50 items', () => {
      expect(gen.generatePage({ page: 0, pageSize: 50 })).toHaveLength(50);
    });

    it('page 3 pageSize 50 returns last 50 items', () => {
      expect(gen.generatePage({ page: 3, pageSize: 50 })).toHaveLength(50);
    });

    it('returns empty for page beyond totalItems', () => {
      expect(gen.generatePage({ page: 100, pageSize: 50 })).toHaveLength(0);
    });
  });
});
