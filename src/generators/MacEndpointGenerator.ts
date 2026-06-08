/**
 * MacEndpointGenerator — Lazy deterministic generator for macOS endpoints
 *
 * Produces 2,500 Mac endpoints on demand.
 * Deterministic: same index → same endpoint, always.
 */

import { BaseGenerator } from './BaseGenerator';

const MAC_OS = [
  'macOS Sonoma 14.3',
  'macOS Ventura 13.6',
  'macOS Monterey 12.7',
  'macOS Sonoma 14.2',
  'macOS Ventura 13.5',
];

const MAC_OS_VERSIONS = [
  '14.3.0', '13.6.0', '12.7.0', '14.2.0', '13.5.0',
];

const MODELS = [
  'MacBook Pro 16-inch M3 Max',
  'MacBook Pro 14-inch M3 Pro',
  'MacBook Air 15-inch M2',
  'MacBook Air 13-inch M2',
  'Mac mini M2 Pro',
  'Mac Studio M2 Max',
  'iMac 24-inch M3',
  'Mac Pro (2023)',
];

const OU_POOLS = [
  'ou=Executive,ou=Americas,ou=Leadership',
  'ou=Design,ou=Americas,ou=Creative',
  'ou=Engineering,ou=EMEA,ou=Software',
  'ou=Marketing,ou=APAC,ou=Creative',
  'ou=Finance,ou=Global,ou=Corporate',
  'ou=Research,ou=Americas,ou=Innovation',
];

const USER_FIRST = [
  'alex', 'blake', 'casey', 'dana', 'eden', 'finley', 'gray', 'harley',
  'indie', 'jesse', 'kerry', 'lane', 'morgan', 'noel', 'onyx', 'parker',
];

const USER_LAST = [
  'baker', 'chen', 'davis', 'evans', 'foster', 'green', 'hill', 'irwin',
  'james', 'kelly', 'lynch', 'moore', 'nash', 'oneil', 'perry', 'quinn',
];

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function indexToLastSeen(index: number): string {
  const BASE = new Date('2026-03-30T00:00:00Z').getTime();
  return new Date(BASE - (index % 120) * 24 * 60 * 60 * 1000).toISOString();
}

function indexToMAC(index: number): string {
  // Apple OUI prefix: 00:1B:63 (locally administered variant)
  const b3 = (index >> 8) & 0xff;
  const b4 = index & 0xff;
  const b5 = (index * 17 + 7) & 0xff;
  return `00:1B:63:${zeroPad(b3, 2).toUpperCase()}:${zeroPad(b4, 2).toUpperCase()}:${zeroPad(b5, 2).toUpperCase()}`;
}

export interface MacEndpointRecord {
  id: string;
  guid: string;
  type: 'MacEndpoint';
  displayName: string;
  hostName: string;
  primaryUser: string;
  operatingSystem: string;
  osVersion: string;
  modelName: string;
  serialNumber: string;
  primaryMAC: string;
  primaryIP: string;
  lastSeen: string;
  orgUnit: string;
  clientAgentVersion: string;
  managementState: string;
  isOnline: boolean;
}

export class MacEndpointGenerator extends BaseGenerator<MacEndpointRecord> {
  readonly totalItems = 2_500;
  readonly entityType = 'macEndpoints';

  generateItem(index: number): MacEndpointRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const toHex = (n: number, len: number): string =>
      (n >>> 0).toString(16).padStart(len, '0').slice(-len);
    const seg1 = toHex(0xc2000000 + (index & 0x0fffffff), 8);
    const seg2 = toHex((index >> 8) & 0xffff, 4);
    const seg3 = toHex(index & 0xffff, 4);
    const seg4 = toHex((index * 17 + 31) & 0xffff, 4);
    const lo = (index * 67 + 7013) & 0xffffff;
    const hi = (index * 131 + 4001) & 0xffffff;
    const guid = `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;

    const firstName = pick(USER_FIRST, index * 5 + 2);
    const lastName = pick(USER_LAST, index * 11 + 7);
    const primaryUser = `${firstName}.${lastName}@creative.company.com`;

    const displayName = `MAC-${zeroPad(index + 1, 5)}`;
    const osIdx = index % MAC_OS.length;

    return {
      id: guid,
      guid,
      type: 'MacEndpoint',
      displayName,
      hostName: `${firstName}-mbp`,
      primaryUser,
      operatingSystem: MAC_OS[osIdx] as string,
      osVersion: MAC_OS_VERSIONS[osIdx] as string,
      modelName: pick(MODELS, index),
      serialNumber: `C${zeroPad(index, 8)}`,
      primaryMAC: indexToMAC(index),
      primaryIP: `192.168.${(index >> 8) & 0xff}.${(index & 0xff) + 1}`,
      lastSeen: indexToLastSeen(index),
      orgUnit: pick(OU_POOLS, index),
      clientAgentVersion: '6.5.0.1234',
      managementState: 'Managed',
      isOnline: (index % 4) < 3, // 75% online
    };
  }
}
