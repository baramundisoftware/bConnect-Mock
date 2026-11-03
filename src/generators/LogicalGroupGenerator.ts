/**
 * LogicalGroupGenerator — Lazy deterministic generator for Logical Groups
 *
 * Produces 300 logical group records on demand.
 * Deterministic: same index → same record, always.
 */

import { BaseGenerator } from './BaseGenerator';
import { HIDDEN_TREE_ROOTS, type HiddenRoot } from '../profiles/treeRoots';

const GROUP_NAMES = [
  'Windows Endpoints', 'Linux Endpoints', 'Mac Endpoints', 'Android Devices',
  'iOS Devices', 'Production Servers', 'Development Workstations', 'Laptops',
  'Desktops', 'Virtual Machines', 'Remote Workers', 'Office Endpoints',
  'Finance Department', 'Engineering Team', 'Sales Laptops', 'Marketing Devices',
  'HR Endpoints', 'Management Devices', 'IT Infrastructure', 'Security Devices',
];

/** The UNC path of the mock's DIP (servermanagement Dips: dip01.corp.test) */
const DIP_PATH = '\\\\dip01.corp.test\\DIP';

const OU_TEMPLATES = [
  'ou=Endpoints,ou=Root',
  'ou=Windows,ou=Groups,ou=Root',
  'ou=Linux,ou=Groups,ou=Root',
  'ou=Mobile,ou=Groups,ou=Root',
  'ou=Servers,ou=Groups,ou=Root',
];

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length] as T;
}

function toHex(n: number, len: number): string {
  return (n >>> 0).toString(16).padStart(len, '0').slice(-len);
}

function indexToGuid(index: number): string {
  const seg1 = toHex(0xd1000002 + (index & 0x0fffffff), 8);
  const seg2 = toHex((index >> 8) & 0xffff, 4);
  const seg3 = toHex(index & 0xffff, 4);
  const seg4 = toHex((index * 47 + 23) & 0xffff, 4);
  const lo   = (index * 73 + 2027) & 0xffffff;
  const hi   = (index * 107 + 1031) & 0xffffff;
  return `${seg1}-${seg2}-${seg3}-${seg4}-${toHex(hi, 6)}${toHex(lo, 6)}`;
}

function groupName(index: number): string {
  const baseName = pick(GROUP_NAMES, index);
  return index < GROUP_NAMES.length ? baseName : `${baseName} ${Math.floor(index / GROUP_NAMES.length) + 1}`;
}

/**
 * The logical group an endpoint of the large-scale profile is in: one of the groups named for
 * its type (`base` indexes GROUP_NAMES: 'Windows Endpoints', 'Linux Endpoints', ...), or of
 * their numbered copies further down the tree, so endpoints link to groups the profile has
 */
export function logicalGroupOf(base: number, index: number): { logicalGroupId: string; logicalGroup: string } {
  const group = base + GROUP_NAMES.length * (index % 15);
  return { logicalGroupId: indexToGuid(group), logicalGroup: groupName(group) };
}

export interface LogicalGroupRecord {
  id: string;
  guid: string;
  name: string;
  type: 'LogicalGroup';
  displayName: string;
  parentId: string;
  parent: string;
  description: string;
  isBuiltIn: boolean;
  memberCount: number;
  childGroupCount: number;
  orgUnit: string;
  dip: string | null;
}

export class LogicalGroupGenerator extends BaseGenerator<LogicalGroupRecord> {
  readonly totalItems = 300;
  readonly entityType = 'logicalGroups';

  generateItem(index: number): LogicalGroupRecord {
    if (index < 0 || index >= this.totalItems) {
      throw new RangeError(`Index ${index} out of range [0, ${this.totalItems})`);
    }

    const guid        = indexToGuid(index);
    const displayName = groupName(index);
    // The top group's parent is the hidden root of the endpoints module, as on a live bMS
    const root        = HIDDEN_TREE_ROOTS['logicalGroups'] as HiddenRoot;
    const parentIndex = Math.floor(index / 10);

    return {
      id: guid,
      guid,
      name: displayName,
      type: 'LogicalGroup',
      displayName,
      parentId: index === 0 ? root.id : indexToGuid(parentIndex),
      parent: index === 0 ? root.name : groupName(parentIndex),
      description: `Logical group: ${displayName}`,
      isBuiltIn: index < 5,
      memberCount: (index * 19 + 3) % 500,
      childGroupCount: (index * 7) % 10,
      orgUnit: pick(OU_TEMPLATES, index),
      // A few groups install from the profile's DIP (UNC path), as about one in 30 on a live bMS
      dip: index % 25 === 1 ? DIP_PATH : null,
    };
  }
}
