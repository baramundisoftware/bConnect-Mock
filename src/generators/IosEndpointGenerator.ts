/**
 * IosEndpointGenerator — Lazy deterministic generator for iOS/iPadOS endpoints
 *
 * Produces 1,000 iOS/iPadOS managed devices on demand.
 * Deterministic: same index → same endpoint, always.
 */

import { BaseGenerator } from './BaseGenerator';

const IOS_VERSIONS = [
  'iOS 17.4', 'iOS 17.3', 'iOS 16.7', 'iOS 16.6', 'iOS 15.8',
];

const IPADOS_VERSIONS = [
  'iPadOS 17.4', 'iPadOS 17.3', 'iPadOS 16.7', 'iPadOS 16.6',
];

const IPHONE_MODELS = [
  'iPhone 15 Pro Max', 'iPhone 15 Pro', 'iPhone 15', 'iPhone 14 Pro Max',
  'iPhone 14 Pro', 'iPhone 14', 'iPhone 13 Pro', 'iPhone 13',
];

const IPAD_MODELS = [
  'iPad Pro 12.9-inch (6th gen)', 'iPad Pro 11-inch (4th gen)',
  'iPad Air (5th gen)', 'iPad (10th gen)', 'iPad mini (6th gen)',
];

const OU_POOLS = [
  'ou=iOS,ou=Mobile,ou=Americas',
  'ou=iOS,ou=Mobile,ou=EMEA',
  'ou=iOS,ou=Mobile,ou=APAC',
  'ou=iPad,ou=Mobile,ou=Corporate',
  'ou=iOS,ou=Mobile,ou=Executive',
];

const USER_FIRST = [
  'alice', 'bob', 'carol', 'dan', 'eve', 'frank', 'grace', 'hans',
  'iris', 'jack', 'kate', 'liam', 'mia', 'noah', 'olivia', 'paul',
];

const USER_LAST = [
  'johnson', 'smith', 'brown', 'taylor', 'anderson', 'thomas',
  'jackson', 'white', 'harris', 'martin', 'garcia', 'martinez',
];

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function indexToGuid(index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const seg1 = toHex(0xc5000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 17 + 31) & 0xffff, 4);
  const lo = (index * 43 + 5101) & 0xffffff;
  const hi = (index * 107 + 2017) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToLastSeen(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 120) * 24 * 60 * 60 * 1000).toISOString();
}

function indexToUDID(index: number): string {
  const hex = (index + 0x100000).toString(16).padStart(8, '0');
  return `ios-udid-${hex}-0000-0000-0000-${zeroPad(index, 12)}`;
}

export interface IosEndpointRecord {
  id: string;
  guid: string;
  type: 'IOSEndpoint';
  displayName: string;
  primaryUser: string;
  operatingSystem: string;
  modelName: string;
  serialNumber: string;
  udid: string;
  lastSeen: string;
  orgUnit: string;
  clientAgentVersion: string;
  managementState: string;
  isOnline: boolean;
  isSupervised: boolean;
}

export class IosEndpointGenerator extends BaseGenerator<IosEndpointRecord> {
  readonly totalItems = 1_000;
  readonly entityType = 'iosEndpoints';

  generateItem(index: number): IosEndpointRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid = indexToGuid(index);
    const isIpad = (index % 4) === 0;
    const modelName = isIpad
      ? pick(IPAD_MODELS, index)
      : pick(IPHONE_MODELS, index);
    const osVersion = isIpad
      ? pick(IPADOS_VERSIONS, index)
      : pick(IOS_VERSIONS, index);

    const firstName = pick(USER_FIRST, index * 3 + 7);
    const lastName = pick(USER_LAST, index * 7 + 5);
    const primaryUser = `${firstName}.${lastName}@mobile.company.com`;
    const prefix = isIpad ? 'IPD' : 'IOS';

    return {
      id: guid,
      guid,
      type: 'IOSEndpoint',
      displayName: `${prefix}-MOB-${zeroPad(index + 1, 5)}`,
      primaryUser,
      operatingSystem: osVersion,
      modelName,
      serialNumber: `APL${zeroPad(index, 9)}`,
      udid: indexToUDID(index),
      lastSeen: indexToLastSeen(index),
      orgUnit: pick(OU_POOLS, index),
      clientAgentVersion: '6.5.0.1234',
      managementState: (index % 10) === 0 ? 'Unmanaged' : 'Managed',
      isOnline: (index % 5) < 4, // 80% online
      isSupervised: (index % 3) < 2, // 67% supervised
    };
  }
}
