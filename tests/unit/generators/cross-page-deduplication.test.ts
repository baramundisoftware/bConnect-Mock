/**
 * P10.17 — Cross-page deduplication: no item appears on two pages
 *
 * For each large-scale generator, generate several pages and assert that
 * the IDs (or a unique key field) are disjoint across pages.
 *
 * We sample pages from the start, middle, and end of each generator's
 * range to give good coverage without exhausting the full corpus.
 */

import { describe, it, expect } from 'vitest';
import { WindowsEndpointGenerator } from '../../../src/generators/WindowsEndpointGenerator';
import { AndroidEndpointGenerator } from '../../../src/generators/AndroidEndpointGenerator';
import { LinuxEndpointGenerator } from '../../../src/generators/LinuxEndpointGenerator';
import { MacEndpointGenerator } from '../../../src/generators/MacEndpointGenerator';
import { SoftwareGenerator } from '../../../src/generators/SoftwareGenerator';
import { WindowsUpdatesGenerator } from '../../../src/generators/WindowsUpdatesGenerator';
import { IosEndpointGenerator } from '../../../src/generators/IosEndpointGenerator';
import { NetworkEndpointGenerator } from '../../../src/generators/NetworkEndpointGenerator';
import { IndustrialEndpointGenerator } from '../../../src/generators/IndustrialEndpointGenerator';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Collect `pageCount` pages starting at `startPage` (0-based) with `pageSize`
 * items each. Returns a flat array of all collected items.
 */
function collectPages<T extends { id: string }>(
  gen: { generatePage: (opts: { page: number; pageSize: number }) => T[]; totalItems: number },
  pageSize: number,
  startPage: number,
  pageCount: number
): T[] {
  const items: T[] = [];
  const maxPage = Math.ceil(gen.totalItems / pageSize) - 1;
  for (let p = startPage; p < startPage + pageCount && p <= maxPage; p++) {
    items.push(...gen.generatePage({ page: p, pageSize }));
  }
  return items;
}

/**
 * Verify that no ID appears more than once across a set of pages.
 * Returns the number of duplicate IDs found (0 = pass).
 */
function countDuplicateIds<T extends { id: string }>(items: T[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const item of items) {
    if (seen.has(item.id)) {duplicates++;}
    seen.add(item.id);
  }
  return duplicates;
}

// ---------------------------------------------------------------------------
// P10.17 Tests
// ---------------------------------------------------------------------------

describe('P10.17 — Cross-page deduplication: no ID appears on two pages', () => {
  const PAGE_SIZE = 250;

  describe('WindowsEndpointGenerator (60,000 items)', () => {
    const gen = new WindowsEndpointGenerator();

    it('pages 0–9 (start) have no duplicate IDs', () => {
      const items = collectPages(gen, PAGE_SIZE, 0, 10);
      expect(items).toHaveLength(PAGE_SIZE * 10);
      expect(countDuplicateIds(items)).toBe(0);
    });

    it('pages from middle of range have no duplicate IDs', () => {
      const midPage = Math.floor(gen.totalItems / PAGE_SIZE / 2);
      const items = collectPages(gen, PAGE_SIZE, midPage, 10);
      expect(countDuplicateIds(items)).toBe(0);
    });

    it('pages near end of range have no duplicate IDs', () => {
      const lastPage = Math.floor(gen.totalItems / PAGE_SIZE) - 5;
      const items = collectPages(gen, PAGE_SIZE, Math.max(0, lastPage), 5);
      expect(countDuplicateIds(items)).toBe(0);
    });

    it('IDs are globally unique across start, middle and end page samples', () => {
      const start = collectPages(gen, PAGE_SIZE, 0, 3);
      const mid = collectPages(gen, PAGE_SIZE, Math.floor(gen.totalItems / PAGE_SIZE / 2), 3);
      const end = collectPages(gen, PAGE_SIZE, Math.floor(gen.totalItems / PAGE_SIZE) - 3, 3);
      const combined = [...start, ...mid, ...end];
      expect(countDuplicateIds(combined)).toBe(0);
    });
  });

  describe('AndroidEndpointGenerator (5,000 items)', () => {
    const gen = new AndroidEndpointGenerator();

    it('all pages have no duplicate IDs', () => {
      const totalPages = Math.ceil(gen.totalItems / PAGE_SIZE);
      const items = collectPages(gen, PAGE_SIZE, 0, totalPages);
      expect(items).toHaveLength(gen.totalItems);
      expect(countDuplicateIds(items)).toBe(0);
    });
  });

  describe('LinuxEndpointGenerator', () => {
    const gen = new LinuxEndpointGenerator();

    it('first 10 pages have no duplicate IDs', () => {
      const items = collectPages(gen, PAGE_SIZE, 0, 10);
      expect(countDuplicateIds(items)).toBe(0);
    });

    it('IDs across non-contiguous pages are unique', () => {
      const page0 = gen.generatePage({ page: 0, pageSize: PAGE_SIZE });
      const page5 = gen.generatePage({ page: 5, pageSize: PAGE_SIZE });
      const page10 = gen.generatePage({ page: 10, pageSize: PAGE_SIZE });
      const combined = [...page0, ...page5, ...page10];
      expect(countDuplicateIds(combined)).toBe(0);
    });
  });

  describe('MacEndpointGenerator', () => {
    const gen = new MacEndpointGenerator();

    it('first 10 pages have no duplicate IDs', () => {
      const items = collectPages(gen, PAGE_SIZE, 0, 10);
      expect(countDuplicateIds(items)).toBe(0);
    });
  });

  describe('SoftwareGenerator (500 items)', () => {
    const gen = new SoftwareGenerator();

    it('all pages have no duplicate IDs', () => {
      const totalPages = Math.ceil(gen.totalItems / PAGE_SIZE);
      const items = collectPages(gen, PAGE_SIZE, 0, totalPages);
      expect(items).toHaveLength(gen.totalItems);
      expect(countDuplicateIds(items)).toBe(0);
    });

    it('page size boundary: page 0 and page 1 (100 items each) have no shared IDs', () => {
      const p0 = gen.generatePage({ page: 0, pageSize: 100 });
      const p1 = gen.generatePage({ page: 1, pageSize: 100 });
      const combined = [...p0, ...p1];
      expect(countDuplicateIds(combined)).toBe(0);
    });
  });

  describe('WindowsUpdatesGenerator', () => {
    const gen = new WindowsUpdatesGenerator();

    it('first 10 pages have no duplicate IDs', () => {
      const items = collectPages(gen, PAGE_SIZE, 0, 10);
      expect(countDuplicateIds(items)).toBe(0);
    });
  });

  describe('IosEndpointGenerator', () => {
    const gen = new IosEndpointGenerator();

    it('first 10 pages have no duplicate IDs', () => {
      const items = collectPages(gen, PAGE_SIZE, 0, 10);
      expect(countDuplicateIds(items)).toBe(0);
    });
  });

  describe('NetworkEndpointGenerator', () => {
    const gen = new NetworkEndpointGenerator();

    it('first 10 pages have no duplicate IDs', () => {
      const items = collectPages(gen, PAGE_SIZE, 0, 10);
      expect(countDuplicateIds(items)).toBe(0);
    });
  });

  describe('IndustrialEndpointGenerator', () => {
    const gen = new IndustrialEndpointGenerator();

    it('first 10 pages have no duplicate IDs', () => {
      const items = collectPages(gen, PAGE_SIZE, 0, 10);
      expect(countDuplicateIds(items)).toBe(0);
    });
  });

  describe('Page boundary edge cases', () => {
    it('last partial page and second-to-last full page have no shared IDs', () => {
      const gen = new SoftwareGenerator();
      const pageSize = 150; // 500 / 150 = 3 full pages + 50-item partial
      const lastFullPage = Math.floor(gen.totalItems / pageSize) - 1;
      const lastPage = Math.floor(gen.totalItems / pageSize);

      const full = gen.generatePage({ page: lastFullPage, pageSize });
      const partial = gen.generatePage({ page: lastPage, pageSize });

      expect(partial.length).toBeGreaterThan(0);
      expect(partial.length).toBeLessThan(pageSize);

      const combined = [...full, ...partial];
      expect(countDuplicateIds(combined)).toBe(0);
    });

    it('page size = 1 produces single unique items per page (first 20 pages)', () => {
      const gen = new AndroidEndpointGenerator();
      const items: Array<{ id: string }> = [];
      for (let p = 0; p < 20; p++) {
        const page = gen.generatePage({ page: p, pageSize: 1 });
        expect(page).toHaveLength(1);
        items.push(...page);
      }
      expect(countDuplicateIds(items)).toBe(0);
    });

    it('overlapping page windows do NOT deduplicate (same item at same index)', () => {
      // This is a sanity check: requesting the same page twice yields identical items
      const gen = new WindowsEndpointGenerator();
      const p0a = gen.generatePage({ page: 0, pageSize: PAGE_SIZE });
      const p0b = gen.generatePage({ page: 0, pageSize: PAGE_SIZE });
      const combined = [...p0a, ...p0b];
      // 2 * PAGE_SIZE items but only PAGE_SIZE unique IDs (each repeated once)
      const seen = new Set(combined.map((i) => i.id));
      expect(seen.size).toBe(PAGE_SIZE);
    });
  });
});
