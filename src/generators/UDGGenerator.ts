/**
 * UDGGenerator — Lazy deterministic generator for 26R1 Universal Dynamic Groups
 *
 * Produces 500 UDG records on demand. Deterministic: same index → same record.
 * 26R1-ONLY: returns null in 25R2 mode.
 *
 * Schema matches fixtures/standard-26r1/universalDynamicGroups.json:
 *   id, name, comment, folderName, folderId
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
  const seg4 = toHex((index * 29 + 41) & 0xffff, 4);
  const lo = (index * 71 + 9013) & 0xffffff;
  const hi = (index * 139 + 2039) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

const FOLDERS = [
  { name: 'Root', id: 0xf0 },
  { name: 'Security', id: 0xf1 },
  { name: 'Infrastructure', id: 0xf2 },
  { name: 'Compliance', id: 0xf3 },
  { name: 'Operations', id: 0xf4 },
  { name: 'Development', id: 0xf5 },
  { name: 'Finance', id: 0xf6 },
  { name: 'HR', id: 0xf7 },
] as const;

const GROUP_NAME_TEMPLATES = [
  'All Windows Endpoints',
  'Unpatched Critical Endpoints',
  'Windows Servers',
  'Non-Compliant Endpoints',
  'Active Endpoints',
  'Offline Endpoints',
  'EMEA Endpoints',
  'Americas Endpoints',
  'APAC Endpoints',
  'Managed Endpoints',
  'Unmanaged Endpoints',
  'Recently Added Endpoints',
  'Endpoints with Vulnerabilities',
  'Fully Patched Endpoints',
  'Endpoints Pending Reboot',
  'High-Risk Endpoints',
  'Development Machines',
  'Production Servers',
  'Staging Endpoints',
  'Endpoints Missing Agent',
];

export interface UDGRecord {
  id: string;
  name: string;
  comment: string;
  folderName: string;
  folderId: string;
}

export class UniversalDynamicGroupsGenerator extends BaseGenerator<UDGRecord> {
  readonly totalItems = 500;
  readonly entityType = 'universalDynamicGroups';

  generateItem(index: number): UDGRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const folder = pick(FOLDERS, index);
    const nameTpl = pick(GROUP_NAME_TEMPLATES, index);
    const cycle = Math.floor(index / GROUP_NAME_TEMPLATES.length);
    const name = cycle > 0 ? `${nameTpl} (${folder.name} ${cycle + 1})` : nameTpl;

    return {
      id: indexToGuid(0xd0, index),
      name,
      comment: `Dynamic group: ${name}`,
      folderName: folder.name,
      folderId: indexToGuid(folder.id, 0),
    };
  }
}
