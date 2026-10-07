/**
 * WindowsEndpointGenerator — Lazy deterministic generator for Windows endpoints
 *
 * Generates 60,000 Windows endpoints on demand. Each item is derived purely
 * from its index — same index always produces the same endpoint (deterministic).
 *
 * Regional distribution (P5.4):
 *   0–14,999   Americas    (15,000)
 *   15,000–32,999  EMEA-West   (18,000)
 *   33,000–44,999  EMEA-East   (12,000)
 *   45,000–53,999  APAC        (9,000)
 *   54,000–59,999  Global/Other (6,000)
 *
 * See ADR-005 for design rationale.
 */

import { BaseGenerator } from './BaseGenerator';

// ---------------------------------------------------------------------------
// Data pools (deterministic lookup tables, index % pool.length)
// ---------------------------------------------------------------------------

const OS_VERSIONS = [
  'Microsoft Windows 11 Enterprise 23H2',
  'Microsoft Windows 11 Pro 23H2',
  'Microsoft Windows 11 Enterprise 22H2',
  'Microsoft Windows 10 Enterprise 22H2',
  'Microsoft Windows 10 Pro 21H2',
  'Microsoft Windows 10 Enterprise LTSC 2021',
  'Microsoft Windows 10 Pro 22H2',
  'Microsoft Windows 11 Enterprise 21H2',
  'Microsoft Windows Server 2022 Standard',
  'Microsoft Windows Server 2019 Datacenter',
];

const OS_VERSION_STRINGS = [
  '10.0.22631', // Win11 23H2
  '10.0.22621', // Win11 22H2
  '10.0.19045', // Win10 22H2
  '10.0.19044', // Win10 21H2
  '10.0.14393', // LTSC
  '10.0.20348', // Server 2022
  '10.0.17763', // Server 2019
];

const MANUFACTURERS = [
  'Dell Technologies',
  'HP Inc.',
  'Lenovo',
  'Microsoft',
  'Apple Inc.',
  'ASUS',
  'Acer',
  'Fujitsu',
  'Panasonic',
  'Toshiba',
];

const MODELS: Record<string, string[]> = {
  'Dell Technologies': ['OptiPlex 7090', 'Latitude 5530', 'Precision 3570', 'XPS 15 9520'],
  'HP Inc.': ['EliteBook 850 G8', 'ProBook 450 G9', 'EliteDesk 800 G8', 'ZBook Fury 16'],
  'Lenovo': ['ThinkPad T14 Gen3', 'ThinkCentre M70q', 'ThinkPad X1 Carbon', 'IdeaPad 5'],
  'Microsoft': ['Surface Pro 9', 'Surface Laptop 5', 'Surface Book 3'],
  'Apple Inc.': ['MacBook Pro 14"', 'MacBook Air M2', 'Mac mini M2 Pro'],
  'ASUS': ['ExpertBook B9450', 'ProArt Studiobook 16', 'ROG Flow Z13'],
  'Acer': ['TravelMate P6', 'Swift 5', 'ConceptD 7'],
  'Fujitsu': ['LIFEBOOK U9312', 'LIFEBOOK E5412', 'ESPRIMO G558'],
  'Panasonic': ['Toughbook 55', 'Toughpad FZ-G2'],
  'Toshiba': ['Portégé Z30-E', 'Tecra X40-F'],
};

const LOGICAL_GROUPS = [
  'Default Group',
  'Workstations',
  'Laptops',
  'Servers',
  'Development',
  'Finance',
  'HR',
  'Engineering',
  'Marketing',
  'Sales',
  'IT',
  'Operations',
];

const ACTIVITIES = ['Active', 'Active', 'Active', 'Idle', 'Active', 'Active', 'Updating'];

const ENROLLMENT_TYPES = ['Native', 'Native', 'SSH', 'SSHAndNative', 'Native'];

const MANAGEMENT_STATES = ['Managed', 'Managed', 'Managed', 'Unmanaged', 'Managed'];

// Location codes used in display names and org units
const REGION_CONFIG = [
  // [startIndex, count, regionName, locationCodes, domain, ouPrefix]
  {
    start: 0,
    count: 15000,
    region: 'Americas',
    locs: ['NYC', 'LAX', 'CHI', 'HOU', 'MIA', 'SFO', 'BOS', 'SEA', 'ATL', 'DAL'],
    domain: 'AMERICAS',
    ouBase: 'ou=Americas',
    userSuffix: '@americas.company.com',
  },
  {
    start: 15000,
    count: 18000,
    region: 'EMEA-West',
    locs: ['LON', 'PAR', 'FRA', 'AMS', 'ZRH', 'MIL', 'MAD', 'BRU', 'VIE', 'STO'],
    domain: 'EMEA',
    ouBase: 'ou=EMEA,ou=West',
    userSuffix: '@emea.company.com',
  },
  {
    start: 33000,
    count: 12000,
    region: 'EMEA-East',
    locs: ['WAW', 'BUD', 'PRG', 'BUC', 'SOF', 'ATH', 'IST', 'DUB', 'CPH', 'HEL'],
    domain: 'EMEA',
    ouBase: 'ou=EMEA,ou=East',
    userSuffix: '@emea.company.com',
  },
  {
    start: 45000,
    count: 9000,
    region: 'APAC',
    locs: ['SIN', 'TYO', 'SYD', 'HKG', 'SEL', 'BOM', 'BKK', 'KUL', 'CGK', 'MNL'],
    domain: 'APAC',
    ouBase: 'ou=APAC',
    userSuffix: '@apac.company.com',
  },
  {
    start: 54000,
    count: 6000,
    region: 'Global',
    locs: ['HQ', 'DC1', 'DC2', 'DMZ', 'LAB', 'TEST'],
    domain: 'GLOBAL',
    ouBase: 'ou=Global',
    userSuffix: '@company.com',
  },
] as const;

const USER_FIRST_NAMES = [
  'james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda',
  'william', 'barbara', 'david', 'elizabeth', 'richard', 'susan', 'joseph', 'jessica',
  'thomas', 'sarah', 'charles', 'karen', 'christopher', 'lisa', 'daniel', 'nancy',
  'matthew', 'betty', 'anthony', 'margaret', 'mark', 'sandra', 'donald', 'ashley',
  'steven', 'emily', 'paul', 'dorothy', 'andrew', 'kimberly', 'kenneth', 'donna',
];

const USER_LAST_NAMES = [
  'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller', 'davis',
  'rodriguez', 'martinez', 'hernandez', 'lopez', 'gonzalez', 'wilson', 'anderson',
  'thomas', 'taylor', 'moore', 'jackson', 'martin', 'lee', 'perez', 'thompson',
  'white', 'harris', 'sanchez', 'clark', 'ramirez', 'lewis', 'robinson', 'walker',
  'young', 'allen', 'king', 'wright', 'scott', 'torres', 'nguyen', 'hill', 'flores',
];

// ---------------------------------------------------------------------------
// Deterministic helper functions (pure functions of index)
// ---------------------------------------------------------------------------

/** Format a number with leading zeros to the given length */
function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

/** Derive a deterministic GUID from an index.
 *  Format: 88888888-8888-8888-8888-888888888888 (8-4-4-4-12 hex chars)
 */
function indexToGuid(index: number): string {
  // Each segment must have exactly the right number of hex digits.
  // We spread the index across all segments using bitwise ops + prime mixing.
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len); // slice ensures exact length

  const seg1 = toHex(0xe5000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 7 + 13) & 0xffff, 4);
  // 12-char segment: combine two 6-char halves
  const lo = (index * 31 + 7919) & 0xffffff;
  const hi = (index * 97 + 1031) & 0xffffff;
  const seg5 = toHex(hi, 6) + toHex(lo, 6);
  return `${seg1}-${seg2}-${seg3}-${seg4}-${seg5}`;
}

/** Deterministic IP from index: 10.x.y.z */
function indexToIP(index: number): string {
  const a = (index >> 16) & 0xff;
  const b = (index >> 8) & 0xff;
  const c = (index & 0xff);
  return `10.${a}.${b}.${(c % 254) + 1}`;
}

/** Deterministic MAC from index */
function indexToMAC(index: number): string {
  const bytes = [
    0x02, // locally administered
    (index >> 32) & 0xff,
    (index >> 24) & 0xff,
    (index >> 16) & 0xff,
    (index >> 8) & 0xff,
    index & 0xff,
  ];
  return bytes.map((b) => zeroPad(b, 2).toUpperCase()).join(':');
}

/** Pick entry from an array deterministically by index */
function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

/** Deterministic lastSeen date: BASE_DATE minus (index % 365) days */
function indexToLastSeen(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  const daysBack = index % 365;
  return new Date(BASE - daysBack * 24 * 60 * 60 * 1000).toISOString();
}

/** Deterministic last boot time: lastSeen minus (index % 30) days */
function indexToLastBoot(index: number): string {
  const lastSeenMs = new Date(indexToLastSeen(index)).getTime();
  const daysBack = index % 30;
  return new Date(lastSeenMs - daysBack * 24 * 60 * 60 * 1000).toISOString();
}

/** Deterministic install date: 2020-01-01 plus (index % 730) days */
function indexToInstallDate(index: number): string {
  const BASE = new Date('2020-01-01T00:00:00Z').getTime();
  return new Date(BASE + (index % 730) * 24 * 60 * 60 * 1000).toISOString();
}

/** Get regional config for this index */
function getRegion(index: number): typeof REGION_CONFIG[number] {
  for (const r of REGION_CONFIG) {
    if (index >= r.start && index < r.start + r.count) {
      return r;
    }
  }
  // Fallback to last region — REGION_CONFIG is non-empty by construction
  return REGION_CONFIG[REGION_CONFIG.length - 1] as typeof REGION_CONFIG[number];
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export interface WindowsEndpointRecord {
  id: string;
  guid: string;
  type: 'WindowsEndpoint';
  displayName: string;
  hostName: string;
  primaryMAC: string;
  macList: string;
  primaryIP: string;
  primarySubnetMask: string;
  comment: string | null;
  activity: string;
  lastSeen: string;
  operatingSystem: string;
  osVersionString: string;
  logicalGroupId: string;
  logicalGroup: string;
  manufacturer: string;
  modelName: string;
  clientAgentVersion: string;
  serialNumber: string;
  registeredUser: string;
  primaryUser: string;
  managementState: string;
  enrollmentType: string;
  isOnline: boolean;
  lastBootTime: string;
  installDate: string;
  domain: string;
  orgUnit: string;
  region: string;
}

export interface RegionBreakdown {
  region: string;
  start: number;
  count: number;
  end: number; // exclusive
}

export class WindowsEndpointGenerator extends BaseGenerator<WindowsEndpointRecord> {
  readonly totalItems = 60_000;
  readonly entityType = 'windowsEndpoints';

  /**
   * Returns the exact count of endpoints per region.
   * Used by tests to verify the distribution matches the spec.
   */
  regionBreakdown(): RegionBreakdown[] {
    return REGION_CONFIG.map((r) => ({
      region: r.region,
      start: r.start,
      count: r.count,
      end: r.start + r.count,
    }));
  }

  generateItem(index: number): WindowsEndpointRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid = indexToGuid(index);
    const region = getRegion(index);
    const localIndex = index - region.start;
    const loc = pick(region.locs, localIndex);
    const seqNum = localIndex + 1;

    const displayName = `${loc}-WS-${zeroPad(seqNum, 5)}`;
    const hostName = displayName;

    const os = pick(OS_VERSIONS, index);
    const osVersion = pick(OS_VERSION_STRINGS, index);
    const manufacturer = pick(MANUFACTURERS, index);
    const modelPool = MODELS[manufacturer] ?? ['Generic Workstation'];
    const modelName = pick(modelPool, index >> 1);

    const firstName = pick(USER_FIRST_NAMES, index * 3 + 1);
    const lastName = pick(USER_LAST_NAMES, index * 7 + 2);
    const primaryUser = `${firstName}.${lastName}${region.userSuffix}`;
    const registeredUser = `${region.domain}\\${firstName}.${lastName}`;

    const logicalGroupId = `00000000-0000-0000-0000-${zeroPad(index % 1000 + 1, 12)}`;
    const logicalGroup = pick(LOGICAL_GROUPS, index);

    const department = pick(
      ['Headquarters', 'Finance', 'Engineering', 'Marketing', 'Sales', 'HR', 'IT', 'Operations'],
      index >> 2
    );
    const orgUnit = `${region.ouBase},ou=${loc},ou=${department}`;

    const serialNum = `${manufacturer.slice(0, 3).toUpperCase()}${zeroPad(index, 8)}`;

    return {
      id: guid,
      guid,
      type: 'WindowsEndpoint',
      displayName,
      hostName,
      primaryMAC: indexToMAC(index),
      macList: indexToMAC(index),
      primaryIP: indexToIP(index),
      primarySubnetMask: '255.255.0.0',
      comment: null,
      activity: pick(ACTIVITIES, index),
      lastSeen: indexToLastSeen(index),
      operatingSystem: os,
      osVersionString: osVersion,
      logicalGroupId,
      logicalGroup,
      manufacturer,
      modelName,
      clientAgentVersion: '6.5.0.1234',
      serialNumber: serialNum,
      registeredUser,
      primaryUser,
      managementState: pick(MANAGEMENT_STATES, index),
      enrollmentType: pick(ENROLLMENT_TYPES, index),
      isOnline: (index % 10) < 7, // 70% online
      lastBootTime: indexToLastBoot(index),
      installDate: indexToInstallDate(index),
      domain: region.domain,
      orgUnit,
      region: region.region,
    };
  }
}
