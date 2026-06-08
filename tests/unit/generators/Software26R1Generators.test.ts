import { describe, it, expect } from 'vitest';
import {
  BundlesGenerator,
  BundleApplicationsGenerator,
  DownloadJobsGenerator,
} from '../../../src/generators/Software26R1Generators';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// ---------------------------------------------------------------------------
// BundlesGenerator
// ---------------------------------------------------------------------------
describe('BundlesGenerator', () => {
  const gen = new BundlesGenerator();

  it('has totalItems 100 and entityType "bundles"', () => {
    expect(gen.totalItems).toBe(100);
    expect(gen.entityType).toBe('bundles');
  });

  it('returns all required fields', () => {
    const item = gen.generateItem(0);
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('type');
    expect(item).toHaveProperty('ignoreDependencies');
    expect(item).toHaveProperty('parentId');
    expect(item).toHaveProperty('parentName');
    expect(item).toHaveProperty('comment');
  });

  it('id is a valid GUID', () => {
    expect(gen.generateItem(0).id).toMatch(GUID_REGEX);
    expect(gen.generateItem(99).id).toMatch(GUID_REGEX);
  });

  it('type is a valid bundle type', () => {
    const valid = new Set(['ApplicationBundle', 'SoftwarePackage', 'PatchBundle', 'DriverBundle']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(gen.generateItem(i).type)).toBe(true);
    }
  });

  it('ignoreDependencies is boolean', () => {
    for (let i = 0; i < 20; i++) {
      expect(typeof gen.generateItem(i).ignoreDependencies).toBe('boolean');
    }
  });

  it('all 100 IDs are unique', () => {
    const ids = new Set(Array.from({ length: 100 }, (_, i) => gen.generateItem(i).id));
    expect(ids.size).toBe(100);
  });

  it('throws RangeError for out-of-range index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
    expect(() => gen.generateItem(100)).toThrow(RangeError);
  });

  it('is deterministic', () => {
    expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
    expect(gen.generateItem(99)).toEqual(gen.generateItem(99));
  });
});

// ---------------------------------------------------------------------------
// BundleApplicationsGenerator
// ---------------------------------------------------------------------------
describe('BundleApplicationsGenerator', () => {
  const gen = new BundleApplicationsGenerator();

  it('has totalItems 500 and entityType "bundleApplications"', () => {
    expect(gen.totalItems).toBe(500);
    expect(gen.entityType).toBe('bundleApplications');
  });

  it('returns all required fields', () => {
    const item = gen.generateItem(0);
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('bundleId');
    expect(item).toHaveProperty('bundleName');
    expect(item).toHaveProperty('applicationId');
    expect(item).toHaveProperty('applicationName');
    expect(item).toHaveProperty('applicationVendor');
    expect(item).toHaveProperty('applicationVersion');
    expect(item).toHaveProperty('order');
  });

  it('order is 1–5', () => {
    for (let i = 0; i < 20; i++) {
      const { order } = gen.generateItem(i);
      expect(order).toBeGreaterThanOrEqual(1);
      expect(order).toBeLessThanOrEqual(5);
    }
  });

  it('bundleId is a valid GUID', () => {
    expect(gen.generateItem(0).bundleId).toMatch(GUID_REGEX);
  });

  it('all 500 IDs are unique', () => {
    const ids = new Set(Array.from({ length: 500 }, (_, i) => gen.generateItem(i).id));
    expect(ids.size).toBe(500);
  });

  it('throws RangeError for out-of-range index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
    expect(() => gen.generateItem(500)).toThrow(RangeError);
  });

  it('is deterministic', () => {
    expect(gen.generateItem(42)).toEqual(gen.generateItem(42));
  });
});

// ---------------------------------------------------------------------------
// DownloadJobsGenerator
// ---------------------------------------------------------------------------
describe('DownloadJobsGenerator', () => {
  const gen = new DownloadJobsGenerator();

  it('has totalItems 200 and entityType "downloadJobs"', () => {
    expect(gen.totalItems).toBe(200);
    expect(gen.entityType).toBe('downloadJobs');
  });

  it('returns all required fields', () => {
    const item = gen.generateItem(0);
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('name');
    expect(item).toHaveProperty('interval');
    expect(item).toHaveProperty('lastExecution');
    expect(item).toHaveProperty('lastUpdate');
    expect(item).toHaveProperty('stateValue');
    expect(item).toHaveProperty('stateMessage');
    expect(item).toHaveProperty('url');
    expect(item).toHaveProperty('localPathName');
  });

  it('lastExecution is a valid ISO date', () => {
    expect(gen.generateItem(0).lastExecution).toMatch(ISO_REGEX);
    expect(gen.generateItem(100).lastExecution).toMatch(ISO_REGEX);
  });

  it('stateValue is a known state', () => {
    const valid = new Set(['Succeeded', 'Failed', 'Running', 'Queued']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(gen.generateItem(i).stateValue)).toBe(true);
    }
  });

  it('interval is a positive integer', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).interval).toBeGreaterThan(0);
    }
  });

  it('all 200 IDs are unique', () => {
    const ids = new Set(Array.from({ length: 200 }, (_, i) => gen.generateItem(i).id));
    expect(ids.size).toBe(200);
  });

  it('throws RangeError for out-of-range index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
    expect(() => gen.generateItem(200)).toThrow(RangeError);
  });

  it('is deterministic', () => {
    expect(gen.generateItem(7)).toEqual(gen.generateItem(7));
  });
});
