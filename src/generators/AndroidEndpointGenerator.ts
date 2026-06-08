/**
 * AndroidEndpointGenerator — Lazy deterministic generator for Android endpoints
 *
 * Produces 5,000 Android mobile endpoints on demand.
 * Deterministic: same index → same endpoint, always.
 */

import { BaseGenerator } from './BaseGenerator';

const ANDROID_VERSIONS = [
  'Android 14', 'Android 13', 'Android 12', 'Android 11', 'Android 10',
];

const ANDROID_VERSION_NUMS = [
  '14.0.0', '13.0.0', '12.0.0', '11.0.0', '10.0.0',
];

const MANUFACTURERS = [
  'Samsung', 'Google', 'OnePlus', 'Xiaomi', 'Motorola',
  'Sony', 'Nokia', 'Huawei', 'Oppo', 'Vivo',
];

const MODELS: Record<string, string[]> = {
  Samsung: ['Galaxy S23 Ultra', 'Galaxy S22', 'Galaxy A54', 'Galaxy XCover6 Pro'],
  Google: ['Pixel 8 Pro', 'Pixel 7a', 'Pixel 6'],
  OnePlus: ['OnePlus 11', 'OnePlus 10 Pro'],
  Xiaomi: ['Xiaomi 13 Pro', 'Redmi Note 12'],
  Motorola: ['Edge 40 Pro', 'Moto G84'],
  Sony: ['Xperia 1 V', 'Xperia 5 IV'],
  Nokia: ['Nokia XR21', 'Nokia G60 5G'],
  Huawei: ['Mate 60 Pro', 'P60 Pro'],
  Oppo: ['Find X6 Pro', 'Reno10 Pro'],
  Vivo: ['X90 Pro', 'V27 Pro'],
};

const OU_POOLS = [
  'ou=Mobile,ou=Americas,ou=Corporate',
  'ou=Mobile,ou=EMEA,ou=Corporate',
  'ou=Mobile,ou=APAC,ou=Corporate',
  'ou=Mobile,ou=Global,ou=Executive',
  'ou=Mobile,ou=Americas,ou=Field',
];

const USER_FIRST = [
  'alice', 'bob', 'carol', 'dan', 'eve', 'frank', 'grace', 'hans',
  'iris', 'jack', 'kate', 'liam', 'mia', 'noah', 'olivia', 'paul',
  'quinn', 'rose', 'sam', 'tina', 'uma', 'victor', 'wendy', 'xander',
  'yuki', 'zara',
];

const USER_LAST = [
  'johnson', 'smith', 'brown', 'taylor', 'anderson', 'thomas', 'jackson',
  'white', 'harris', 'martin', 'garcia', 'martinez', 'robinson', 'clark',
  'rodriguez', 'lewis', 'lee', 'walker', 'hall', 'allen',
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
  const seg1 = toHex(0xa4000000 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 11 + 17) & 0xffff, 4);
  const lo = (index * 41 + 5003) & 0xffffff;
  const hi = (index * 113 + 2011) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToLastSeen(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 180) * 24 * 60 * 60 * 1000).toISOString();
}

function indexToIMEI(index: number): string {
  // 15-digit IMEI-like number (deterministic, not real)
  const base = 353626100000000 + index;
  return base.toString();
}

export interface AndroidEndpointRecord {
  id: string;
  guid: string;
  type: 'AndroidEndpoint';
  displayName: string;
  primaryUser: string;
  operatingSystem: string;
  androidVersion: string;
  manufacturer: string;
  modelName: string;
  serialNumber: string;
  imei: string;
  lastSeen: string;
  orgUnit: string;
  clientAgentVersion: string;
  managementState: string;
  isOnline: boolean;
}

export class AndroidEndpointGenerator extends BaseGenerator<AndroidEndpointRecord> {
  readonly totalItems = 5_000;
  readonly entityType = 'androidEndpoints';

  generateItem(index: number): AndroidEndpointRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid = indexToGuid(index);
    const manufacturer = pick(MANUFACTURERS, index);
    const modelPool = MODELS[manufacturer] ?? ['Generic Android'];
    const modelName = pick(modelPool, index >> 1);
    const osIdx = index % ANDROID_VERSIONS.length;

    const firstName = pick(USER_FIRST, index * 3 + 5);
    const lastName = pick(USER_LAST, index * 7 + 3);
    const primaryUser = `${firstName}.${lastName}@mobile.company.com`;

    return {
      id: guid,
      guid,
      type: 'AndroidEndpoint',
      displayName: `AND-MOB-${zeroPad(index + 1, 5)}`,
      primaryUser,
      operatingSystem: ANDROID_VERSIONS[osIdx] as string,
      androidVersion: ANDROID_VERSION_NUMS[osIdx] as string,
      manufacturer,
      modelName,
      serialNumber: `${manufacturer.slice(0, 3).toUpperCase()}${zeroPad(index, 7)}`,
      imei: indexToIMEI(index),
      lastSeen: indexToLastSeen(index),
      orgUnit: pick(OU_POOLS, index),
      clientAgentVersion: '6.5.0.1234',
      managementState: (index % 8) === 0 ? 'Unmanaged' : 'Managed',
      isOnline: (index % 5) < 3,
    };
  }
}
