/**
 * P5.4 — Regional distribution tests
 *
 * Verifies:
 * 1. Windows 60K splits exactly across 5 regions per spec
 * 2. Android/Linux/Mac have correct total counts
 * 3. Regional boundaries are contiguous (no gaps, no overlaps)
 * 4. Each region generates exactly the right number of items
 */

import { describe, it, expect } from 'vitest';
import { WindowsEndpointGenerator } from '../../../src/generators/WindowsEndpointGenerator';
import { AndroidEndpointGenerator } from '../../../src/generators/AndroidEndpointGenerator';
import { LinuxEndpointGenerator } from '../../../src/generators/LinuxEndpointGenerator';
import { MacEndpointGenerator } from '../../../src/generators/MacEndpointGenerator';

// ============================================================================
// Windows regional distribution (ADR-005 spec)
// ============================================================================

describe('P5.4 — Windows regional distribution (60,000 total)', () => {
  const gen = new WindowsEndpointGenerator();

  it('total count is exactly 60,000', () => {
    expect(gen.totalItems).toBe(60_000);
  });

  describe('regionBreakdown()', () => {
    const breakdown = gen.regionBreakdown();

    it('returns exactly 5 regions', () => {
      expect(breakdown).toHaveLength(5);
    });

    it('Americas: start=0, count=15,000', () => {
      const r = breakdown.find((b) => b.region === 'Americas');
      expect(r).toBeDefined();
      expect(r?.start).toBe(0);
      expect(r?.count).toBe(15_000);
      expect(r?.end).toBe(15_000);
    });

    it('EMEA-West: start=15000, count=18,000', () => {
      const r = breakdown.find((b) => b.region === 'EMEA-West');
      expect(r).toBeDefined();
      expect(r?.start).toBe(15_000);
      expect(r?.count).toBe(18_000);
      expect(r?.end).toBe(33_000);
    });

    it('EMEA-East: start=33000, count=12,000', () => {
      const r = breakdown.find((b) => b.region === 'EMEA-East');
      expect(r).toBeDefined();
      expect(r?.start).toBe(33_000);
      expect(r?.count).toBe(12_000);
      expect(r?.end).toBe(45_000);
    });

    it('APAC: start=45000, count=9,000', () => {
      const r = breakdown.find((b) => b.region === 'APAC');
      expect(r).toBeDefined();
      expect(r?.start).toBe(45_000);
      expect(r?.count).toBe(9_000);
      expect(r?.end).toBe(54_000);
    });

    it('Global: start=54000, count=6,000', () => {
      const r = breakdown.find((b) => b.region === 'Global');
      expect(r).toBeDefined();
      expect(r?.start).toBe(54_000);
      expect(r?.count).toBe(6_000);
      expect(r?.end).toBe(60_000);
    });

    it('total of all region counts equals totalItems (60,000)', () => {
      const total = breakdown.reduce((sum, r) => sum + r.count, 0);
      expect(total).toBe(gen.totalItems);
    });

    it('regions are contiguous with no gaps (each end equals next start)', () => {
      const sorted = [...breakdown].sort((a, b) => a.start - b.start);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]?.start).toBe(sorted[i - 1]?.end);
      }
    });

    it('first region starts at 0', () => {
      const sorted = [...breakdown].sort((a, b) => a.start - b.start);
      expect(sorted[0]?.start).toBe(0);
    });

    it('last region ends at totalItems', () => {
      const sorted = [...breakdown].sort((a, b) => a.start - b.start);
      expect(sorted[sorted.length - 1]?.end).toBe(gen.totalItems);
    });
  });

  describe('boundary verification (first and last item of each region)', () => {
    it('Americas: item at 0 and 14999 are in Americas', () => {
      expect(gen.generateItem(0).region).toBe('Americas');
      expect(gen.generateItem(14999).region).toBe('Americas');
    });

    it('EMEA-West: item at 15000 and 32999 are in EMEA-West', () => {
      expect(gen.generateItem(15000).region).toBe('EMEA-West');
      expect(gen.generateItem(32999).region).toBe('EMEA-West');
    });

    it('EMEA-East: item at 33000 and 44999 are in EMEA-East', () => {
      expect(gen.generateItem(33000).region).toBe('EMEA-East');
      expect(gen.generateItem(44999).region).toBe('EMEA-East');
    });

    it('APAC: item at 45000 and 53999 are in APAC', () => {
      expect(gen.generateItem(45000).region).toBe('APAC');
      expect(gen.generateItem(53999).region).toBe('APAC');
    });

    it('Global: item at 54000 and 59999 are in Global', () => {
      expect(gen.generateItem(54000).region).toBe('Global');
      expect(gen.generateItem(59999).region).toBe('Global');
    });
  });

  describe('display name location codes per region', () => {
    it('Americas items start with known city codes', () => {
      const AMERICAS_CODES = ['NYC', 'LAX', 'CHI', 'HOU', 'MIA', 'SFO', 'BOS', 'SEA', 'ATL', 'DAL'];
      const item = gen.generateItem(0);
      const code = item.displayName.split('-')[0];
      expect(AMERICAS_CODES).toContain(code);
    });

    it('EMEA-West items start with known city codes', () => {
      const EMEA_WEST_CODES = ['LON', 'PAR', 'FRA', 'AMS', 'ZRH', 'MIL', 'MAD', 'BRU', 'VIE', 'STO'];
      const item = gen.generateItem(15000);
      const code = item.displayName.split('-')[0];
      expect(EMEA_WEST_CODES).toContain(code);
    });

    it('APAC items start with known city codes', () => {
      const APAC_CODES = ['SIN', 'TYO', 'SYD', 'HKG', 'SEL', 'BOM', 'BKK', 'KUL', 'CGK', 'MNL'];
      const item = gen.generateItem(45000);
      const code = item.displayName.split('-')[0];
      expect(APAC_CODES).toContain(code);
    });
  });
});

// ============================================================================
// Android, Linux, Mac — total counts
// ============================================================================

describe('P5.4 — Android endpoint distribution (5,000 total)', () => {
  const gen = new AndroidEndpointGenerator();

  it('totalItems is exactly 5,000', () => {
    expect(gen.totalItems).toBe(5_000);
  });

  it('entityType is "androidEndpoints"', () => {
    expect(gen.entityType).toBe('androidEndpoints');
  });

  it('first item is deterministic', () => {
    expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
  });

  it('last item index 4999 is valid', () => {
    expect(() => gen.generateItem(4999)).not.toThrow();
  });

  it('type field is "AndroidEndpoint"', () => {
    expect(gen.generateItem(0).type).toBe('AndroidEndpoint');
  });

  it('all display names are unique (spot-check 500)', () => {
    const names = new Set<string>();
    for (let i = 0; i < 500; i++) {names.add(gen.generateItem(i).displayName);}
    expect(names.size).toBe(500);
  });

  it('uses at least 4 different Android versions across 100 items', () => {
    const versions = new Set<string>();
    for (let i = 0; i < 100; i++) {versions.add(gen.generateItem(i).operatingSystem);}
    expect(versions.size).toBeGreaterThanOrEqual(4);
  });
});

describe('P5.4 — Linux endpoint distribution (2,500 total)', () => {
  const gen = new LinuxEndpointGenerator();

  it('totalItems is exactly 2,500', () => {
    expect(gen.totalItems).toBe(2_500);
  });

  it('entityType is "linuxEndpoints"', () => {
    expect(gen.entityType).toBe('linuxEndpoints');
  });

  it('first item is deterministic', () => {
    expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
  });

  it('last item index 2499 is valid', () => {
    expect(() => gen.generateItem(2499)).not.toThrow();
  });

  it('type field is "LinuxEndpoint"', () => {
    expect(gen.generateItem(0).type).toBe('LinuxEndpoint');
  });

  it('all display names are unique (spot-check 500)', () => {
    const names = new Set<string>();
    for (let i = 0; i < 500; i++) {names.add(gen.generateItem(i).displayName);}
    expect(names.size).toBe(500);
  });

  it('uses at least 5 different OS versions across 100 items', () => {
    const os = new Set<string>();
    for (let i = 0; i < 100; i++) {os.add(gen.generateItem(i).operatingSystem);}
    expect(os.size).toBeGreaterThanOrEqual(5);
  });

  it('servers are mostly online (≥80% in first 100)', () => {
    let online = 0;
    for (let i = 0; i < 100; i++) {if (gen.generateItem(i).isOnline) {online++;}}
    expect(online).toBeGreaterThanOrEqual(80);
  });
});

describe('P5.4 — Mac endpoint distribution (2,500 total)', () => {
  const gen = new MacEndpointGenerator();

  it('totalItems is exactly 2,500', () => {
    expect(gen.totalItems).toBe(2_500);
  });

  it('entityType is "macEndpoints"', () => {
    expect(gen.entityType).toBe('macEndpoints');
  });

  it('first item is deterministic', () => {
    expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
  });

  it('last item index 2499 is valid', () => {
    expect(() => gen.generateItem(2499)).not.toThrow();
  });

  it('type field is "MacEndpoint"', () => {
    expect(gen.generateItem(0).type).toBe('MacEndpoint');
  });

  it('all display names are unique (spot-check 500)', () => {
    const names = new Set<string>();
    for (let i = 0; i < 500; i++) {names.add(gen.generateItem(i).displayName);}
    expect(names.size).toBe(500);
  });

  it('uses multiple Mac model variants', () => {
    const models = new Set<string>();
    for (let i = 0; i < 50; i++) {models.add(gen.generateItem(i).modelName);}
    expect(models.size).toBeGreaterThanOrEqual(5);
  });
});

// ============================================================================
// Cross-generator: total large-scale endpoint count
// ============================================================================

describe('P5.4 — Total large-scale endpoint count', () => {
  it('Windows + Android + Linux + Mac = 70,000', () => {
    const windows = new WindowsEndpointGenerator();
    const android = new AndroidEndpointGenerator();
    const linux = new LinuxEndpointGenerator();
    const mac = new MacEndpointGenerator();
    const total = windows.totalItems + android.totalItems + linux.totalItems + mac.totalItems;
    expect(total).toBe(70_000);
  });
});
