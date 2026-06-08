/**
 * AssetGenerator — Lazy deterministic generator for Assets
 *
 * Produces 5,000 asset records on demand.
 * Deterministic: same index → same record, always.
 */

import { BaseGenerator } from './BaseGenerator';

const ASSET_TYPES = ['Desktop', 'Laptop', 'Server', 'Tablet', 'Printer', 'Monitor'];

const LOCATIONS = [
  'New York HQ - Floor 1',  'New York HQ - Floor 5',  'New York HQ - Floor 10',
  'London Office - 1st Floor', 'London Office - 3rd Floor',
  'Singapore Branch', 'Frankfurt Office', 'Sydney Branch',
  'Chicago Office', 'Toronto Office',
];

const DEPARTMENTS = [
  'Finance', 'Development', 'IT', 'Sales', 'Marketing',
  'HR', 'Legal', 'Operations', 'Security', 'Management',
];

const COST_CENTERS = [
  'FIN-001', 'DEV-002', 'IT-003', 'SLS-004', 'MKT-005',
  'HR-006', 'LGL-007', 'OPS-008', 'SEC-009', 'MGT-010',
];

const SITE_CODES = ['NYC', 'LON', 'SIN', 'FRA', 'SYD', 'CHI', 'TOR', 'BER', 'PAR', 'TOK'];

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function zeroPad(n: number, len: number): string {
  return n.toString().padStart(len, '0');
}

function toHex(n: number, len: number): string {
  return (n >>> 0).toString(16).padStart(len, '0').slice(-len);
}

function indexToGuid(index: number): string {
  const seg1 = toHex(0xa0000002 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 41 + 13) & 0xffff, 4);
  const lo   = (index * 67 + 3007) & 0xffffff;
  const hi   = (index * 97 + 1013) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function indexToDate(index: number, offsetYears: number): string {
  const BASE = new Date('2026-04-01').getTime();
  const ms   = BASE - (index % 365 + offsetYears * 365) * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString().slice(0, 10);
}

export interface AssetRecord {
  id: string;
  assetTag: string;
  type: string;
  location: string;
  department: string;
  purchaseDate: string;
  warrantyExpires: string;
  costCenter: string;
}

export class AssetGenerator extends BaseGenerator<AssetRecord> {
  readonly totalItems = 5_000;
  readonly entityType = 'assets';

  generateItem(index: number): AssetRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const site = pick(SITE_CODES, index);
    const seq  = zeroPad((index % 999) + 1, 3);

    return {
      id: indexToGuid(index),
      assetTag: `AST-${site}-${seq}`,
      type: pick(ASSET_TYPES, index),
      location: pick(LOCATIONS, index),
      department: pick(DEPARTMENTS, index),
      purchaseDate: indexToDate(index, 2),
      warrantyExpires: indexToDate(index, -1),
      costCenter: pick(COST_CENTERS, index),
    };
  }
}
