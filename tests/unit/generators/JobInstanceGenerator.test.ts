/**
 * JobInstanceGenerator — Unit tests
 *
 * Verifies determinism, field shapes, state transitions, and page generation
 * for the 2,000-item job instance lazy generator.
 */

import { describe, it, expect } from 'vitest';
import { JobInstanceGenerator } from '../../../src/generators/JobInstanceGenerator';

const gen = new JobInstanceGenerator();

// ============================================================================
// Basic contract
// ============================================================================

describe('JobInstanceGenerator — basic contract', () => {
  it('reports totalItems of 2000', () => {
    expect(gen.totalItems).toBe(2_000);
  });

  it('reports entityType "jobInstances"', () => {
    expect(gen.entityType).toBe('jobInstances');
  });

  it('throws RangeError for negative index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('throws RangeError for index === totalItems', () => {
    expect(() => gen.generateItem(2_000)).toThrow(RangeError);
  });

  it('throws RangeError for index > totalItems', () => {
    expect(() => gen.generateItem(99_999)).toThrow(RangeError);
  });

  it('generates a valid item at index 0', () => {
    const item = gen.generateItem(0);
    expect(item).toBeDefined();
    expect(item.type).toBe('JobInstance');
  });

  it('generates a valid item at the last valid index (1999)', () => {
    const item = gen.generateItem(1_999);
    expect(item).toBeDefined();
    expect(item.type).toBe('JobInstance');
  });
});

// ============================================================================
// Determinism
// ============================================================================

describe('JobInstanceGenerator — determinism', () => {
  it('same index always returns the same item', () => {
    const a = gen.generateItem(42);
    const b = gen.generateItem(42);
    expect(a).toEqual(b);
  });

  it('different indices return different items', () => {
    const a = gen.generateItem(0);
    const b = gen.generateItem(1);
    expect(a.id).not.toBe(b.id);
  });

  it('1000-item bulk generation is stable across two passes', () => {
    const pass1 = Array.from({ length: 1000 }, (_, i) => gen.generateItem(i));
    const pass2 = Array.from({ length: 1000 }, (_, i) => gen.generateItem(i));
    expect(pass1).toEqual(pass2);
  });
});

// ============================================================================
// Field shape
// ============================================================================

describe('JobInstanceGenerator — field shape', () => {
  const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;

  it('id equals guid', () => {
    const item = gen.generateItem(10);
    expect(item.id).toBe(item.guid);
  });

  it('id is a valid GUID', () => {
    const item = gen.generateItem(10);
    expect(item.id).toMatch(GUID_RE);
  });

  it('jobDefinitionId is a valid GUID', () => {
    const item = gen.generateItem(10);
    expect(item.jobDefinitionId).toMatch(GUID_RE);
  });

  it('endpointId is a valid GUID', () => {
    const item = gen.generateItem(10);
    expect(item.endpointId).toMatch(GUID_RE);
  });

  it('type is always "JobInstance"', () => {
    for (let i = 0; i < 50; i++) {
      expect(gen.generateItem(i).type).toBe('JobInstance');
    }
  });

  it('start is a valid ISO timestamp', () => {
    const item = gen.generateItem(5);
    expect(item.start).toMatch(ISO_RE);
  });

  it('lastAction is a valid ISO timestamp', () => {
    const item = gen.generateItem(5);
    expect(item.lastAction).toMatch(ISO_RE);
  });

  it('state is one of the valid values', () => {
    // the spec's job instance State enum
    const validStates = new Set(['Queued', 'Running', 'FinishedSuccessfully', 'FinishedWithError', 'Cancelled']);
    for (let i = 0; i < 20; i++) {
      expect(validStates.has(gen.generateItem(i).state)).toBe(true);
    }
  });

  it('jobDefinitionType is one of the valid values', () => {
    const validTypes = new Set([
      'WindowsJobDefinition',
      'MacOSAndMobileJobDefinition',
      'NetworkAndOTDeviceJobDefinition',
    ]);
    for (let i = 0; i < 20; i++) {
      expect(validTypes.has(gen.generateItem(i).jobDefinitionType)).toBe(true);
    }
  });

  it('endpointName matches ENDPOINT-NNNNN pattern', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).endpointName).toMatch(/^ENDPOINT-\d{5}$/);
    }
  });

  it('successfulExecutions >= 0', () => {
    for (let i = 0; i < 50; i++) {
      expect(gen.generateItem(i).successfulExecutions).toBeGreaterThanOrEqual(0);
    }
  });

  it('erroneousExecutions >= 0', () => {
    for (let i = 0; i < 50; i++) {
      expect(gen.generateItem(i).erroneousExecutions).toBeGreaterThanOrEqual(0);
    }
  });

  it('retries is 0, 1, or 2', () => {
    for (let i = 0; i < 20; i++) {
      expect([0, 1, 2]).toContain(gen.generateItem(i).retries);
    }
  });
});

// ============================================================================
// State-specific business rules
// ============================================================================

describe('JobInstanceGenerator — state-specific rules', () => {
  it('FinishedSuccessfully items have successfulExecutions >= 1', () => {
    const completed = Array.from({ length: 2000 }, (_, i) => gen.generateItem(i))
      .filter((item) => item.state === 'FinishedSuccessfully');
    expect(completed.length).toBeGreaterThan(0);
    for (const item of completed) {
      expect(item.successfulExecutions).toBeGreaterThanOrEqual(1);
    }
  });

  it('FinishedWithError items have erroneousExecutions >= 1', () => {
    const failed = Array.from({ length: 2000 }, (_, i) => gen.generateItem(i))
      .filter((item) => item.state === 'FinishedWithError');
    expect(failed.length).toBeGreaterThan(0);
    for (const item of failed) {
      expect(item.erroneousExecutions).toBeGreaterThanOrEqual(1);
    }
  });

  it('unfinished items have successfulExecutions === 0', () => {
    const others = Array.from({ length: 200 }, (_, i) => gen.generateItem(i))
      .filter((item) => item.state !== 'FinishedSuccessfully' && item.state !== 'FinishedWithError');
    for (const item of others) {
      expect(item.successfulExecutions).toBe(0);
    }
  });
});

// ============================================================================
// Uniqueness
// ============================================================================

describe('JobInstanceGenerator — uniqueness', () => {
  it('all 2000 IDs are unique', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => gen.generateItem(i).id);
    const unique = new Set(ids);
    expect(unique.size).toBe(2000);
  });
});

// ============================================================================
// generatePage (via BaseGenerator)
// ============================================================================

describe('JobInstanceGenerator — generatePage', () => {
  it('returns correct page size', () => {
    const page = gen.generatePage({ page: 0, pageSize: 100 });
    expect(page).toHaveLength(100);
  });

  it('page 0 and page 1 have no shared IDs', () => {
    const p0 = gen.generatePage({ page: 0, pageSize: 100 });
    const p1 = gen.generatePage({ page: 1, pageSize: 100 });
    const ids0 = new Set(p0.map((i) => i.id));
    for (const item of p1) {
      expect(ids0.has(item.id)).toBe(false);
    }
  });

  it('last page is a partial page when totalItems is not divisible by pageSize', () => {
    const pageSize = 300; // 2000 / 300 = 6 full + 200 remainder
    const lastPage = Math.floor(2000 / pageSize);
    const page = gen.generatePage({ page: lastPage, pageSize });
    expect(page).toHaveLength(2000 % pageSize);
  });

  it('returns empty array for page beyond range', () => {
    const page = gen.generatePage({ page: 999, pageSize: 100 });
    expect(page).toHaveLength(0);
  });
});

// ============================================================================
// Symbol.iterator
// ============================================================================

describe('JobInstanceGenerator — iterator', () => {
  it('iterator yields exactly totalItems items', () => {
    let count = 0;
    for (const _item of gen) {
      count++;
    }
    expect(count).toBe(2_000);
  });

  it('iterator items match generateItem output', () => {
    let index = 0;
    for (const item of gen) {
      expect(item).toEqual(gen.generateItem(index));
      if (++index >= 10) {break;} // sample only first 10
    }
  });
});
