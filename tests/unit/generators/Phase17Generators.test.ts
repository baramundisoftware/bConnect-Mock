/**
 * Phase 17 Generator Unit Tests
 *
 * Covers ADGroupGenerator, ADUserGenerator, AssetGenerator,
 * JobDefinitionGenerator, and LogicalGroupGenerator.
 *
 * Verifies: basic contract, determinism, field shape, uniqueness, generatePage.
 */

import { describe, it, expect } from 'vitest';
import { ADGroupGenerator } from '../../../src/generators/ADGroupGenerator';
import { ADUserGenerator } from '../../../src/generators/ADUserGenerator';
import { AssetGenerator } from '../../../src/generators/AssetGenerator';
import { JobDefinitionGenerator } from '../../../src/generators/JobDefinitionGenerator';
import { LogicalGroupGenerator } from '../../../src/generators/LogicalGroupGenerator';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================================
// ADGroupGenerator
// ============================================================================

describe('ADGroupGenerator — basic contract', () => {
  const gen = new ADGroupGenerator();

  it('reports totalItems of 500', () => {
    expect(gen.totalItems).toBe(500);
  });

  it('reports entityType "adGroups"', () => {
    expect(gen.entityType).toBe('adGroups');
  });

  it('throws RangeError for negative index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('throws RangeError for index === totalItems', () => {
    expect(() => gen.generateItem(500)).toThrow(RangeError);
  });

  it('generates a valid item at index 0', () => {
    expect(gen.generateItem(0)).toBeDefined();
  });

  it('generates a valid item at the last valid index (499)', () => {
    expect(gen.generateItem(499)).toBeDefined();
  });
});

describe('ADGroupGenerator — determinism', () => {
  const gen = new ADGroupGenerator();

  it('same index always returns the same item', () => {
    expect(gen.generateItem(42)).toEqual(gen.generateItem(42));
  });

  it('different indices return different items', () => {
    expect(gen.generateItem(0).id).not.toBe(gen.generateItem(1).id);
  });

  it('500-item bulk generation is stable across two passes', () => {
    const pass1 = Array.from({ length: 500 }, (_, i) => gen.generateItem(i));
    const pass2 = Array.from({ length: 500 }, (_, i) => gen.generateItem(i));
    expect(pass1).toEqual(pass2);
  });
});

describe('ADGroupGenerator — field shape', () => {
  const gen = new ADGroupGenerator();

  it('id is a valid GUID', () => {
    expect(gen.generateItem(10).id).toMatch(GUID_RE);
  });

  it('groupScope is one of Global/Universal/DomainLocal', () => {
    const valid = new Set(['Global', 'Universal', 'DomainLocal']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(gen.generateItem(i).groupScope)).toBe(true);
    }
  });

  it('groupType is Security or Distribution', () => {
    const valid = new Set(['Security', 'Distribution']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(gen.generateItem(i).groupType)).toBe(true);
    }
  });

  it('memberCount is a non-negative integer', () => {
    for (let i = 0; i < 20; i++) {
      const { memberCount } = gen.generateItem(i);
      expect(typeof memberCount).toBe('number');
      expect(memberCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('distinguishedName contains the group name', () => {
    const item = gen.generateItem(5);
    expect(item.distinguishedName).toContain(item.name);
  });
});

describe('ADGroupGenerator — uniqueness', () => {
  const gen = new ADGroupGenerator();

  it('all 500 IDs are unique', () => {
    const ids = Array.from({ length: 500 }, (_, i) => gen.generateItem(i).id);
    expect(new Set(ids).size).toBe(500);
  });
});

describe('ADGroupGenerator — generatePage', () => {
  const gen = new ADGroupGenerator();

  it('returns correct page size', () => {
    expect(gen.generatePage({ page: 0, pageSize: 50 })).toHaveLength(50);
  });

  it('page 0 and page 1 have no shared IDs', () => {
    const p0 = new Set(gen.generatePage({ page: 0, pageSize: 50 }).map((i) => i.id));
    for (const item of gen.generatePage({ page: 1, pageSize: 50 })) {
      expect(p0.has(item.id)).toBe(false);
    }
  });

  it('returns empty array for page beyond range', () => {
    expect(gen.generatePage({ page: 999, pageSize: 50 })).toHaveLength(0);
  });
});

// ============================================================================
// ADUserGenerator
// ============================================================================

describe('ADUserGenerator — basic contract', () => {
  const gen = new ADUserGenerator();

  it('reports totalItems of 5000', () => {
    expect(gen.totalItems).toBe(5_000);
  });

  it('reports entityType "adUsers"', () => {
    expect(gen.entityType).toBe('adUsers');
  });

  it('throws RangeError for negative index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('throws RangeError for index === totalItems', () => {
    expect(() => gen.generateItem(5_000)).toThrow(RangeError);
  });
});

describe('ADUserGenerator — determinism', () => {
  const gen = new ADUserGenerator();

  it('same index always returns the same item', () => {
    expect(gen.generateItem(100)).toEqual(gen.generateItem(100));
  });

  it('different indices return different items', () => {
    expect(gen.generateItem(0).id).not.toBe(gen.generateItem(1).id);
  });
});

describe('ADUserGenerator — field shape', () => {
  const gen = new ADUserGenerator();

  it('id equals guid', () => {
    const item = gen.generateItem(10);
    expect(item.id).toBe(item.guid);
  });

  it('id is a valid GUID', () => {
    expect(gen.generateItem(10).id).toMatch(GUID_RE);
  });

  it('type is always "ADUser"', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).type).toBe('ADUser');
    }
  });

  it('email matches userPrincipalName', () => {
    for (let i = 0; i < 20; i++) {
      const item = gen.generateItem(i);
      expect(item.email).toBe(item.userPrincipalName);
    }
  });

  it('~95% of users are enabled (index % 20 !== 0)', () => {
    const disabled = Array.from({ length: 200 }, (_, i) => gen.generateItem(i))
      .filter((u) => !u.isEnabled);
    // Exactly 10 disabled in first 200 (indices 0,20,40,...180)
    expect(disabled.length).toBe(10);
  });

  it('adGroupId is a valid GUID', () => {
    expect(gen.generateItem(10).adGroupId).toMatch(GUID_RE);
  });
});

describe('ADUserGenerator — uniqueness', () => {
  const gen = new ADUserGenerator();

  it('first 1000 IDs are unique', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => gen.generateItem(i).id);
    expect(new Set(ids).size).toBe(1000);
  });
});

describe('ADUserGenerator — generatePage', () => {
  const gen = new ADUserGenerator();

  it('returns correct page size', () => {
    expect(gen.generatePage({ page: 0, pageSize: 100 })).toHaveLength(100);
  });

  it('page 0 and page 1 have no shared IDs', () => {
    const p0 = new Set(gen.generatePage({ page: 0, pageSize: 100 }).map((i) => i.id));
    for (const item of gen.generatePage({ page: 1, pageSize: 100 })) {
      expect(p0.has(item.id)).toBe(false);
    }
  });
});

// ============================================================================
// AssetGenerator
// ============================================================================

describe('AssetGenerator — basic contract', () => {
  const gen = new AssetGenerator();

  it('reports totalItems of 5000', () => {
    expect(gen.totalItems).toBe(5_000);
  });

  it('reports entityType "assets"', () => {
    expect(gen.entityType).toBe('assets');
  });

  it('throws RangeError for negative index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('throws RangeError for index === totalItems', () => {
    expect(() => gen.generateItem(5_000)).toThrow(RangeError);
  });
});

describe('AssetGenerator — determinism', () => {
  const gen = new AssetGenerator();

  it('same index always returns the same item', () => {
    expect(gen.generateItem(77)).toEqual(gen.generateItem(77));
  });

  it('different indices return different items', () => {
    expect(gen.generateItem(0).id).not.toBe(gen.generateItem(1).id);
  });
});

describe('AssetGenerator — field shape', () => {
  const gen = new AssetGenerator();

  it('id is a valid GUID', () => {
    expect(gen.generateItem(5).id).toMatch(GUID_RE);
  });

  it('assetTag matches AST-XXX-NNN pattern', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).assetTag).toMatch(/^AST-[A-Z]{3}-\d{3}$/);
    }
  });

  it('type is one of the valid asset types', () => {
    const valid = new Set(['Desktop', 'Laptop', 'Server', 'Tablet', 'Printer', 'Monitor']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(gen.generateItem(i).type)).toBe(true);
    }
  });

  it('purchaseDate is a valid date string (YYYY-MM-DD)', () => {
    for (let i = 0; i < 10; i++) {
      expect(gen.generateItem(i).purchaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('warrantyExpires is a valid date string (YYYY-MM-DD)', () => {
    for (let i = 0; i < 10; i++) {
      expect(gen.generateItem(i).warrantyExpires).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe('AssetGenerator — uniqueness', () => {
  const gen = new AssetGenerator();

  it('first 1000 IDs are unique', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => gen.generateItem(i).id);
    expect(new Set(ids).size).toBe(1000);
  });
});

describe('AssetGenerator — generatePage', () => {
  const gen = new AssetGenerator();

  it('returns correct page size', () => {
    expect(gen.generatePage({ page: 0, pageSize: 100 })).toHaveLength(100);
  });

  it('page 0 and page 1 have no shared IDs', () => {
    const p0 = new Set(gen.generatePage({ page: 0, pageSize: 100 }).map((i) => i.id));
    for (const item of gen.generatePage({ page: 1, pageSize: 100 })) {
      expect(p0.has(item.id)).toBe(false);
    }
  });

  it('returns empty array for page beyond range', () => {
    expect(gen.generatePage({ page: 999, pageSize: 100 })).toHaveLength(0);
  });
});

// ============================================================================
// JobDefinitionGenerator
// ============================================================================

describe('JobDefinitionGenerator — basic contract', () => {
  const gen = new JobDefinitionGenerator();

  it('reports totalItems of 1000', () => {
    expect(gen.totalItems).toBe(1_000);
  });

  it('reports entityType "jobs"', () => {
    expect(gen.entityType).toBe('jobs');
  });

  it('throws RangeError for negative index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('throws RangeError for index === totalItems', () => {
    expect(() => gen.generateItem(1_000)).toThrow(RangeError);
  });
});

describe('JobDefinitionGenerator — determinism', () => {
  const gen = new JobDefinitionGenerator();

  it('same index always returns the same item', () => {
    expect(gen.generateItem(55)).toEqual(gen.generateItem(55));
  });

  it('different indices return different items', () => {
    expect(gen.generateItem(0).id).not.toBe(gen.generateItem(1).id);
  });
});

describe('JobDefinitionGenerator — field shape', () => {
  const gen = new JobDefinitionGenerator();

  it('id equals guid', () => {
    const item = gen.generateItem(10);
    expect(item.id).toBe(item.guid);
  });

  it('id is a valid GUID', () => {
    expect(gen.generateItem(10).id).toMatch(GUID_RE);
  });

  it('type is one of the valid job types', () => {
    const valid = new Set([
      'WindowsJobDefinition',
      'MacOSAndMobileJobDefinition',
      'NetworkAndOTDeviceJobDefinition',
    ]);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(gen.generateItem(i).type)).toBe(true);
    }
  });

  it('status is one of Active/Inactive/Scheduled/Disabled', () => {
    const valid = new Set(['Active', 'Inactive', 'Scheduled', 'Disabled']);
    for (let i = 0; i < 20; i++) {
      expect(valid.has(gen.generateItem(i).status)).toBe(true);
    }
  });

  it('successCount is a non-negative integer', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).successCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('failureCount is a non-negative integer', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).failureCount).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('JobDefinitionGenerator — uniqueness', () => {
  const gen = new JobDefinitionGenerator();

  it('all 1000 IDs are unique', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => gen.generateItem(i).id);
    expect(new Set(ids).size).toBe(1000);
  });
});

describe('JobDefinitionGenerator — generatePage', () => {
  const gen = new JobDefinitionGenerator();

  it('returns correct page size', () => {
    expect(gen.generatePage({ page: 0, pageSize: 100 })).toHaveLength(100);
  });

  it('page 0 and page 1 have no shared IDs', () => {
    const p0 = new Set(gen.generatePage({ page: 0, pageSize: 100 }).map((i) => i.id));
    for (const item of gen.generatePage({ page: 1, pageSize: 100 })) {
      expect(p0.has(item.id)).toBe(false);
    }
  });

  it('last partial page has correct length (1000 % 300 = 100)', () => {
    const lastPage = Math.floor(1000 / 300);
    expect(gen.generatePage({ page: lastPage, pageSize: 300 })).toHaveLength(1000 % 300);
  });
});

// ============================================================================
// LogicalGroupGenerator
// ============================================================================

describe('LogicalGroupGenerator — basic contract', () => {
  const gen = new LogicalGroupGenerator();

  it('reports totalItems of 300', () => {
    expect(gen.totalItems).toBe(300);
  });

  it('reports entityType "logicalGroups"', () => {
    expect(gen.entityType).toBe('logicalGroups');
  });

  it('throws RangeError for negative index', () => {
    expect(() => gen.generateItem(-1)).toThrow(RangeError);
  });

  it('throws RangeError for index === totalItems', () => {
    expect(() => gen.generateItem(300)).toThrow(RangeError);
  });
});

describe('LogicalGroupGenerator — determinism', () => {
  const gen = new LogicalGroupGenerator();

  it('same index always returns the same item', () => {
    expect(gen.generateItem(25)).toEqual(gen.generateItem(25));
  });

  it('different indices return different items', () => {
    expect(gen.generateItem(0).id).not.toBe(gen.generateItem(1).id);
  });

  it('300-item bulk generation is stable across two passes', () => {
    const pass1 = Array.from({ length: 300 }, (_, i) => gen.generateItem(i));
    const pass2 = Array.from({ length: 300 }, (_, i) => gen.generateItem(i));
    expect(pass1).toEqual(pass2);
  });
});

describe('LogicalGroupGenerator — field shape', () => {
  const gen = new LogicalGroupGenerator();

  it('id equals guid', () => {
    const item = gen.generateItem(10);
    expect(item.id).toBe(item.guid);
  });

  it('id is a valid GUID', () => {
    expect(gen.generateItem(10).id).toMatch(GUID_RE);
  });

  it('type is always "LogicalGroup"', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).type).toBe('LogicalGroup');
    }
  });

  it('index 0 has parentId null (root)', () => {
    expect(gen.generateItem(0).parentId).toBeNull();
  });

  it('non-root items have a non-null parentId that is a valid GUID', () => {
    for (let i = 1; i < 20; i++) {
      const { parentId } = gen.generateItem(i);
      expect(parentId).not.toBeNull();
      expect(parentId).toMatch(GUID_RE);
    }
  });

  it('first 5 items are built-in', () => {
    for (let i = 0; i < 5; i++) {
      expect(gen.generateItem(i).isBuiltIn).toBe(true);
    }
  });

  it('items from index 5 onwards are not built-in', () => {
    for (let i = 5; i < 20; i++) {
      expect(gen.generateItem(i).isBuiltIn).toBe(false);
    }
  });

  it('memberCount is a non-negative integer', () => {
    for (let i = 0; i < 20; i++) {
      expect(gen.generateItem(i).memberCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('description contains the displayName', () => {
    const item = gen.generateItem(7);
    expect(item.description).toContain(item.displayName);
  });
});

describe('LogicalGroupGenerator — uniqueness', () => {
  const gen = new LogicalGroupGenerator();

  it('all 300 IDs are unique', () => {
    const ids = Array.from({ length: 300 }, (_, i) => gen.generateItem(i).id);
    expect(new Set(ids).size).toBe(300);
  });
});

describe('LogicalGroupGenerator — generatePage', () => {
  const gen = new LogicalGroupGenerator();

  it('returns correct page size', () => {
    expect(gen.generatePage({ page: 0, pageSize: 50 })).toHaveLength(50);
  });

  it('page 0 and page 1 have no shared IDs', () => {
    const p0 = new Set(gen.generatePage({ page: 0, pageSize: 50 }).map((i) => i.id));
    for (const item of gen.generatePage({ page: 1, pageSize: 50 })) {
      expect(p0.has(item.id)).toBe(false);
    }
  });

  it('returns empty array for page beyond range', () => {
    expect(gen.generatePage({ page: 999, pageSize: 50 })).toHaveLength(0);
  });
});
