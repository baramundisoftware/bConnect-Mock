/**
 * Profile Manager - Centralized profile loading and selection
 *
 * Architectural Decision Record (ADR):
 * - Six profiles: minimal/standard/largescale × readonly/readwrite
 * - Readonly profiles: Immutable data, HTTP 501 for write methods
 * - Readwrite profiles: Stateful CRUD, in-memory state, reset capability
 * - Profile selection via environment variable or programmatic API
 */

import { HIDDEN_TREE_ROOTS, withHiddenTreeRoot } from './treeRoots';
import fs from 'fs';
import path from 'path';

// Lazy generator imports — used by LargeScaleReadonlyProfile and LargeScaleReadwriteProfile
import {
  WindowsEndpointGenerator,
  AndroidEndpointGenerator,
  LinuxEndpointGenerator,
  MacEndpointGenerator,
  SoftwareGenerator,
  WindowsUpdatesGenerator,
  VulnerabilitiesGenerator,
  RulesGenerator,
  RuleViolationsGenerator,
  UniversalDynamicGroupsGenerator,
  BundlesGenerator,
  BundleApplicationsGenerator,
  DownloadJobsGenerator,
  ApiKeysGenerator,
  IosEndpointGenerator,
  NetworkEndpointGenerator,
  IndustrialEndpointGenerator,
  JobInstanceGenerator,
  JobDefinitionGenerator,
  AssetGenerator,
  ADUserGenerator,
  ADGroupGenerator,
  LogicalGroupGenerator,
} from '../generators';

/**
 * BmsVersion enum - Supported BMS (baramundi Management Suite) API versions
 * Values match the subdirectory names in bConnectOpenAPI/ and BCONNECT_BMS_VERSION env var.
 */
export enum BmsVersion {
  BMS_25R2 = '25r2',
  BMS_26R1 = '26r1',
}

/**
 * ProfileMode enum - All available profile modes
 */
export enum ProfileMode {
  MINIMAL_READONLY = 'minimal-readonly',
  MINIMAL_READWRITE = 'minimal-readwrite',
  STANDARD_READONLY = 'standard-readonly',
  STANDARD_READWRITE = 'standard-readwrite',
  LARGESCALE_READONLY = 'largescale-readonly',
  LARGESCALE_READWRITE = 'largescale-readwrite',
}

/**
 * Profile metadata - Performance targets and entity counts
 */
export interface IProfileMetadata {
  /** Human-readable description */
  description: string;
  /** Entity count breakdown */
  entityCount: {
    windowsEndpoints: number;
    androidEndpoints: number;
    linuxEndpoints: number;
    macEndpoints: number;
    software: number;
    cves: number;
    jobs: number;
    assets: number;
    variables: number;
    adGroups: number;
  };
  /** P95 response time target (milliseconds) */
  responseTimeTarget: number;
  /** Memory usage target (bytes) */
  memoryTarget: number;
  /** Use cases for this profile */
  useCases: string[];
}

/**
 * IProfile interface - Contract that all profiles must implement
 */
export interface IProfile {
  /**
   * Get a lazy data generator for the given entity type (large-scale profiles only).
   * Returns null for profiles that use static fixture arrays.
   * When non-null, app.ts uses the generator path instead of getFixture().
   * See ADR-005 for design rationale.
   */
  getGenerator?(entityType: string): import('../generators/IDataGenerator').IDataGenerator | null;
  /** Profile name (e.g., "minimal-readonly") */
  name: string;

  /** Profile mode enum value */
  mode: ProfileMode;

  /** BMS version this profile is configured for */
  bmsVersion: BmsVersion;

  /** True if profile is read-only (GET only) */
  isReadOnly: boolean;

  /** True if profile supports state reset (POST /api/reset) */
  supportsReset: boolean;

  /** Profile metadata (entity counts, performance targets) */
  metadata: IProfileMetadata;

  /**
   * Get fixture data for a specific entity type
   * @param entityType - The entity type (e.g., 'windowsEndpoints', 'software')
   * @returns Array of entities or generator function for large-scale profiles
   */
  getFixture(entityType: string): unknown[] | (() => unknown[]);

  /**
   * Reset profile state to initial fixtures (readwrite profiles only)
   * @throws Error if profile is read-only
   */
  reset(): void;
}

/**
 * ProfileManager - Factory for loading and managing profiles
 */
export class ProfileManager {
  private static readonly DEFAULT_PROFILE = ProfileMode.MINIMAL_READONLY;
  private static readonly DEFAULT_VERSION = BmsVersion.BMS_25R2;

  /**
   * Load a profile by mode and optional BMS version (default: 25r2)
   * @param mode - The profile mode to load
   * @param version - The BMS version (default: BmsVersion.BMS_25R2)
   * @returns IProfile instance
   * @throws Error if profile mode is invalid
   */
  static loadProfile(mode: ProfileMode, version: BmsVersion = BmsVersion.BMS_25R2): IProfile {
    switch (mode) {
      case ProfileMode.MINIMAL_READONLY:
        return withTreeRoots(new MinimalReadonlyProfile(version));
      case ProfileMode.MINIMAL_READWRITE:
        return withTreeRoots(new MinimalReadwriteProfile(version));
      case ProfileMode.STANDARD_READONLY:
        return withTreeRoots(new StandardReadonlyProfile(version));
      case ProfileMode.STANDARD_READWRITE:
        return withTreeRoots(new StandardReadwriteProfile(version));
      case ProfileMode.LARGESCALE_READONLY:
        return withTreeRoots(new LargeScaleReadonlyProfile(version));
      case ProfileMode.LARGESCALE_READWRITE:
        return withTreeRoots(new LargeScaleReadwriteProfile(version));
      default:
        throw new Error(`Unknown profile mode: ${mode}`);
    }
  }

  /**
   * Load profile from environment variables BCONNECT_MOCK_PROFILE and BCONNECT_BMS_VERSION.
   * Defaults: profile=minimal-readonly, version=25r2.
   * Fails fast with a clear error on invalid values.
   * @returns IProfile instance
   * @throws Error if environment variable has invalid value
   */
  static fromEnvironment(): IProfile {
    const profileName = process.env.BCONNECT_MOCK_PROFILE ?? this.DEFAULT_PROFILE;
    const versionStr = process.env.BCONNECT_BMS_VERSION ?? this.DEFAULT_VERSION;

    if (!this.isValidMode(profileName)) {
      throw new Error(
        `Invalid BCONNECT_MOCK_PROFILE: "${profileName}". ` +
        `Valid values: ${Object.values(ProfileMode).join(', ')}`
      );
    }
    if (!this.isValidVersion(versionStr)) {
      throw new Error(
        `Invalid BCONNECT_BMS_VERSION: "${versionStr}". ` +
        `Valid values: ${Object.values(BmsVersion).join(', ')}`
      );
    }

    return this.loadProfile(profileName as ProfileMode, versionStr as BmsVersion);
  }

  /**
   * Validate if a string is a valid profile mode
   * @param mode - The string to validate
   * @returns True if valid profile mode
   */
  static isValidMode(mode: string): mode is ProfileMode {
    return Object.values(ProfileMode).includes(mode as ProfileMode);
  }

  /**
   * Validate if a string is a valid BMS version
   * @param version - The string to validate
   * @returns True if valid BMS version
   */
  static isValidVersion(version: string): version is BmsVersion {
    return Object.values(BmsVersion).includes(version as BmsVersion);
  }

  /**
   * Get list of all available profile modes
   * @returns Array of profile mode strings
   */
  static getAvailableModes(): ProfileMode[] {
    return Object.values(ProfileMode);
  }

  /**
   * Get list of all supported BMS versions
   * @returns Array of BMS version strings
   */
  static getAvailableVersions(): BmsVersion[] {
    return Object.values(BmsVersion);
  }
}

/**
 * Fixture base directory — overridable via FIXTURES_ROOT env var (P10.14).
 * Defaults to <project-root>/fixtures relative to this file's compiled location.
 */
function getFixturesRoot(): string {
  return process.env.FIXTURES_ROOT ?? path.join(__dirname, '../../fixtures');
}

/**
 * Load a fixture JSON file from a specific fixture directory.
 * Returns the array content, handling both top-level arrays and nested arrays.
 */
function loadFixtureFile(fixtureDir: string, fileName: string): unknown[] {
  const fixturePath = path.join(fixtureDir, fileName);
  const data = JSON.parse(fs.readFileSync(fixturePath, 'utf-8')) as unknown;
  if (Array.isArray(data)) { return data; }
  if (data && typeof data === 'object') {
    const firstArray = Object.values(data as Record<string, unknown>).find(Array.isArray);
    if (firstArray) { return firstArray as unknown[]; }
  }
  return [];
}

/**
 * Every profile serves its trees as a live bMS does: top items point to the module's hidden root
 * and every item names its parent (src/profiles/treeRoots.ts). Applied once per source list, for
 * fixtures and generated data alike.
 */
function withTreeRoots(profile: IProfile): IProfile {
  const load = profile.getFixture.bind(profile);
  const done = new WeakMap<object, unknown[]>();
  profile.getFixture = (entityType: string) => {
    const data = load(entityType);
    if (!HIDDEN_TREE_ROOTS[entityType] || !Array.isArray(data)) { return data; }
    let items = done.get(data);
    if (!items) {
      items = withHiddenTreeRoot(entityType, data as Record<string, unknown>[]);
      done.set(data, items);
    }
    return items;
  };
  return profile;
}

/**
 * Base Profile class - Shared functionality for all profiles
 */
abstract class BaseProfile implements IProfile {
  abstract name: string;
  abstract mode: ProfileMode;
  abstract isReadOnly: boolean;
  abstract metadata: IProfileMetadata;

  /** Per-instance fixture cache — populated on first access, then reused */
  protected readonly _fixtureCache = new Map<string, unknown[]>();

  constructor(public readonly bmsVersion: BmsVersion = BmsVersion.BMS_25R2) {}

  get supportsReset(): boolean {
    return !this.isReadOnly;
  }

  abstract getFixture(entityType: string): unknown[] | (() => unknown[]);

  reset(): void {
    if (this.isReadOnly) {
      throw new Error(`Cannot reset read-only profile: ${this.name}`);
    }
    // Readwrite profiles will override this method
  }
}

/**
 * Minimal Readonly Profile - 1 entity each, GET only
 */
class MinimalReadonlyProfile extends BaseProfile {
  name = 'minimal-readonly';
  mode = ProfileMode.MINIMAL_READONLY;
  isReadOnly = true;

  constructor(version: BmsVersion = BmsVersion.BMS_25R2) {
    super(version);
  }

  metadata: IProfileMetadata = {
    description: 'Minimal profile with 2 entities each, read-only (GET only)',
    entityCount: {
      windowsEndpoints: 2,
      androidEndpoints: 1,
      linuxEndpoints: 0,
      macEndpoints: 0,
      software: 1,
      cves: 1,
      jobs: 1,
      assets: 1,
      variables: 1,
      adGroups: 1,
    },
    responseTimeTarget: 50, // < 50ms P95
    memoryTarget: 50 * 1024 * 1024, // < 50MB
    useCases: [
      'Unit tests for GET operations',
      'CI/CD pipelines (fast startup)',
      'API contract validation',
      'Parallel test execution',
      'Pagination and sorting tests (2 endpoints minimum)',
    ],
  };

  getFixture(entityType: string): unknown[] {
    if (this._fixtureCache.has(entityType)) {
      return this._fixtureCache.get(entityType) ?? [];
    }

    const root = getFixturesRoot();
    const minDir = path.join(root, 'minimal-readonly');

    const fixtureMap: Record<string, string> = {
      software: 'software.json',
      windowsUpdates: 'windowsUpdates.json',
      iosEndpoints: 'iosEndpoints.json',
      networkEndpoints: 'networkEndpoints.json',
      industrialEndpoints: 'industrialEndpoints.json',
      logicalGroups: 'logicalGroups.json',
      jobs: 'jobs.json',
      jobInstances: 'jobInstances.json',
      staticGroups: 'staticGroups.json',
      dynamicGroups: 'dynamicGroups.json',
      adUsers: 'adUsers.json',
      orgUnits: 'orgUnits.json',
      bitLockerSecrets: 'bitLockerSecrets.json',
      localAdminAccounts: 'localAdminAccounts.json',
      microsoftDefenderThreats: 'microsoftDefenderThreats.json',
      microsoftDefenderStates: 'microsoftDefenderStates.json',
      gateway: 'gateway.json',
      managementServer: 'managementServer.json',
      cloudConnectors: 'cloudConnectors.json',
      pxeRelays: 'pxeRelays.json',
      vpnAppliance: 'vpnAppliance.json',
      dips: 'dips.json',
      windowsApplications: 'windowsApplications.json',
      windowsJobDefinitions: 'windowsJobDefinitions.json',
    };

    let result: unknown[] = [];

    if (entityType === 'windowsEndpoints') {
      try {
        result = loadFixtureFile(minDir, 'windowsEndpoints.json').slice(0, 2);
      } catch { result = []; }
    } else if (fixtureMap[entityType]) {
      try {
        result = loadFixtureFile(minDir, fixtureMap[entityType] as string);
      } catch { result = []; }
    } else if (this.bmsVersion === BmsVersion.BMS_26R1) {
      const fixtureMap26r1: Record<string, string> = {
        rules: 'rules.json', vulnerabilities: 'vulnerabilities.json',
        detectedVulnerabilities: 'detectedVulnerabilities.json',
        ruleViolations: 'ruleViolations.json',
        universalDynamicGroups: 'universalDynamicGroups.json',
        folders: 'folders.json', bundles: 'bundles.json',
        bundleFolders: 'bundleFolders.json', bundleApplications: 'bundleApplications.json',
        apiKeys: 'apiKeys.json', downloadJobs: 'downloadJobs.json',
        unmanagedEndpoints: 'unmanagedEndpoints.json', entraIdData: 'entraIdData.json',
      };
      const f = fixtureMap26r1[entityType];
      if (f) {
        try { result = loadFixtureFile(path.join(root, 'minimal-26r1'), f); } catch { result = []; }
      }
    }

    this._fixtureCache.set(entityType, result);
    return result;
  }
}

/**
 * Minimal Readwrite Profile - 1 entity each, full CRUD
 */
class MinimalReadwriteProfile extends BaseProfile {
  name = 'minimal-readwrite';
  mode = ProfileMode.MINIMAL_READWRITE;
  isReadOnly = false;

  constructor(version: BmsVersion = BmsVersion.BMS_25R2) {
    super(version);
  }

  metadata: IProfileMetadata = {
    description: 'Minimal profile with 2 entities each, read-write (full CRUD)',
    entityCount: {
      windowsEndpoints: 2,
      androidEndpoints: 1,
      linuxEndpoints: 0,
      macEndpoints: 0,
      software: 1,
      cves: 1,
      jobs: 1,
      assets: 1,
      variables: 1,
      adGroups: 1,
    },
    responseTimeTarget: 100, // < 100ms P95
    memoryTarget: 100 * 1024 * 1024, // < 100MB
    useCases: [
      'Unit tests for write operations',
      'Integration tests with CRUD',
      'API behavior validation',
      'Stateful testing (reset capability)',
    ],
  };

  private _readonly?: IProfile;

  /** The same data as minimal-readonly (both versions); writes go to the StateManager */
  getFixture(entityType: string): unknown[] {
    return (this._readonly ??= new MinimalReadonlyProfile(this.bmsVersion)).getFixture(entityType) as unknown[];
  }

  override reset(): void {
    // Stub implementation - actual state reset in Phase 2
    console.info('Resetting minimal-readwrite profile to initial state');
  }
}

/**
 * Standard Readonly Profile - 10-20 entities, GET only
 */
class StandardReadonlyProfile extends BaseProfile {
  name = 'standard-readonly';
  mode = ProfileMode.STANDARD_READONLY;
  isReadOnly = true;

  constructor(version: BmsVersion = BmsVersion.BMS_25R2) {
    super(version);
  }

  metadata: IProfileMetadata = {
    description: 'Standard profile with 10-20 entities, read-only (GET only)',
    entityCount: {
      windowsEndpoints: 10,
      androidEndpoints: 5,
      linuxEndpoints: 3,
      macEndpoints: 2,
      software: 10,
      cves: 10,
      jobs: 5,
      assets: 10,
      variables: 5,
      adGroups: 8,
    },
    responseTimeTarget: 100, // < 100ms P95
    memoryTarget: 200 * 1024 * 1024, // < 200MB
    useCases: [
      'Integration testing with realistic data',
      'Feature development and debugging',
      'Demo environments',
    ],
  };

  getFixture(entityType: string): unknown[] {
    if (this._fixtureCache.has(entityType)) {
      return this._fixtureCache.get(entityType) ?? [];
    }

    const root = getFixturesRoot();

    const fixtureMap: Record<string, string> = {
      windowsEndpoints: 'windowsEndpoints.json', androidEndpoints: 'androidEndpoints.json',
      linuxEndpoints: 'linuxEndpoints.json', macEndpoints: 'macEndpoints.json',
      iosEndpoints: 'iosEndpoints.json', networkEndpoints: 'networkEndpoints.json',
      industrialEndpoints: 'industrialEndpoints.json', logicalGroups: 'logicalGroups.json',
      software: 'software.json', windowsUpdates: 'windowsUpdates.json',
      jobs: 'jobs.json', jobInstances: 'jobInstances.json',
      assets: 'assets.json', variables: 'variables.json',
      adGroups: 'adGroups.json', adObjects: 'adObjects.json',
      microservices: 'microservices.json', bitLockerStates: 'bitLockerStates.json',
      osFolders: 'osFolders.json',
      staticGroups: 'staticGroups.json', dynamicGroups: 'dynamicGroups.json',
      adUsers: 'adUsers.json', installedWindowsSoftware: 'installedWindowsSoftware.json',
      orgUnits: 'orgUnits.json', variableInstances: 'variableInstances.json',
      kioskReleases: 'kioskReleases.json', securityGroups: 'securityGroups.json',
      securityProfiles: 'securityProfiles.json', assetTypes: 'assetTypes.json',
      jobFolders: 'jobFolders.json', assetTypeFolders: 'assetTypeFolders.json',
      assetStockFolders: 'assetStockFolders.json',
      bitLockerSecrets: 'bitLockerSecrets.json',
      localAdminAccounts: 'localAdminAccounts.json',
      microsoftDefenderThreats: 'microsoftDefenderThreats.json',
      microsoftDefenderStates: 'microsoftDefenderStates.json',
      gateway: 'gateway.json',
      managementServer: 'managementServer.json',
      cloudConnectors: 'cloudConnectors.json',
      pxeRelays: 'pxeRelays.json',
      vpnAppliance: 'vpnAppliance.json',
      dips: 'dips.json',
      windowsApplications: 'windowsApplications.json',
      windowsJobDefinitions: 'windowsJobDefinitions.json',
    };

    let result: unknown[] = [];

    if (this.bmsVersion === BmsVersion.BMS_26R1) {
      const fixtureMap26r1: Record<string, string> = {
        rules: 'rules.json', vulnerabilities: 'vulnerabilities.json',
        detectedVulnerabilities: 'detectedVulnerabilities.json',
        ruleViolations: 'ruleViolations.json',
        universalDynamicGroups: 'universalDynamicGroups.json',
        folders: 'folders.json', bundles: 'bundles.json',
        bundleFolders: 'bundleFolders.json', bundleApplications: 'bundleApplications.json',
        apiKeys: 'apiKeys.json', downloadJobs: 'downloadJobs.json',
        unmanagedEndpoints: 'unmanagedEndpoints.json', entraIdData: 'entraIdData.json',
      };
      const f26 = fixtureMap26r1[entityType];
      if (f26) {
        try { result = loadFixtureFile(path.join(root, 'standard-26r1'), f26); } catch { result = []; }
        this._fixtureCache.set(entityType, result);
        return result;
      }
    }

    const fixtureFile = fixtureMap[entityType];
    if (fixtureFile) {
      try {
        result = loadFixtureFile(path.join(root, 'standard-readonly'), fixtureFile);
      } catch (error) {
        console.warn(`Failed to load fixture for ${entityType}:`, error);
        result = [];
      }
    }

    this._fixtureCache.set(entityType, result);
    return result;
  }
}

/**
 * Standard Readwrite Profile - 10-20 entities, full CRUD
 */
class StandardReadwriteProfile extends BaseProfile {
  name = 'standard-readwrite';
  mode = ProfileMode.STANDARD_READWRITE;
  isReadOnly = false;

  constructor(version: BmsVersion = BmsVersion.BMS_25R2) {
    super(version);
  }

  metadata: IProfileMetadata = {
    description: 'Standard profile with 10-20 entities, read-write (full CRUD)',
    entityCount: {
      windowsEndpoints: 10,
      androidEndpoints: 5,
      linuxEndpoints: 3,
      macEndpoints: 2,
      software: 10,
      cves: 10,
      jobs: 5,
      assets: 10,
      variables: 5,
      adGroups: 8,
    },
    responseTimeTarget: 150, // < 150ms P95
    memoryTarget: 300 * 1024 * 1024, // < 300MB
    useCases: [
      'Integration testing with CRUD operations',
      'bConnect-MCP write operation testing',
      'bMCWeb_V2_0 state mutation testing',
    ],
  };

  getFixture(entityType: string): unknown[] {
    if (this._fixtureCache.has(entityType)) {
      return this._fixtureCache.get(entityType) ?? [];
    }

    const root = getFixturesRoot();
    const fixtureMap: Record<string, string> = {
      windowsEndpoints: 'windowsEndpoints.json', androidEndpoints: 'androidEndpoints.json',
      linuxEndpoints: 'linuxEndpoints.json', macEndpoints: 'macEndpoints.json',
      iosEndpoints: 'iosEndpoints.json', networkEndpoints: 'networkEndpoints.json',
      industrialEndpoints: 'industrialEndpoints.json', logicalGroups: 'logicalGroups.json',
      software: 'software.json', windowsUpdates: 'windowsUpdates.json',
      jobs: 'jobs.json', jobInstances: 'jobInstances.json',
      assets: 'assets.json', variables: 'variables.json',
      adGroups: 'adGroups.json', adObjects: 'adObjects.json',
      microservices: 'microservices.json', bitLockerStates: 'bitLockerStates.json',
      osFolders: 'osFolders.json',
      staticGroups: 'staticGroups.json', dynamicGroups: 'dynamicGroups.json',
      adUsers: 'adUsers.json', installedWindowsSoftware: 'installedWindowsSoftware.json',
      orgUnits: 'orgUnits.json', variableInstances: 'variableInstances.json',
      kioskReleases: 'kioskReleases.json', securityGroups: 'securityGroups.json',
      securityProfiles: 'securityProfiles.json', assetTypes: 'assetTypes.json',
      jobFolders: 'jobFolders.json', assetTypeFolders: 'assetTypeFolders.json',
      assetStockFolders: 'assetStockFolders.json',
      bitLockerSecrets: 'bitLockerSecrets.json',
      localAdminAccounts: 'localAdminAccounts.json',
      microsoftDefenderThreats: 'microsoftDefenderThreats.json',
      microsoftDefenderStates: 'microsoftDefenderStates.json',
      gateway: 'gateway.json',
      managementServer: 'managementServer.json',
      cloudConnectors: 'cloudConnectors.json',
      pxeRelays: 'pxeRelays.json',
      vpnAppliance: 'vpnAppliance.json',
      dips: 'dips.json',
      windowsApplications: 'windowsApplications.json',
      windowsJobDefinitions: 'windowsJobDefinitions.json',
    };

    let result: unknown[] = [];

    if (this.bmsVersion === BmsVersion.BMS_26R1) {
      const fixtureMap26r1: Record<string, string> = {
        rules: 'rules.json', vulnerabilities: 'vulnerabilities.json',
        detectedVulnerabilities: 'detectedVulnerabilities.json',
        ruleViolations: 'ruleViolations.json',
        universalDynamicGroups: 'universalDynamicGroups.json',
        folders: 'folders.json', bundles: 'bundles.json',
        bundleFolders: 'bundleFolders.json', bundleApplications: 'bundleApplications.json',
        apiKeys: 'apiKeys.json', downloadJobs: 'downloadJobs.json',
        unmanagedEndpoints: 'unmanagedEndpoints.json', entraIdData: 'entraIdData.json',
      };
      const f26 = fixtureMap26r1[entityType];
      if (f26) {
        try { result = loadFixtureFile(path.join(root, 'standard-26r1'), f26); } catch { result = []; }
        this._fixtureCache.set(entityType, result);
        return result;
      }
    }

    const fixtureFile = fixtureMap[entityType];
    if (!fixtureFile) { return []; }
    try {
      // adObjects, bitLockerStates, osFolders are system-derived read-only entities in BMS
      // (not user-manageable), so they only exist in standard-readonly/ — fall back intentionally.
      const rwPath = path.join(root, 'standard-readwrite', fixtureFile);
      const roPath = path.join(root, 'standard-readonly', fixtureFile);
      const fixturePath = fs.existsSync(rwPath) ? rwPath : roPath;
      result = loadFixtureFile(path.dirname(fixturePath), path.basename(fixturePath));
    } catch { result = []; }

    this._fixtureCache.set(entityType, result);
    return result;
  }
}

/**
 * The generator for an entity type on both large-scale profiles (readonly and readwrite serve the
 * same data; before, largescale-readwrite lacked the iOS, network, industrial endpoint and job
 * instance generators).
 */
function largeScaleGenerator(entityType: string, version: BmsVersion): import('../generators/IDataGenerator').IDataGenerator | null {
  // 25R2 entities — available in all BMS versions
  switch (entityType) {
    case 'windowsEndpoints':     return new WindowsEndpointGenerator();
    case 'androidEndpoints':     return new AndroidEndpointGenerator();
    case 'linuxEndpoints':       return new LinuxEndpointGenerator();
    case 'macEndpoints':         return new MacEndpointGenerator();
    case 'iosEndpoints':         return new IosEndpointGenerator();
    case 'networkEndpoints':     return new NetworkEndpointGenerator();
    case 'industrialEndpoints':  return new IndustrialEndpointGenerator();
    case 'software':             return new SoftwareGenerator();
    case 'windowsUpdates':       return new WindowsUpdatesGenerator();
    case 'jobInstances':         return new JobInstanceGenerator();
    case 'jobs':                  return new JobDefinitionGenerator();
    case 'assets':               return new AssetGenerator();
    case 'adUsers':              return new ADUserGenerator();
    case 'adGroups':             return new ADGroupGenerator();
    case 'logicalGroups':        return new LogicalGroupGenerator();
  }

  // 26R1-only entities — null in 25R2 mode (caller treats as HTTP 404)
  if (version === BmsVersion.BMS_26R1) {
    switch (entityType) {
      case 'vulnerabilities':        return new VulnerabilitiesGenerator();
      case 'rules':                  return new RulesGenerator();
      case 'ruleViolations':         return new RuleViolationsGenerator();
      case 'universalDynamicGroups': return new UniversalDynamicGroupsGenerator();
      case 'bundles':                return new BundlesGenerator();
      case 'bundleApplications':     return new BundleApplicationsGenerator();
      case 'downloadJobs':           return new DownloadJobsGenerator();
      case 'apiKeys':                return new ApiKeysGenerator();
    }
  }

  return null;
}

/**
 * Data for a large-scale profile's getFixture(): the generated list for entity types with a
 * generator (built once on first use, then cached; all generators together take ~0.5 s and
 * ~100 MB), and the standard-readonly fixtures for everything else. Before, getFixture()
 * returned [] here, so every handler that reads fixtures (get by ID, sub-resources, lists
 * without a generator) answered 404 or an empty list on large-scale profiles.
 */
function largeScaleFixture(
  profile: { getGenerator(entityType: string): import('../generators/IDataGenerator').IDataGenerator | null },
  entityType: string,
  cache: Map<string, unknown[]>,
  standard: () => IProfile,
): unknown[] {
  const cached = cache.get(entityType);
  if (cached) { return cached; }
  const generator = profile.getGenerator(entityType);
  let data = generator
    ? generator.generatePage({ page: 0, pageSize: generator.totalItems })
    : (standard().getFixture(entityType) as unknown[]);
  const links = WINDOWS_ENDPOINT_LINKS[entityType];
  if (!generator && links) {
    data = onGeneratedWindowsEndpoints(data as Record<string, unknown>[], links,
      standard().getFixture('windowsEndpoints') as Record<string, unknown>[],
      largeScaleFixture(profile, 'windowsEndpoints', cache, standard) as Record<string, unknown>[]);
  }
  cache.set(entityType, data);
  return data;
}

/**
 * Standard fixtures without a large-scale generator that link to Windows endpoints:
 * the link field, and the field holding the endpoint's name (if any).
 */
const WINDOWS_ENDPOINT_LINKS: Record<string, { id: string; name?: string }> = {
  microsoftDefenderStates: { id: 'endpointId', name: 'endpointName' },
  microsoftDefenderThreats: { id: 'windowsEndpointId' },
};

/**
 * Move fixture items that link to the n-th standard Windows endpoint onto the n-th generated
 * one. On large-scale profiles, the Windows endpoints are generated (other IDs), so links to the
 * standard ones led nowhere: e.g. MicrosoftDefender/WindowsEndpoints/{endpointId}/Threats
 * answered 404 for every endpoint of the Defender state list.
 */
function onGeneratedWindowsEndpoints(
  items: Record<string, unknown>[],
  links: { id: string; name?: string },
  standardEndpoints: Record<string, unknown>[],
  generatedEndpoints: Record<string, unknown>[],
): Record<string, unknown>[] {
  const position = new Map(standardEndpoints.map((e, i) => [e['id'], i]));
  return items.map((item) => {
    const target = generatedEndpoints[position.get(item[links.id]) ?? -1];
    if (!target) { return item; }
    return {
      ...item,
      [links.id]: target['id'],
      ...(links.name ? { [links.name]: target['hostName'] ?? target['displayName'] } : {}),
    };
  });
}

/**
 * Large-Scale Readonly Profile - 70,000 entities, GET only, lazy loading
 */
class LargeScaleReadonlyProfile extends BaseProfile {
  name = 'largescale-readonly';
  mode = ProfileMode.LARGESCALE_READONLY;
  isReadOnly = true;

  constructor(version: BmsVersion = BmsVersion.BMS_25R2) {
    super(version);
  }

  metadata: IProfileMetadata = {
    description: 'Large-scale profile with 70,000 entities, read-only (lazy loading)',
    entityCount: {
      windowsEndpoints: 60000,
      androidEndpoints: 5000,
      linuxEndpoints: 2500,
      macEndpoints: 2500,
      software: 500,
      cves: 200,
      jobs: 100,
      assets: 70000,
      variables: 50,
      adGroups: 200,
    },
    responseTimeTarget: 500, // < 500ms P95
    memoryTarget: 2 * 1024 * 1024 * 1024, // < 2GB
    useCases: [
      'bMCWeb_V2_0 performance testing',
      'Load testing with high concurrency',
      'Memory profiling and optimization',
      'Pagination stress testing',
    ],
  };

  private readonly _largeScaleData = new Map<string, unknown[]>();
  private _standard?: IProfile;

  getFixture(entityType: string): unknown[] {
    return largeScaleFixture(this, entityType, this._largeScaleData,
      () => (this._standard ??= new StandardReadonlyProfile(this.bmsVersion)));
  }

  getGenerator(entityType: string): import('../generators/IDataGenerator').IDataGenerator | null {
    return largeScaleGenerator(entityType, this.bmsVersion);
  }

}

/**
 * Large-Scale Readwrite Profile - 70,000 entities, full CRUD, lazy loading
 */
class LargeScaleReadwriteProfile extends BaseProfile {
  name = 'largescale-readwrite';
  mode = ProfileMode.LARGESCALE_READWRITE;
  isReadOnly = false;

  constructor(version: BmsVersion = BmsVersion.BMS_25R2) {
    super(version);
  }

  metadata: IProfileMetadata = {
    description: 'Large-scale profile with 70,000 entities, read-write (stress testing)',
    entityCount: {
      windowsEndpoints: 60000,
      androidEndpoints: 5000,
      linuxEndpoints: 2500,
      macEndpoints: 2500,
      software: 500,
      cves: 200,
      jobs: 100,
      assets: 70000,
      variables: 50,
      adGroups: 200,
    },
    responseTimeTarget: 1000, // < 1000ms P95
    memoryTarget: 4 * 1024 * 1024 * 1024, // < 4GB
    useCases: [
      'Stress testing write operations',
      'Concurrent write conflict testing',
      'Memory leak detection',
      'bMCWeb_V2_0 bulk operation testing',
    ],
  };

  private readonly _largeScaleData = new Map<string, unknown[]>();
  private _standard?: IProfile;

  getFixture(entityType: string): unknown[] {
    return largeScaleFixture(this, entityType, this._largeScaleData,
      () => (this._standard ??= new StandardReadonlyProfile(this.bmsVersion)));
  }

  getGenerator(entityType: string): import('../generators/IDataGenerator').IDataGenerator | null {
    return largeScaleGenerator(entityType, this.bmsVersion);
  }


  override reset(): void {
    console.warn('WARNING: Resetting largescale-readwrite profile');
  }
}
