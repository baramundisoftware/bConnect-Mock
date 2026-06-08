import { describe, it, expect } from 'vitest';
import {
  VulnerabilitiesGenerator,
  RulesGenerator,
  RuleViolationsGenerator,
} from '../../../src/generators/ComplianceGenerators';

const GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CVE_REGEX = /^CVE-\d{4}-\d{5}$/;
const ISO_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

// ---------------------------------------------------------------------------
// VulnerabilitiesGenerator
// ---------------------------------------------------------------------------
describe('VulnerabilitiesGenerator', () => {
  const gen = new VulnerabilitiesGenerator();

  describe('metadata', () => {
    it('has totalItems of 1,000', () => {
      expect(gen.totalItems).toBe(1_000);
    });

    it('has entityType "vulnerabilities"', () => {
      expect(gen.entityType).toBe('vulnerabilities');
    });
  });

  describe('generateItem — structure', () => {
    it('returns all required fields', () => {
      const item = gen.generateItem(0);
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('cveId');
      expect(item).toHaveProperty('cvssScore');
      expect(item).toHaveProperty('severity');
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('affectedProducts');
      expect(item).toHaveProperty('affectedOperatingSystems');
    });

    it('id is a valid GUID', () => {
      expect(gen.generateItem(0).id).toMatch(GUID_REGEX);
      expect(gen.generateItem(999).id).toMatch(GUID_REGEX);
    });

    it('cveId matches CVE format', () => {
      for (let i = 0; i < 20; i++) {
        expect(gen.generateItem(i).cveId).toMatch(CVE_REGEX);
      }
    });

    it('severity is one of Critical/High/Medium/Low', () => {
      const valid = new Set(['Critical', 'High', 'Medium', 'Low']);
      for (let i = 0; i < 20; i++) {
        expect(valid.has(gen.generateItem(i).severity)).toBe(true);
      }
    });

    it('cvssScore is in range 1.0–10.0', () => {
      for (let i = 0; i < 50; i++) {
        const s = gen.generateItem(i).cvssScore;
        expect(s).toBeGreaterThanOrEqual(1.0);
        expect(s).toBeLessThanOrEqual(10.0);
      }
    });
  });

  describe('boundary conditions', () => {
    it('throws RangeError for index -1', () => {
      expect(() => gen.generateItem(-1)).toThrow(RangeError);
    });

    it('throws RangeError for index 1000', () => {
      expect(() => gen.generateItem(1000)).toThrow(RangeError);
    });
  });

  describe('determinism', () => {
    it('same index → same item', () => {
      expect(gen.generateItem(42)).toEqual(gen.generateItem(42));
      expect(gen.generateItem(999)).toEqual(gen.generateItem(999));
    });

    it('all 1000 CVE IDs are unique', () => {
      const ids = new Set(Array.from({ length: 1000 }, (_, i) => gen.generateItem(i).cveId));
      expect(ids.size).toBe(1000);
    });
  });

  describe('generatePage', () => {
    it('page 0 pageSize 100 returns 100 items', () => {
      expect(gen.generatePage({ page: 0, pageSize: 100 })).toHaveLength(100);
    });

    it('page 9 pageSize 100 returns last 100 items', () => {
      expect(gen.generatePage({ page: 9, pageSize: 100 })).toHaveLength(100);
    });
  });
});

// ---------------------------------------------------------------------------
// RulesGenerator
// ---------------------------------------------------------------------------
describe('RulesGenerator', () => {
  const gen = new RulesGenerator();

  describe('metadata', () => {
    it('has totalItems of 50', () => {
      expect(gen.totalItems).toBe(50);
    });

    it('has entityType "rules"', () => {
      expect(gen.entityType).toBe('rules');
    });
  });

  describe('generateItem — structure', () => {
    it('returns all required fields', () => {
      const item = gen.generateItem(0);
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('ruleName');
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('severity');
      expect(item).toHaveProperty('description');
    });

    it('id is a valid GUID', () => {
      expect(gen.generateItem(0).id).toMatch(GUID_REGEX);
      expect(gen.generateItem(49).id).toMatch(GUID_REGEX);
    });

    it('severity is one of Critical/High/Medium/Low', () => {
      const valid = new Set(['Critical', 'High', 'Medium', 'Low']);
      for (let i = 0; i < 50; i++) {
        expect(valid.has(gen.generateItem(i).severity)).toBe(true);
      }
    });

    it('all 50 rule IDs are unique', () => {
      const ids = new Set(Array.from({ length: 50 }, (_, i) => gen.generateItem(i).id));
      expect(ids.size).toBe(50);
    });
  });

  describe('boundary conditions', () => {
    it('throws RangeError for index -1', () => {
      expect(() => gen.generateItem(-1)).toThrow(RangeError);
    });

    it('throws RangeError for index 50', () => {
      expect(() => gen.generateItem(50)).toThrow(RangeError);
    });
  });

  describe('determinism', () => {
    it('same index → same rule', () => {
      expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
      expect(gen.generateItem(49)).toEqual(gen.generateItem(49));
    });
  });
});

// ---------------------------------------------------------------------------
// RuleViolationsGenerator
// ---------------------------------------------------------------------------
describe('RuleViolationsGenerator', () => {
  const gen = new RuleViolationsGenerator();

  describe('metadata', () => {
    it('has totalItems of 5,000', () => {
      expect(gen.totalItems).toBe(5_000);
    });

    it('has entityType "ruleViolations"', () => {
      expect(gen.entityType).toBe('ruleViolations');
    });
  });

  describe('generateItem — structure', () => {
    it('returns all required fields', () => {
      const item = gen.generateItem(0);
      expect(item).toHaveProperty('endpointId');
      expect(item).toHaveProperty('endpointName');
      expect(item).toHaveProperty('ruleId');
      expect(item).toHaveProperty('ruleName');
      expect(item).toHaveProperty('detected');
      expect(item).toHaveProperty('ignored');
    });

    it('endpointId is a valid GUID', () => {
      expect(gen.generateItem(0).endpointId).toMatch(GUID_REGEX);
    });

    it('ruleId is a valid GUID', () => {
      expect(gen.generateItem(0).ruleId).toMatch(GUID_REGEX);
    });

    it('detected is a valid ISO date', () => {
      for (let i = 0; i < 10; i++) {
        expect(gen.generateItem(i).detected).toMatch(ISO_REGEX);
      }
    });

    it('ignored is boolean', () => {
      for (let i = 0; i < 20; i++) {
        expect(typeof gen.generateItem(i).ignored).toBe('boolean');
      }
    });
  });

  describe('boundary conditions', () => {
    it('throws RangeError for index -1', () => {
      expect(() => gen.generateItem(-1)).toThrow(RangeError);
    });

    it('throws RangeError for index 5000', () => {
      expect(() => gen.generateItem(5000)).toThrow(RangeError);
    });
  });

  describe('determinism', () => {
    it('same index → same violation', () => {
      expect(gen.generateItem(0)).toEqual(gen.generateItem(0));
      expect(gen.generateItem(4999)).toEqual(gen.generateItem(4999));
    });
  });

  describe('generatePage', () => {
    it('page 0 pageSize 50 returns 50 items', () => {
      expect(gen.generatePage({ page: 0, pageSize: 50 })).toHaveLength(50);
    });
  });
});
