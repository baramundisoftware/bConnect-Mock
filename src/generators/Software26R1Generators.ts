/**
 * Software26R1Generators — Lazy deterministic generators for 26R1 Software API expansions
 *
 * Three generators:
 *   - BundlesGenerator:            100 software bundle definitions
 *   - BundleApplicationsGenerator: 500 bundle-application assignments
 *   - DownloadJobsGenerator:        200 download job records
 *
 * All are 26R1-ONLY. LargeScaleReadonlyProfile.getGenerator() returns null
 * for these entity types when bmsVersion = BmsVersion.BMS_25R2.
 *
 * Schemas match fixtures/standard-26r1/:
 *   bundles.json           — id, name, type, ignoreDependencies, parentId, parentName, comment
 *   bundleApplications.json — id, bundleId, bundleName, applicationId, applicationName, applicationVendor, applicationVersion, order
 *   downloadJobs.json      — id, name, interval, lastExecution, lastUpdate, stateValue, stateMessage, url, localPathName
 */

import { BaseGenerator } from './BaseGenerator';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function indexToGuid(prefix: number, index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const seg1 = toHex((prefix << 24) + (index & 0x00ffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 23 + 37) & 0xffff, 4);
  const lo = (index * 67 + 9001) & 0xffffff;
  const hi = (index * 137 + 2029) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function isoDate(index: number, rangeMs = 90 * 24 * 60 * 60 * 1000): string {
  const BASE = new Date('2026-01-01T00:00:00Z').getTime();
  const offset = (index * 43) % rangeMs;
  return new Date(BASE + offset).toISOString();
}

// ---------------------------------------------------------------------------
// BundlesGenerator (100 items)
// ---------------------------------------------------------------------------

const BUNDLE_TYPES = ['ApplicationBundle', 'SoftwarePackage', 'PatchBundle', 'DriverBundle'] as const;

const BUNDLE_FOLDERS: Array<{ parentName: string }> = [
  { parentName: 'Productivity' },
  { parentName: 'Development' },
  { parentName: 'Security' },
  { parentName: 'Infrastructure' },
  { parentName: 'Communication' },
  { parentName: 'Media' },
  { parentName: 'Utilities' },
];

const BUNDLE_NAME_TEMPLATES = [
  'Office Suite Bundle',
  'Security Tools Bundle',
  'Developer Tools Bundle',
  'Browser Bundle',
  'Runtime Bundle',
  'Network Tools Bundle',
  'Media Player Bundle',
  'Remote Access Bundle',
  'Monitoring Tools Bundle',
  'Backup Tools Bundle',
];

export interface BundleRecord {
  id: string;
  name: string;
  type: string;
  ignoreDependencies: boolean;
  parentId: string;
  parentName: string;
  comment: string;
}

export class BundlesGenerator extends BaseGenerator<BundleRecord> {
  readonly totalItems = 100;
  readonly entityType = 'bundles';

  generateItem(index: number): BundleRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const folder = pick(BUNDLE_FOLDERS, index);
    const folderIdx = BUNDLE_FOLDERS.indexOf(folder);
    const nameTpl = pick(BUNDLE_NAME_TEMPLATES, index);
    const cycle = Math.floor(index / BUNDLE_NAME_TEMPLATES.length);
    const name = cycle > 0 ? `${nameTpl} v${cycle + 1}` : nameTpl;

    return {
      id: indexToGuid(0xb0, index),
      name,
      type: pick(BUNDLE_TYPES, index),
      ignoreDependencies: (index % 5) === 0,
      parentId: indexToGuid(0xbf, folderIdx),
      parentName: folder.parentName,
      comment: `Bundle containing ${name.toLowerCase()} applications`,
    };
  }
}

// ---------------------------------------------------------------------------
// BundleApplicationsGenerator (500 items)
// ---------------------------------------------------------------------------

const APP_TEMPLATES: Array<{ name: string; vendor: string; baseVersion: string }> = [
  { name: 'Microsoft Word', vendor: 'Microsoft', baseVersion: '16.0.0' },
  { name: 'Microsoft Excel', vendor: 'Microsoft', baseVersion: '16.0.0' },
  { name: 'Microsoft PowerPoint', vendor: 'Microsoft', baseVersion: '16.0.0' },
  { name: 'Google Chrome', vendor: 'Google', baseVersion: '122.0.0' },
  { name: 'Mozilla Firefox', vendor: 'Mozilla', baseVersion: '124.0.0' },
  { name: 'Adobe Acrobat Reader', vendor: 'Adobe', baseVersion: '23.0.0' },
  { name: 'Visual Studio Code', vendor: 'Microsoft', baseVersion: '1.87.0' },
  { name: 'Git', vendor: 'Git SCM', baseVersion: '2.44.0' },
  { name: 'Node.js', vendor: 'OpenJS Foundation', baseVersion: '20.11.0' },
  { name: 'Python', vendor: 'Python Foundation', baseVersion: '3.12.0' },
  { name: 'Docker Desktop', vendor: 'Docker Inc.', baseVersion: '4.28.0' },
  { name: 'Postman', vendor: 'Postman Inc.', baseVersion: '11.0.0' },
  { name: 'TeamViewer', vendor: 'TeamViewer GmbH', baseVersion: '15.50.0' },
  { name: 'VLC Media Player', vendor: 'VideoLAN', baseVersion: '3.0.20' },
  { name: '7-Zip', vendor: 'Igor Pavlov', baseVersion: '23.01' },
];

export interface BundleApplicationRecord {
  id: string;
  bundleId: string;
  bundleName: string;
  applicationId: string;
  applicationName: string;
  applicationVendor: string;
  applicationVersion: string;
  order: number;
}

export class BundleApplicationsGenerator extends BaseGenerator<BundleApplicationRecord> {
  readonly totalItems = 500;
  readonly entityType = 'bundleApplications';

  private readonly _bundlesGen = new BundlesGenerator();

  generateItem(index: number): BundleApplicationRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    // Assign apps to bundles: ~5 apps per bundle
    const bundleIdx = Math.floor(index / 5) % this._bundlesGen.totalItems;
    const bundle = this._bundlesGen.generateItem(bundleIdx);
    const app = pick(APP_TEMPLATES, index);
    const patchNum = (index * 7) % 200;
    const versionParts = app.baseVersion.split('.');
    const version = `${versionParts[0]}.${versionParts[1]}.${patchNum}`;

    return {
      id: indexToGuid(0xba, index),
      bundleId: bundle.id,
      bundleName: bundle.name,
      applicationId: indexToGuid(0xa0, index),
      applicationName: app.name,
      applicationVendor: app.vendor,
      applicationVersion: version,
      order: (index % 5) + 1,
    };
  }
}

// ---------------------------------------------------------------------------
// DownloadJobsGenerator (200 items)
// ---------------------------------------------------------------------------

const DJ_NAME_TEMPLATES = [
  'Windows Updates Download',
  'Software Repository Sync',
  'Driver Update Package',
  'Security Patch Download',
  'Application Update Feed',
  'Firmware Update Package',
  'Definition Update Sync',
  'Certificate Bundle Update',
];

const DJ_URLS = [
  'https://windowsupdate.microsoft.com',
  'https://repo.company.com/software',
  'https://drivers.company.com',
  'https://security.company.com/patches',
  'https://updates.company.com/apps',
];

const DJ_STATES = ['Succeeded', 'Succeeded', 'Succeeded', 'Failed', 'Running', 'Queued'] as const;

const DJ_PATHS_BASE = 'C:\\bConnect\\Downloads';

export interface DownloadJobRecord {
  id: string;
  name: string;
  interval: number;
  lastExecution: string;
  lastUpdate: string;
  stateValue: string;
  stateMessage: string;
  url: string;
  localPathName: string;
}

export class DownloadJobsGenerator extends BaseGenerator<DownloadJobRecord> {
  readonly totalItems = 200;
  readonly entityType = 'downloadJobs';

  generateItem(index: number): DownloadJobRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const nameTpl = pick(DJ_NAME_TEMPLATES, index);
    const cycle = Math.floor(index / DJ_NAME_TEMPLATES.length);
    const name = cycle > 0 ? `${nameTpl} ${zeroPad(cycle + 1, 2)}` : `${nameTpl}`;
    const state = pick(DJ_STATES, index);
    const intervals = [720, 1440, 360, 2880, 60] as const;
    const interval = pick(intervals, index);
    const lastExec = isoDate(index * 7);
    const lastUpdate = isoDate(index * 7 + 45 * 60 * 1000); // ~45min after execution

    const stateMessage = state === 'Succeeded'
      ? `Downloaded ${(index % 20) + 1} items successfully`
      : state === 'Failed'
      ? `Connection timeout after ${(index % 5) + 1} retries`
      : `In progress: ${(index % 100)}% complete`;

    return {
      id: indexToGuid(0xda, index),
      name,
      interval,
      lastExecution: lastExec,
      lastUpdate,
      stateValue: state,
      stateMessage,
      url: pick(DJ_URLS, index),
      localPathName: `${DJ_PATHS_BASE}\\${nameTpl.replace(/ /g, '')}`,
    };
  }
}
