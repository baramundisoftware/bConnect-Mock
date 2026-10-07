import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { BmsVersion, ProfileManager, ProfileMode } from '../../../src/profiles/ProfileManager';

describe('ProfileManager', () => {
  describe('ProfileMode enum', () => {
    it('should define all six profile modes', () => {
      expect(ProfileMode.MINIMAL_READONLY).toBe('minimal-readonly');
      expect(ProfileMode.MINIMAL_READWRITE).toBe('minimal-readwrite');
      expect(ProfileMode.STANDARD_READONLY).toBe('standard-readonly');
      expect(ProfileMode.STANDARD_READWRITE).toBe('standard-readwrite');
      expect(ProfileMode.LARGESCALE_READONLY).toBe('largescale-readonly');
      expect(ProfileMode.LARGESCALE_READWRITE).toBe('largescale-readwrite');
    });
  });

  describe('ProfileManager.loadProfile', () => {
    it('should load minimal-readonly profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);

      expect(profile).toBeDefined();
      expect(profile.name).toBe('minimal-readonly');
      expect(profile.mode).toBe(ProfileMode.MINIMAL_READONLY);
      expect(profile.isReadOnly).toBe(true);
    });

    it('should load minimal-readwrite profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READWRITE);

      expect(profile).toBeDefined();
      expect(profile.name).toBe('minimal-readwrite');
      expect(profile.mode).toBe(ProfileMode.MINIMAL_READWRITE);
      expect(profile.isReadOnly).toBe(false);
    });

    it('should load standard-readonly profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.STANDARD_READONLY);

      expect(profile).toBeDefined();
      expect(profile.name).toBe('standard-readonly');
      expect(profile.isReadOnly).toBe(true);
    });

    it('should load standard-readwrite profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.STANDARD_READWRITE);

      expect(profile).toBeDefined();
      expect(profile.name).toBe('standard-readwrite');
      expect(profile.isReadOnly).toBe(false);
    });

    it('should load largescale-readonly profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY);

      expect(profile).toBeDefined();
      expect(profile.name).toBe('largescale-readonly');
      expect(profile.isReadOnly).toBe(true);
    });

    it('should load largescale-readwrite profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READWRITE);

      expect(profile).toBeDefined();
      expect(profile.name).toBe('largescale-readwrite');
      expect(profile.isReadOnly).toBe(false);
    });

    it('should throw error for invalid profile name', () => {
      expect(() => {
        ProfileManager.loadProfile('invalid-profile' as ProfileMode);
      }).toThrow('Unknown profile mode: invalid-profile');
    });
  });

  describe('ProfileManager.fromEnvironment', () => {
    it('should load profile from BCONNECT_MOCK_PROFILE environment variable', () => {
      const originalEnv = process.env.BCONNECT_MOCK_PROFILE;
      process.env.BCONNECT_MOCK_PROFILE = 'standard-readonly';

      const profile = ProfileManager.fromEnvironment();

      expect(profile.name).toBe('standard-readonly');
      expect(profile.mode).toBe(ProfileMode.STANDARD_READONLY);

      // Restore original env
      process.env.BCONNECT_MOCK_PROFILE = originalEnv;
    });

    it('should default to minimal-readonly when env var not set', () => {
      const originalEnv = process.env.BCONNECT_MOCK_PROFILE;
      delete process.env.BCONNECT_MOCK_PROFILE;

      const profile = ProfileManager.fromEnvironment();

      expect(profile.name).toBe('minimal-readonly');
      expect(profile.mode).toBe(ProfileMode.MINIMAL_READONLY);

      // Restore original env
      process.env.BCONNECT_MOCK_PROFILE = originalEnv;
    });

    it('should throw error for invalid env var value', () => {
      const originalEnv = process.env.BCONNECT_MOCK_PROFILE;
      process.env.BCONNECT_MOCK_PROFILE = 'invalid-mode';

      expect(() => {
        ProfileManager.fromEnvironment();
      }).toThrow('Invalid BCONNECT_MOCK_PROFILE: "invalid-mode"');

      // Restore original env
      process.env.BCONNECT_MOCK_PROFILE = originalEnv;
    });
  });

  describe('IProfile interface', () => {
    it('should provide fixture data for minimal-readonly', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);

      const endpoints = profile.getFixture('windowsEndpoints');
      expect(endpoints).toBeDefined();
      expect(Array.isArray(endpoints)).toBe(true);
    });

    it('should provide metadata for performance targets', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);

      expect(profile.metadata.responseTimeTarget).toBeLessThanOrEqual(100);
      expect(profile.metadata.memoryTarget).toBeDefined();
      expect(profile.metadata.entityCount).toBeDefined();
      expect(typeof profile.metadata.entityCount).toBe('object');
      expect(profile.metadata.entityCount.windowsEndpoints).toBeGreaterThanOrEqual(0);
    });

    it('should indicate if profile supports reset', () => {
      const readonlyProfile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);
      const readwriteProfile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READWRITE);

      expect(readonlyProfile.supportsReset).toBe(false);
      expect(readwriteProfile.supportsReset).toBe(true);
    });
  });

  describe('BmsVersion enum', () => {
    it('should define BMS_25R2 as "25r2"', () => {
      expect(BmsVersion.BMS_25R2).toBe('25r2');
    });

    it('should define BMS_26R1 as "26r1"', () => {
      expect(BmsVersion.BMS_26R1).toBe('26r1');
    });
  });

  describe('ProfileManager with BmsVersion', () => {
    it('should default bmsVersion to 25r2 when no version provided', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);
      expect(profile.bmsVersion).toBe(BmsVersion.BMS_25R2);
    });

    it('should use 25r2 when explicitly provided', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_25R2);
      expect(profile.bmsVersion).toBe(BmsVersion.BMS_25R2);
    });

    it('should use 26r1 when explicitly provided', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_26R1);
      expect(profile.bmsVersion).toBe(BmsVersion.BMS_26R1);
    });

    it('should propagate bmsVersion across all profile modes', () => {
      const modes = [
        ProfileMode.MINIMAL_READONLY,
        ProfileMode.MINIMAL_READWRITE,
        ProfileMode.STANDARD_READONLY,
        ProfileMode.STANDARD_READWRITE,
        ProfileMode.LARGESCALE_READONLY,
        ProfileMode.LARGESCALE_READWRITE,
      ];
      for (const mode of modes) {
        const profile = ProfileManager.loadProfile(mode, BmsVersion.BMS_26R1);
        expect(profile.bmsVersion).toBe(BmsVersion.BMS_26R1);
      }
    });

    it('isValidVersion should return true for valid BMS versions', () => {
      expect(ProfileManager.isValidVersion('25r2')).toBe(true);
      expect(ProfileManager.isValidVersion('26r1')).toBe(true);
    });

    it('isValidVersion should return false for invalid BMS versions', () => {
      expect(ProfileManager.isValidVersion('invalid')).toBe(false);
      expect(ProfileManager.isValidVersion('26R1')).toBe(false); // case-sensitive
      expect(ProfileManager.isValidVersion('')).toBe(false);
    });

    it('getAvailableVersions should list all BMS versions', () => {
      const versions = ProfileManager.getAvailableVersions();
      expect(versions).toContain(BmsVersion.BMS_25R2);
      expect(versions).toContain(BmsVersion.BMS_26R1);
    });
  });

  describe('ProfileManager.fromEnvironment with BCONNECT_BMS_VERSION', () => {
    let origProfile: string | undefined;
    let origVersion: string | undefined;

    beforeEach(() => {
      origProfile = process.env.BCONNECT_MOCK_PROFILE;
      origVersion = process.env.BCONNECT_BMS_VERSION;
      delete process.env.BCONNECT_MOCK_PROFILE;
      delete process.env.BCONNECT_BMS_VERSION;
    });

    afterEach(() => {
      if (origProfile === undefined) {
        delete process.env.BCONNECT_MOCK_PROFILE;
      } else {
        process.env.BCONNECT_MOCK_PROFILE = origProfile;
      }
      if (origVersion === undefined) {
        delete process.env.BCONNECT_BMS_VERSION;
      } else {
        process.env.BCONNECT_BMS_VERSION = origVersion;
      }
    });

    it('should default bmsVersion to 25r2 when BCONNECT_BMS_VERSION not set', () => {
      const profile = ProfileManager.fromEnvironment();
      expect(profile.bmsVersion).toBe(BmsVersion.BMS_25R2);
    });

    it('should use 25r2 when BCONNECT_BMS_VERSION=25r2', () => {
      process.env.BCONNECT_BMS_VERSION = '25r2';
      const profile = ProfileManager.fromEnvironment();
      expect(profile.bmsVersion).toBe(BmsVersion.BMS_25R2);
    });

    it('should use 26r1 when BCONNECT_BMS_VERSION=26r1', () => {
      process.env.BCONNECT_BMS_VERSION = '26r1';
      const profile = ProfileManager.fromEnvironment();
      expect(profile.bmsVersion).toBe(BmsVersion.BMS_26R1);
    });

    it('should throw on invalid BCONNECT_BMS_VERSION', () => {
      process.env.BCONNECT_BMS_VERSION = 'invalid-version';
      expect(() => ProfileManager.fromEnvironment()).toThrow(
        'Invalid BCONNECT_BMS_VERSION: "invalid-version"'
      );
    });

    it('error message for invalid version should list valid values', () => {
      process.env.BCONNECT_BMS_VERSION = 'bad';
      expect(() => ProfileManager.fromEnvironment()).toThrow('25r2');
    });
  });

  describe('BaseProfile.reset() — error branch', () => {
    it('should throw when reset() is called on a readonly profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);
      expect(() => profile.reset()).toThrow('Cannot reset read-only profile: minimal-readonly');
    });

    it('should throw when reset() is called on standard-readonly', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.STANDARD_READONLY);
      expect(() => profile.reset()).toThrow('Cannot reset read-only profile: standard-readonly');
    });

    it('should throw when reset() is called on largescale-readonly', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY);
      expect(() => profile.reset()).toThrow('Cannot reset read-only profile: largescale-readonly');
    });

    it('should not throw when reset() is called on a readwrite profile', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READWRITE);
      expect(() => profile.reset()).not.toThrow();
    });

    it('should not throw when reset() is called on largescale-readwrite', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READWRITE);
      expect(() => profile.reset()).not.toThrow();
    });
  });

  describe('getFixture() — cache and unknown entity branches', () => {
    it('should return the same array on repeated calls (fixture cache hit)', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);
      const first = profile.getFixture('windowsEndpoints');
      const second = profile.getFixture('windowsEndpoints');
      expect(second).toBe(first); // same reference — cache hit
    });

    it('should return empty array for unknown entity type in minimal-readonly', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY);
      const result = profile.getFixture('nonExistentEntity');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for unknown entity type in standard-readwrite', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.STANDARD_READWRITE);
      const result = profile.getFixture('nonExistentEntity');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for unknown entity type in standard-readonly', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.STANDARD_READONLY);
      const result = profile.getFixture('nonExistentEntity');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('largescale-readonly: getFixture returns the generated list for a generated entity type', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY);
      const result = profile.getFixture('jobs') as Array<{ id: string }>;
      const generator = profile.getGenerator?.('jobs');
      expect(result).toHaveLength(generator?.totalItems ?? -1);
      expect(result[0]?.id).toBe((generator?.generateItem(0) as { id: string }).id);
      expect(profile.getFixture('jobs')).toBe(result); // built once, then cached
    });

    it('largescale-readonly: getFixture falls back to standard fixtures without a generator', () => {
      const large = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY);
      const standard = ProfileManager.loadProfile(ProfileMode.STANDARD_READONLY);
      expect(large.getFixture('securityGroups')).toEqual(standard.getFixture('securityGroups'));
      expect(large.getFixture('securityGroups').length).toBeGreaterThan(0);
    });

    it('largescale-readwrite: getFixture serves generated data too', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READWRITE);
      expect(profile.getFixture('logicalGroups').length).toBeGreaterThan(0);
    });
  });

  describe('getFixture() — 26R1 entity paths', () => {
    it('minimal-readonly 26R1 should return array for known 26r1 entity type', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_26R1);
      const result = profile.getFixture('rules');
      expect(Array.isArray(result)).toBe(true);
    });

    it('minimal-readonly 26R1 should return empty array for unknown entity type', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.MINIMAL_READONLY, BmsVersion.BMS_26R1);
      const result = profile.getFixture('unknownEntity26r1');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('standard-readonly 26R1 should return array for known 26r1 entity type', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.STANDARD_READONLY, BmsVersion.BMS_26R1);
      const result = profile.getFixture('rules');
      expect(Array.isArray(result)).toBe(true);
    });

    it('standard-readwrite 26R1 should return array for known 26r1 entity type', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.STANDARD_READWRITE, BmsVersion.BMS_26R1);
      const result = profile.getFixture('rules');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getGenerator() — 26R1 entity paths', () => {
    it('largescale-readonly 26R1 should return generator for vulnerabilities', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_26R1);
      expect(profile.getGenerator?.('vulnerabilities')).not.toBeNull();
    });

    it('largescale-readonly 26R1 should return generator for rules', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_26R1);
      expect(profile.getGenerator?.('rules')).not.toBeNull();
    });

    it('largescale-readonly 26R1 should return generator for bundles', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_26R1);
      expect(profile.getGenerator?.('bundles')).not.toBeNull();
    });

    it('largescale-readonly 25R2 should return null for 26R1-only entities', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_25R2);
      expect(profile.getGenerator?.('vulnerabilities')).toBeNull();
      expect(profile.getGenerator?.('rules')).toBeNull();
    });

    it('largescale-readonly should return null for completely unknown entity type', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READONLY, BmsVersion.BMS_26R1);
      expect(profile.getGenerator?.('nonExistentEntity')).toBeNull();
    });

    it('largescale-readwrite 26R1 should return generator for vulnerabilities', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READWRITE, BmsVersion.BMS_26R1);
      expect(profile.getGenerator?.('vulnerabilities')).not.toBeNull();
    });

    it('largescale-readwrite 25R2 should return null for 26R1-only entities', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READWRITE, BmsVersion.BMS_25R2);
      expect(profile.getGenerator?.('vulnerabilities')).toBeNull();
    });

    it('largescale-readwrite should return null for completely unknown entity type', () => {
      const profile = ProfileManager.loadProfile(ProfileMode.LARGESCALE_READWRITE, BmsVersion.BMS_26R1);
      expect(profile.getGenerator?.('nonExistentEntity')).toBeNull();
    });
  });
});
