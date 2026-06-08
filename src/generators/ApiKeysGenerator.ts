/**
 * ApiKeysGenerator — Lazy deterministic generator for 26R1 ServerManagement API Keys
 *
 * Produces 50 API key records on demand. Deterministic: same index → same record.
 * 26R1-ONLY: returns null in 25R2 mode.
 *
 * Schema matches fixtures/standard-26r1/apiKeys.json:
 *   id, name, expirationDate, comment, isActive, isAvailableViaGateway, securityProfiles
 */

import { BaseGenerator } from './BaseGenerator';

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function indexToGuid(prefix: number, index: number): string {
  const toHex = (n: number, len: number): string =>
    (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  const seg1 = toHex((prefix << 24) + (index & 0x00ffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 31 + 47) & 0xffff, 4);
  const lo = (index * 73 + 9029) & 0xffffff;
  const hi = (index * 149 + 2053) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

const KEY_NAMES = [
  'CI/CD Pipeline Key',
  'Monitoring Key',
  'Legacy Integration Key',
  'n8n Automation Key',
  'bMCWeb Integration Key',
  'Reporting Service Key',
  'Backup Service Key',
  'Security Scanner Key',
  'Load Balancer Health Check Key',
  'External API Gateway Key',
];

const SECURITY_PROFILE_POOLS: string[][] = [
  ['Administrators'],
  ['Operators'],
  ['Administrators', 'Operators'],
  [],
  ['ReadOnly'],
  ['Administrators', 'ReadOnly'],
];

const EXPIRY_YEARS = [2026, 2027, 2028, 2029] as const;

export interface ApiKeyRecord {
  id: string;
  name: string;
  expirationDate: string;
  comment: string;
  isActive: boolean;
  isAvailableViaGateway: boolean;
  securityProfiles: string[];
}

export class ApiKeysGenerator extends BaseGenerator<ApiKeyRecord> {
  readonly totalItems = 50;
  readonly entityType = 'apiKeys';

  generateItem(index: number): ApiKeyRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const nameTpl = pick(KEY_NAMES, index);
    const cycle = Math.floor(index / KEY_NAMES.length);
    const name = cycle > 0 ? `${nameTpl} ${cycle + 1}` : nameTpl;
    const year = pick(EXPIRY_YEARS, index);
    const month = String((index % 12) + 1).padStart(2, '0');
    const expirationDate = `${year}-${month}-01T00:00:00Z`;
    const isActive = (index % 7) !== 0; // ~86% active
    const isAvailableViaGateway = (index % 3) === 0;

    return {
      id: indexToGuid(0xac, index),
      name,
      expirationDate,
      comment: `Key used for ${name.toLowerCase()}`,
      isActive,
      isAvailableViaGateway,
      securityProfiles: pick(SECURITY_PROFILE_POOLS, index),
    };
  }
}
