import { describe, it, expect } from 'vitest';
import { WindowsEndpointGenerator } from '../../../src/generators/WindowsEndpointGenerator';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const MAC_REGEX = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/;
const IP_REGEX = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

describe('WindowsEndpointGenerator', () => {
  const gen = new WindowsEndpointGenerator();

  // -------------------------------------------------------------------------
  // Metadata
  // -------------------------------------------------------------------------

  describe('metadata', () => {
    it('has totalItems of 60,000', () => {
      expect(gen.totalItems).toBe(60_000);
    });

    it('has entityType "windowsEndpoints"', () => {
      expect(gen.entityType).toBe('windowsEndpoints');
    });
  });

  // -------------------------------------------------------------------------
  // Structure
  // -------------------------------------------------------------------------

  describe('generateItem — structure', () => {
    it('returns an object with all required fields', () => {
      const item = gen.generateItem(0);
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('guid');
      expect(item).toHaveProperty('type', 'WindowsEndpoint');
      expect(item).toHaveProperty('displayName');
      expect(item).toHaveProperty('hostName');
      expect(item).toHaveProperty('primaryMAC');
      expect(item).toHaveProperty('primaryIP');
      expect(item).toHaveProperty('operatingSystem');
      expect(item).toHaveProperty('lastSeen');
      expect(item).toHaveProperty('primaryUser');
      expect(item).toHaveProperty('domain');
      expect(item).toHaveProperty('orgUnit');
      expect(item).toHaveProperty('region');
    });

    it('id and guid are the same value', () => {
      const item = gen.generateItem(42);
      expect(item.id).toBe(item.guid);
    });

    it('guid matches GUID format', () => {
      expect(gen.generateItem(0).guid).toMatch(GUID_REGEX);
      expect(gen.generateItem(999).guid).toMatch(GUID_REGEX);
      expect(gen.generateItem(59999).guid).toMatch(GUID_REGEX);
    });

    it('primaryIP is a valid IP address', () => {
      expect(gen.generateItem(0).primaryIP).toMatch(IP_REGEX);
      expect(gen.generateItem(1000).primaryIP).toMatch(IP_REGEX);
    });

    it('primaryMAC is a valid MAC address', () => {
      expect(gen.generateItem(0).primaryMAC).toMatch(MAC_REGEX);
    });

    it('lastSeen is a valid ISO 8601 date', () => {
      expect(gen.generateItem(0).lastSeen).toMatch(ISO_REGEX);
      expect(gen.generateItem(500).lastSeen).toMatch(ISO_REGEX);
    });

    it('isOnline is a boolean', () => {
      expect(typeof gen.generateItem(0).isOnline).toBe('boolean');
    });
  });

  // -------------------------------------------------------------------------
  // Determinism
  // -------------------------------------------------------------------------

  describe('generateItem — determinism', () => {
    it('returns identical objects for the same index (called 3 times)', () => {
      const a = gen.generateItem(1234);
      const b = gen.generateItem(1234);
      const c = gen.generateItem(1234);
      expect(a).toEqual(b);
      expect(b).toEqual(c);
    });

    it('returns different objects for different indices', () => {
      const a = gen.generateItem(0);
      const b = gen.generateItem(1);
      expect(a.id).not.toBe(b.id);
      expect(a.displayName).not.toBe(b.displayName);
    });

    it('all 60,000 GUIDs are unique (spot-check first 1,000)', () => {
      const guids = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        guids.add(gen.generateItem(i).guid);
      }
      expect(guids.size).toBe(1000);
    });

    it('all 60,000 displayNames are unique (spot-check first 1,000)', () => {
      const names = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        names.add(gen.generateItem(i).displayName);
      }
      expect(names.size).toBe(1000);
    });
  });

  // -------------------------------------------------------------------------
  // Regional distribution
  // -------------------------------------------------------------------------

  describe('regional distribution', () => {
    it('index 0 is in Americas region', () => {
      const item = gen.generateItem(0);
      expect(item.region).toBe('Americas');
      expect(item.domain).toBe('AMERICAS');
    });

    it('index 15,000 is in EMEA-West region', () => {
      const item = gen.generateItem(15000);
      expect(item.region).toBe('EMEA-West');
      expect(item.domain).toBe('EMEA');
    });

    it('index 33,000 is in EMEA-East region', () => {
      const item = gen.generateItem(33000);
      expect(item.region).toBe('EMEA-East');
    });

    it('index 45,000 is in APAC region', () => {
      const item = gen.generateItem(45000);
      expect(item.region).toBe('APAC');
      expect(item.domain).toBe('APAC');
    });

    it('index 54,000 is in Global region', () => {
      const item = gen.generateItem(54000);
      expect(item.region).toBe('Global');
    });

    it('last index (59,999) is in Global region', () => {
      const item = gen.generateItem(59999);
      expect(item.region).toBe('Global');
    });
  });

  // -------------------------------------------------------------------------
  // Boundary / error handling
  // -------------------------------------------------------------------------

  describe('generateItem — boundary conditions', () => {
    it('generates item at index 0 (first)', () => {
      expect(() => gen.generateItem(0)).not.toThrow();
    });

    it('generates item at index 59,999 (last)', () => {
      expect(() => gen.generateItem(59999)).not.toThrow();
    });

    it('throws RangeError for negative index', () => {
      expect(() => gen.generateItem(-1)).toThrow(RangeError);
    });

    it('throws RangeError for index >= totalItems', () => {
      expect(() => gen.generateItem(60000)).toThrow(RangeError);
    });
  });

  // -------------------------------------------------------------------------
  // generatePage
  // -------------------------------------------------------------------------

  describe('generatePage', () => {
    it('returns pageSize items for a mid-range page', () => {
      const page = gen.generatePage({ page: 5, pageSize: 50 });
      expect(page).toHaveLength(50);
    });

    it('first item of page 1 equals generateItem(50)', () => {
      const page = gen.generatePage({ page: 1, pageSize: 50 });
      expect(page[0]).toEqual(gen.generateItem(50));
    });

    it('last page returns fewer items if total not divisible by pageSize', () => {
      // 60000 / 1001 = 59 full pages + remainder
      const pageSize = 1001;
      const lastPage = Math.floor(60000 / pageSize);
      const page = gen.generatePage({ page: lastPage, pageSize });
      expect(page.length).toBeLessThanOrEqual(pageSize);
      expect(page.length).toBeGreaterThan(0);
    });

    it('returns empty array when page is beyond totalItems', () => {
      const page = gen.generatePage({ page: 9999, pageSize: 50 });
      expect(page).toHaveLength(0);
    });

    it('returns empty array for pageSize 0', () => {
      const page = gen.generatePage({ page: 0, pageSize: 0 });
      expect(page).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Iterator
  // -------------------------------------------------------------------------

  describe('[Symbol.iterator]', () => {
    it('iterates all 60,000 items', () => {
      let count = 0;
      for (const _item of gen) {
        count++;
        if (count >= 60000) {break;} // safety — should stop naturally
      }
      expect(count).toBe(60000);
    });

    it('first item from iterator equals generateItem(0)', () => {
      const [first] = gen;
      expect(first).toEqual(gen.generateItem(0));
    });

    it('can spread a slice via early break', () => {
      const items: typeof gen.generateItem extends (i: number) => infer R ? R[] : never[] = [];
      for (const item of gen) {
        items.push(item);
        if (items.length === 10) {break;}
      }
      expect(items).toHaveLength(10);
      expect(items[9]).toEqual(gen.generateItem(9));
    });
  });
});
