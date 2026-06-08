/**
 * P5.12 — Version Isolation Tests
 *
 * Verifies that LargeScaleReadonlyProfile.getGenerator() correctly implements
 * the ADR-007 version-awareness contract:
 *
 *   - 25R2 entities: getGenerator() returns a non-null generator in BOTH versions
 *   - 26R1-only entities: getGenerator() returns null in 25R2 mode, non-null in 26R1 mode
 */

import { describe, it, expect } from 'vitest';
import { BmsVersion, ProfileMode, ProfileManager } from '../../../src/profiles/ProfileManager';

function makeProfile(version: BmsVersion): ReturnType<typeof ProfileManager.loadProfile> {
  return ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY, version);
}

const PROFILE_25R2 = makeProfile(BmsVersion.BMS_25R2);
const PROFILE_26R1 = makeProfile(BmsVersion.BMS_26R1);

// ---------------------------------------------------------------------------
// 25R2 entities — must have generators in both version modes
// ---------------------------------------------------------------------------
describe('25R2 entities — available in both versions', () => {
  const ENTITIES_25R2 = [
    'windowsEndpoints',
    'androidEndpoints',
    'linuxEndpoints',
    'macEndpoints',
    'software',
    'windowsUpdates',
  ];

  for (const entityType of ENTITIES_25R2) {
    it(`getGenerator('${entityType}') returns non-null in 25R2 mode`, () => {
      const gen = PROFILE_25R2.getGenerator?.(entityType);
      expect(gen).not.toBeNull();
      expect(gen).toBeDefined();
    });

    it(`getGenerator('${entityType}') returns non-null in 26R1 mode`, () => {
      const gen = PROFILE_26R1.getGenerator?.(entityType);
      expect(gen).not.toBeNull();
      expect(gen).toBeDefined();
    });

    it(`getGenerator('${entityType}') returns generator with correct entityType`, () => {
      const gen = PROFILE_25R2.getGenerator?.(entityType);
      expect(gen?.entityType).toBe(entityType);
    });
  }
});

// ---------------------------------------------------------------------------
// 26R1-only entities — null in 25R2, non-null in 26R1
// ---------------------------------------------------------------------------
describe('26R1-only entities — absent in 25R2, present in 26R1', () => {
  const ENTITIES_26R1_ONLY = [
    'vulnerabilities',
    'rules',
    'ruleViolations',
    'universalDynamicGroups',
    'bundles',
    'bundleApplications',
    'downloadJobs',
    'apiKeys',
  ];

  for (const entityType of ENTITIES_26R1_ONLY) {
    it(`getGenerator('${entityType}') returns null in 25R2 mode`, () => {
      const gen = PROFILE_25R2.getGenerator?.(entityType);
      expect(gen).toBeNull();
    });

    it(`getGenerator('${entityType}') returns non-null generator in 26R1 mode`, () => {
      const gen = PROFILE_26R1.getGenerator?.(entityType);
      expect(gen).not.toBeNull();
      expect(gen).toBeDefined();
    });

    it(`getGenerator('${entityType}') in 26R1 mode returns generator with correct entityType`, () => {
      const gen = PROFILE_26R1.getGenerator?.(entityType);
      expect(gen?.entityType).toBe(entityType);
    });
  }
});

// ---------------------------------------------------------------------------
// Unknown entity types — always null
// ---------------------------------------------------------------------------
describe('unknown entity types', () => {
  it('returns null for unknown entity in 25R2 mode', () => {
    expect(PROFILE_25R2.getGenerator?.('nonExistentEntity')).toBeNull();
  });

  it('returns null for unknown entity in 26R1 mode', () => {
    expect(PROFILE_26R1.getGenerator?.('nonExistentEntity')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Generator correctness spot-checks
// ---------------------------------------------------------------------------
describe('generator correctness — spot checks', () => {
  it('windowsEndpoints generator produces 60,000 items', () => {
    const gen = PROFILE_25R2.getGenerator?.('windowsEndpoints');
    expect(gen?.totalItems).toBe(60_000);
  });

  it('software generator produces 500 items', () => {
    const gen = PROFILE_25R2.getGenerator?.('software');
    expect(gen?.totalItems).toBe(500);
  });

  it('windowsUpdates generator produces 200 items', () => {
    const gen = PROFILE_25R2.getGenerator?.('windowsUpdates');
    expect(gen?.totalItems).toBe(200);
  });

  it('vulnerabilities generator produces 1,000 items in 26R1', () => {
    const gen = PROFILE_26R1.getGenerator?.('vulnerabilities');
    expect(gen?.totalItems).toBe(1_000);
  });

  it('rules generator produces 50 items in 26R1', () => {
    const gen = PROFILE_26R1.getGenerator?.('rules');
    expect(gen?.totalItems).toBe(50);
  });

  it('ruleViolations generator produces 5,000 items in 26R1', () => {
    const gen = PROFILE_26R1.getGenerator?.('ruleViolations');
    expect(gen?.totalItems).toBe(5_000);
  });

  it('universalDynamicGroups generator produces 500 items in 26R1', () => {
    const gen = PROFILE_26R1.getGenerator?.('universalDynamicGroups');
    expect(gen?.totalItems).toBe(500);
  });

  it('apiKeys generator produces 50 items in 26R1', () => {
    const gen = PROFILE_26R1.getGenerator?.('apiKeys');
    expect(gen?.totalItems).toBe(50);
  });

  it('vulnerabilities generator generates valid item at index 0', () => {
    const gen = PROFILE_26R1.getGenerator?.('vulnerabilities');
    if (!gen) { throw new Error('vulnerabilities generator not found'); }
    const item = gen.generateItem(0) as Record<string, unknown>;
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('cveId');
    expect(item).toHaveProperty('severity');
  });

  it('rules generator generates valid item at index 0', () => {
    const gen = PROFILE_26R1.getGenerator?.('rules');
    if (!gen) { throw new Error('rules generator not found'); }
    const item = gen.generateItem(0) as Record<string, unknown>;
    expect(item).toHaveProperty('id');
    expect(item).toHaveProperty('ruleName');
    expect(item).toHaveProperty('type');
  });
});
